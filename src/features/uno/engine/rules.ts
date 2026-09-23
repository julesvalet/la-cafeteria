import {
  COLORS,
  COLOR_LABEL,
  MYSTERY_COUNT,
  MYSTERY_EFFECTS,
  MYSTERY_ORDER,
  createDeck,
  createMysteryCards,
  isWild,
  shuffle,
} from './deck';
import type { UnoAction, UnoCard, UnoColor, UnoMysteryEffect, UnoPlayer, UnoState } from './types';

export const HAND_SIZE = 7;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/** Penalty for forgetting to declare, and for a wrong "Contre UNO" call. */
export const UNO_PENALTY = 2;

export interface ActionResult {
  state: UnoState;
  error?: string;
}

export function createInitialState(roomCode: string, hostId: string, maxPlayers = 2): UnoState {
  return {
    roomCode,
    hostId,
    maxPlayers,
    stackingEnabled: false,
    mysteryEnabled: false,
    players: [],
    deck: [],
    discard: [],
    activeColor: 'red',
    direction: 1,
    turn: 0,
    phase: 'lobby',
    pendingDraw: 0,
    hasDrawnThisTurn: false,
    winner: null,
    lastEvent: { seq: 0, kind: 'none' },
    log: ['Room créée. En attente de joueurs...'],
  };
}

export function topCard(state: UnoState): UnoCard | null {
  return state.discard[state.discard.length - 1] ?? null;
}

/**
 * Whether `card` may be played right now.
 *
 * While a stack of "+" cards is building, the only legal answers are other "+"
 * cards — everything else has to wait for the stack to be paid.
 */
export function canPlay(state: UnoState, card: UnoCard): boolean {
  if (state.pendingDraw > 0) {
    if (!state.stackingEnabled) return false;
    return card.kind === 'draw2' || card.kind === 'wild4';
  }
  if (isWild(card)) return true;
  const top = topCard(state);
  if (!top) return true;
  if (card.color === state.activeColor) return true;
  if (card.kind === 'number' && top.kind === 'number' && card.number === top.number) return true;
  // Action cards match each other by kind across colours.
  return card.kind !== 'number' && card.kind === top.kind;
}

export function hasPlayableCard(state: UnoState, playerIndex: number): boolean {
  return (state.players[playerIndex]?.hand ?? []).some((card) => canPlay(state, card));
}

function bumpEvent(state: UnoState, event: Omit<UnoState['lastEvent'], 'seq'>): UnoState {
  return { ...state, lastEvent: { ...event, seq: state.lastEvent.seq + 1 } };
}

/** Seats that can still take a turn: connected, and the game still running. */
function connectedCount(state: UnoState): number {
  return state.players.filter((p) => p.connected).length;
}

function stepFrom(state: UnoState, from: number, steps: number): number {
  const n = state.players.length;
  if (n === 0) return 0;
  let index = from;
  let moved = 0;
  // Walk the table, skipping seats whose player has left.
  for (let guard = 0; guard < n * (steps + 2) && moved < steps; guard++) {
    index = (index + state.direction + n) % n;
    if (state.players[index]?.connected || connectedCount(state) === 0) moved++;
  }
  return index;
}

function nextSeat(state: UnoState, steps = 1): number {
  return stepFrom(state, state.turn, steps);
}

/**
 * Draws `count` cards for a seat, reshuffling the discard pile back into the
 * deck when it runs dry. The top card always stays on the table.
 */
function drawCards(
  state: UnoState,
  playerIndex: number,
  count: number,
): { state: UnoState; drawn: UnoCard[] } {
  let deck = [...state.deck];
  let discard = [...state.discard];
  const drawn: UnoCard[] = [];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      // Keep the face-up card, recycle everything under it.
      const top = discard.pop();
      if (discard.length === 0) {
        if (top) discard.push(top);
        break; // Nothing left to recycle — the draw simply comes up short.
      }
      deck = shuffle(discard);
      discard = top ? [top] : [];
    }
    const card = deck.pop();
    if (!card) break;
    drawn.push(card);
  }

  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, hand: [...p.hand, ...drawn], handCount: p.handCount + drawn.length } : p,
  );

  return { state: { ...state, deck, discard, players }, drawn };
}

/**
 * Draws `count` cards, resolving any mystery card that turns up along the way.
 *
 * Every route by which a player gains cards goes through here. Drawing in bulk
 * with `drawCards` alone would let a mystery card land face-down in a hand,
 * where it is unplayable by every matching rule and would sit there forever.
 *
 * `depth` guards the one recursive path: a mystery card whose effect is itself
 * a bulk draw can uncover the other mystery card.
 */
function drawResolved(
  state: UnoState,
  playerIndex: number,
  count: number,
  depth = 0,
): { state: UnoState; drawn: UnoCard[] } {
  let next = state;
  const drawn: UnoCard[] = [];

  for (let i = 0; i < count; i++) {
    const step = drawCards(next, playerIndex, 1);
    next = step.state;
    const card = step.drawn[0];
    if (!card) break;

    if (card.kind === 'mystery' && depth < MYSTERY_COUNT) {
      // Pull it straight back out of the hand: it is an event, not a card.
      next = {
        ...next,
        players: next.players.map((p, j) =>
          j === playerIndex
            ? { ...p, hand: p.hand.filter((c) => c.id !== card.id), handCount: p.handCount - 1 }
            : p,
        ),
      };
      const effect = MYSTERY_ORDER[Math.floor(Math.random() * MYSTERY_ORDER.length)];
      next = applyMystery(next, playerIndex, effect, depth + 1);
      continue;
    }

    if (card.kind === 'mystery') {
      // Depth exhausted: spend it silently rather than leave a dead card behind.
      next = {
        ...next,
        players: next.players.map((p, j) =>
          j === playerIndex
            ? { ...p, hand: p.hand.filter((c) => c.id !== card.id), handCount: p.handCount - 1 }
            : p,
        ),
      };
      continue;
    }

    drawn.push(card);
  }

  return { state: next, drawn };
}

/**
 * Resolves a mystery card the moment it is drawn. It never enters a hand: the
 * effect fires and the card is spent.
 */
function applyMystery(
  state: UnoState,
  playerIndex: number,
  effect: UnoMysteryEffect,
  depth = 0,
): UnoState {
  const name = state.players[playerIndex]?.name ?? 'Quelqu’un';
  const def = MYSTERY_EFFECTS[effect];
  let next = state;

  switch (effect) {
    case 'draw10':
    case 'draw8': {
      const count = effect === 'draw10' ? 10 : 8;
      next = drawResolved(next, playerIndex, count, depth).state;
      next = { ...next, log: [...next.log, `${name} révèle ${def.label} et pioche ${count} cartes !`] };
      break;
    }
    case 'colorChangeDraw2': {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const victim = stepFrom(next, playerIndex, 1);
      next = drawResolved(next, victim, 2, depth).state;
      next = {
        ...next,
        activeColor: color,
        log: [
          ...next.log,
          `${name} révèle ${def.label} : la couleur passe au ${COLOR_LABEL[color].toLowerCase()} et ${
            next.players[victim]?.name ?? 'le joueur suivant'
          } pioche 2 cartes.`,
        ],
      };
      break;
    }
    case 'reverseColorChange': {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      next = {
        ...next,
        direction: (next.direction * -1) as 1 | -1,
        activeColor: color,
        log: [
          ...next.log,
          `${name} révèle ${def.label} : le sens s’inverse et la couleur passe au ${COLOR_LABEL[
            color
          ].toLowerCase()}.`,
        ],
      };
      break;
    }
    case 'swapHands': {
      // Swap with whoever is currently sitting prettiest.
      let best = -1;
      for (let i = 0; i < next.players.length; i++) {
        if (i === playerIndex || !next.players[i].connected) continue;
        if (best === -1 || next.players[i].hand.length < next.players[best].hand.length) best = i;
      }
      if (best === -1) {
        next = { ...next, log: [...next.log, `${name} révèle ${def.label}, mais il n’y a personne avec qui échanger.`] };
        break;
      }
      const mine = next.players[playerIndex].hand;
      const theirs = next.players[best].hand;
      next = {
        ...next,
        players: next.players.map((p, i) => {
          if (i === playerIndex) return { ...p, hand: theirs, handCount: theirs.length, hasDeclaredUno: false };
          if (i === best) return { ...p, hand: mine, handCount: mine.length, hasDeclaredUno: false };
          return p;
        }),
        log: [...next.log, `${name} révèle ${def.label} et échange sa main avec ${next.players[best].name} !`],
      };
      break;
    }
  }

  return bumpEvent(next, { kind: 'mystery', by: playerIndex, effect });
}

function checkWin(state: UnoState, playerIndex: number): UnoState {
  if (state.players[playerIndex].hand.length > 0) return state;
  return {
    ...state,
    phase: 'won',
    winner: playerIndex,
    log: [...state.log, `${state.players[playerIndex].name} se débarrasse de sa dernière carte et gagne !`],
  };
}

export function addPlayer(state: UnoState, id: string, name: string, userId: string | null = null): UnoState {
  if (state.players.some((p) => p.id === id)) return state;
  if (state.phase !== 'lobby') return state;
  if (state.players.length >= state.maxPlayers) return state;

  const player: UnoPlayer = {
    id,
    name: name.trim() || 'Joueur',
    userId,
    hand: [],
    handCount: 0,
    connected: true,
    hasDeclaredUno: false,
  };
  return {
    ...state,
    players: [...state.players, player],
    log: [...state.log, `${player.name} a rejoint la partie.`],
  };
}

export function setOptions(state: UnoState, maxPlayers: number, stackingEnabled: boolean): ActionResult {
  if (state.phase !== 'lobby') return { state, error: 'La partie a déjà commencé.' };
  if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
    return { state, error: 'Le nombre de joueurs doit être entre 2 et 4.' };
  }
  if (state.players.length > maxPlayers) {
    return { state, error: `Il y a déjà ${state.players.length} joueurs dans la room.` };
  }
  return { state: { ...state, maxPlayers, stackingEnabled } };
}

export function startGame(state: UnoState): ActionResult {
  if (state.phase !== 'lobby') return { state, error: 'La partie a déjà commencé.' };
  if (state.players.length < MIN_PLAYERS) return { state, error: 'Il faut au moins 2 joueurs.' };
  if (state.players.length !== state.maxPlayers) {
    return { state, error: `Cette partie attend ${state.maxPlayers} joueurs.` };
  }

  // A duel has no audience, so a mystery card would surprise nobody.
  const mysteryEnabled = state.players.length > 2;
  const base = createDeck();
  const withMystery = mysteryEnabled ? [...base, ...createMysteryCards(MYSTERY_COUNT)] : base;
  let deck = shuffle(withMystery);

  const players = state.players.map((p) => {
    const hand = deck.slice(-HAND_SIZE);
    deck = deck.slice(0, -HAND_SIZE);
    return { ...p, hand, handCount: hand.length, hasDeclaredUno: false };
  });

  // The starter must be an ordinary number card: opening on a wild, a mystery
  // or an action card would need a colour or a victim before anyone has played.
  let starterIndex = -1;
  for (let i = deck.length - 1; i >= 0; i--) {
    if (deck[i].kind === 'number') {
      starterIndex = i;
      break;
    }
  }
  const starter = deck[starterIndex];
  deck = deck.filter((_, i) => i !== starterIndex);

  return {
    state: {
      ...state,
      mysteryEnabled,
      players,
      deck,
      discard: [starter],
      activeColor: starter.color!,
      direction: 1,
      turn: 0,
      phase: 'playing',
      pendingDraw: 0,
      hasDrawnThisTurn: false,
      winner: null,
      lastEvent: { seq: state.lastEvent.seq + 1, kind: 'none' },
      log: [
        ...state.log,
        `Partie lancée à ${players.length} joueurs.`,
        ...(mysteryEnabled ? ['2 cartes mystère ont été mélangées dans la pioche...'] : []),
      ],
    },
  };
}

/**
 * Plays one card from a hand.
 *
 * The UNO protocol is enforced here rather than in the UI: a player who lands
 * on one card without having declared takes the penalty immediately, which is
 * what makes the declaration worth clicking.
 */
export function playCard(
  state: UnoState,
  playerId: string,
  cardId: string,
  chosenColor?: UnoColor,
): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (state.turn !== playerIndex) return { state, error: "Ce n'est pas ton tour." };

  const player = state.players[playerIndex];
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return { state, error: 'Carte introuvable dans ta main.' };
  if (!canPlay(state, card)) {
    return {
      state,
      error:
        state.pendingDraw > 0
          ? 'Tu dois répondre avec un +2 ou un +4, ou piocher.'
          : 'Cette carte ne correspond ni à la couleur ni au symbole.',
    };
  }
  if (isWild(card) && !chosenColor) return { state, error: 'Choisis une couleur.' };

  const remaining = player.hand.filter((c) => c.id !== cardId);
  let next: UnoState = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, hand: remaining, handCount: remaining.length } : p,
    ),
    discard: [...state.discard, card],
    activeColor: isWild(card) ? chosenColor! : card.color!,
    hasDrawnThisTurn: false,
    log: [...state.log, `${player.name} joue ${describe(card, chosenColor)}.`],
  };

  next = bumpEvent(next, { kind: 'play', by: playerIndex, cardId });

  /*
   * The penalty lands on the *last* card, not on dropping to one.
   *
   * That timing is what makes "Contre UNO" a real mechanic: between the moment
   * a player reaches one card and the moment they lay it down, they are
   * catchable. Auto-punishing the instant they hit one card would close that
   * window before anyone could use it.
   */
  if (remaining.length === 0 && !player.hasDeclaredUno) {
    next = drawResolved(next, playerIndex, UNO_PENALTY).state;
    next = {
      ...next,
      log: [...next.log, `${player.name} a oublié d'annoncer UNO : +${UNO_PENALTY} cartes !`],
    };
    next = bumpEvent(next, { kind: 'penalty', by: playerIndex, count: UNO_PENALTY });
    return { state: advanceAfterPlay(next, card) };
  }

  // A declaration covers exactly one trip down to the last card; holding more
  // than one card again means the next one has to be announced afresh.
  if (remaining.length > 1) {
    next = {
      ...next,
      players: next.players.map((p, i) => (i === playerIndex ? { ...p, hasDeclaredUno: false } : p)),
    };
  }

  next = checkWin(next, playerIndex);
  if (next.phase === 'won') return { state: next };

  return { state: advanceAfterPlay(next, card) };
}

function describe(card: UnoCard, chosenColor?: UnoColor): string {
  const base =
    card.kind === 'number'
      ? `un ${card.number}`
      : card.kind === 'skip'
        ? 'un Passe ton tour'
        : card.kind === 'reverse'
          ? 'une Inversion'
          : card.kind === 'draw2'
            ? 'un +2'
            : card.kind === 'wild'
              ? 'un Changement de couleur'
              : 'un +4';
  return chosenColor ? `${base} (${COLOR_LABEL[chosenColor].toLowerCase()})` : base;
}

/**
 * Applies a played card's own effect, then hands the turn on.
 *
 * Takes no player index on purpose: every effect here is relative to whoever is
 * currently to move, which `state.turn` already holds.
 */
function advanceAfterPlay(state: UnoState, card: UnoCard): UnoState {
  let next = state;

  switch (card.kind) {
    case 'draw2':
    case 'wild4': {
      const amount = card.kind === 'draw2' ? 2 : 4;
      if (next.stackingEnabled) {
        // Stack it and pass the buck: the next player may raise or pay.
        return { ...next, pendingDraw: next.pendingDraw + amount, turn: nextSeat(next, 1) };
      }
      const victim = nextSeat(next, 1);
      next = drawResolved(next, victim, amount).state;
      next = {
        ...next,
        log: [...next.log, `${next.players[victim].name} pioche ${amount} cartes et passe son tour.`],
      };
      // Standard UNO: the penalised player also loses their turn.
      return { ...next, pendingDraw: 0, turn: stepFrom(next, victim, 1) };
    }
    case 'skip': {
      const skipped = nextSeat(next, 1);
      next = { ...next, log: [...next.log, `${next.players[skipped].name} passe son tour.`] };
      return { ...next, turn: nextSeat(next, 2) };
    }
    case 'reverse': {
      // Head to head, a reverse is effectively a skip — it comes straight back.
      if (connectedCount(next) === 2) return { ...next, turn: next.turn };
      const flipped: UnoState = { ...next, direction: (next.direction * -1) as 1 | -1 };
      return { ...flipped, turn: nextSeat(flipped, 1), log: [...flipped.log, 'Le sens du jeu s’inverse.'] };
    }
    default:
      return { ...next, turn: nextSeat(next, 1) };
  }
}

/**
 * Draws for the player to move: either paying off an accumulated stack of "+"
 * cards, or taking the single card you are owed when nothing is playable.
 */
export function drawCard(state: UnoState, playerId: string): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (state.turn !== playerIndex) return { state, error: "Ce n'est pas ton tour." };

  const name = state.players[playerIndex].name;

  if (state.pendingDraw > 0) {
    const owed = state.pendingDraw;
    // Resolved one at a time so a mystery card buried in the stack still fires.
    let next = drawResolved({ ...state, pendingDraw: 0 }, playerIndex, owed).state;
    next = {
      ...next,
      hasDrawnThisTurn: false,
      log: [...next.log, `${name} encaisse la pile et pioche ${owed} cartes.`],
    };
    next = bumpEvent(next, { kind: 'draw', by: playerIndex, count: owed });
    return { state: { ...next, turn: nextSeat(next, 1) } };
  }

  if (state.hasDrawnThisTurn) return { state, error: 'Tu as déjà pioché ce tour-ci.' };

  let next = drawResolved(state, playerIndex, 1).state;
  next = { ...next, hasDrawnThisTurn: true, log: [...next.log, `${name} pioche une carte.`] };
  next = bumpEvent(next, { kind: 'draw', by: playerIndex, count: 1 });

  // A mystery card can hand the turn on by itself (reverse), so only pass the
  // turn here if the drawn card left the player with nothing to do.
  if (!hasPlayableCard(next, playerIndex)) {
    return { state: { ...next, hasDrawnThisTurn: false, turn: nextSeat(next, 1) } };
  }
  return { state: next };
}

/** Gives up the turn after having drawn, when the drawn card is unplayable. */
export function pass(state: UnoState, playerId: string): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (state.turn !== playerIndex) return { state, error: "Ce n'est pas ton tour." };
  if (!state.hasDrawnThisTurn) return { state, error: 'Tu dois piocher avant de passer.' };

  const next: UnoState = {
    ...state,
    hasDrawnThisTurn: false,
    log: [...state.log, `${state.players[playerIndex].name} passe son tour.`],
  };
  return { state: { ...next, turn: nextSeat(next, 1) } };
}

/**
 * The UNO declaration.
 *
 * Shouting is never an illegal move — it is a shout. Anyone may do it at any
 * time, and it always reaches the table (which is what lets every client play
 * the announcement animation). What it does *not* always do is protect you:
 * only a shout made while genuinely holding one card records the declaration,
 * so crying UNO on a full hand is pure theatre and leaves you as catchable as
 * before.
 */
export function declareUno(state: UnoState, playerId: string): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };

  const player = state.players[playerIndex];
  const legitimate = player.hand.length === 1;

  let next: UnoState = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex && legitimate ? { ...p, hasDeclaredUno: true } : p,
    ),
    log: [
      ...state.log,
      legitimate
        ? `${player.name} annonce UNO !`
        : `${player.name} crie UNO... avec ${player.hand.length} cartes en main.`,
    ],
  };
  next = bumpEvent(next, { kind: 'uno', by: playerIndex, success: legitimate });
  return { state: next };
}

/**
 * The counter-call. Double-edged on purpose: it only pays off against someone
 * genuinely sitting on one undeclared card, and costs two cards otherwise.
 */
export function contreUno(state: UnoState, playerId: string): ActionResult {
  const callerIndex = state.players.findIndex((p) => p.id === playerId);
  if (callerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };

  const caller = state.players[callerIndex];

  // A catchable target: exactly one card, and no declaration to cover it.
  const targetIndex = state.players.findIndex(
    (p, i) => i !== callerIndex && p.connected && p.hand.length === 1 && !p.hasDeclaredUno,
  );

  if (targetIndex === -1) {
    let next = drawResolved(state, callerIndex, UNO_PENALTY).state;
    next = {
      ...next,
      log: [...next.log, `${caller.name} crie Contre UNO dans le vide : +${UNO_PENALTY} cartes !`],
    };
    next = bumpEvent(next, { kind: 'contre-uno', by: callerIndex, success: false, count: UNO_PENALTY });
    return { state: next };
  }

  let next = drawResolved(state, targetIndex, UNO_PENALTY).state;
  next = {
    ...next,
    log: [
      ...next.log,
      `${caller.name} prend ${next.players[targetIndex].name} en flagrant délit : +${UNO_PENALTY} cartes !`,
    ],
  };
  next = bumpEvent(next, {
    kind: 'contre-uno',
    by: callerIndex,
    target: targetIndex,
    success: true,
    count: UNO_PENALTY,
  });
  return { state: next };
}

export function rematch(state: UnoState): ActionResult {
  if (state.phase !== 'won') return { state, error: "La partie n'est pas terminée." };
  return startGame({ ...state, phase: 'lobby' });
}

export function applyAction(state: UnoState, action: UnoAction): ActionResult {
  switch (action.type) {
    case 'JOIN':
      return { state: addPlayer(state, action.playerId, action.name, action.userId ?? null) };
    case 'SET_OPTIONS':
      return setOptions(state, action.maxPlayers, action.stackingEnabled);
    case 'START':
      return startGame(state);
    case 'PLAY_CARD':
      return playCard(state, action.playerId, action.cardId, action.chosenColor);
    case 'DRAW_CARD':
      return drawCard(state, action.playerId);
    case 'PASS':
      return pass(state, action.playerId);
    case 'DECLARE_UNO':
      return declareUno(state, action.playerId);
    case 'CONTRE_UNO':
      return contreUno(state, action.playerId);
    case 'REMATCH':
      return rematch(state);
    case 'LEAVE': {
      if (state.phase === 'lobby') {
        return { state: { ...state, players: state.players.filter((p) => p.id !== action.playerId) } };
      }
      const leaverIndex = state.players.findIndex((p) => p.id === action.playerId);
      if (leaverIndex === -1) return { state };
      const players = state.players.map((p, i) => (i === leaverIndex ? { ...p, connected: false } : p));
      const next: UnoState = { ...state, players };
      // Never leave the table waiting on someone who is gone.
      if (state.phase === 'playing' && leaverIndex === state.turn) {
        return { state: { ...next, pendingDraw: 0, hasDrawnThisTurn: false, turn: nextSeat(next, 1) } };
      }
      return { state: next };
    }
    default:
      return { state };
  }
}
