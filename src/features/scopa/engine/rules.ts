import type { CardT, GameState, HandScoreDetail, Player, ScopaAction } from './types';
import { createDeck, shuffle, RANK_LABEL, SUIT_LABEL } from './deck';

const PRIMIERA_VALUE: Record<number, number> = {
  7: 21,
  6: 18,
  1: 16,
  5: 15,
  4: 14,
  3: 13,
  2: 12,
  8: 10,
  9: 10,
  10: 10,
};

export function createInitialState(roomCode: string, hostId: string): GameState {
  return {
    roomCode,
    hostId,
    players: [],
    table: [],
    deck: [],
    turn: 0,
    lastCapturedBy: null,
    phase: 'lobby',
    matchScores: [],
    targetScore: 11,
    handNumber: 0,
    log: ['Room créée. En attente de joueurs...'],
  };
}

export function addPlayer(state: GameState, id: string, name: string, userId: string | null = null): GameState {
  if (state.players.some((p) => p.id === id)) return state;
  if (state.players.length >= 4 || state.phase !== 'lobby') return state;
  const player: Player = {
    id,
    name: name.trim() || 'Joueur',
    userId,
    hand: [],
    handCount: 0,
    captured: [],
    scope: 0,
    connected: true,
  };
  return {
    ...state,
    players: [...state.players, player],
    matchScores: [...state.matchScores, 0],
    log: [...state.log, `${player.name} a rejoint la partie.`],
  };
}

export function startHand(state: GameState): GameState {
  const deck = shuffle(createDeck());
  const table: CardT[] = [];
  for (let i = 0; i < 4; i++) table.push(deck.pop()!);

  const players = state.players.map((p) => {
    const hand = [deck.pop()!, deck.pop()!, deck.pop()!];
    return { ...p, hand, handCount: hand.length, captured: [], scope: 0 };
  });

  return {
    ...state,
    players,
    table,
    deck,
    turn: 0,
    lastCapturedBy: null,
    phase: 'playing',
    handNumber: state.handNumber + 1,
    lastHandScore: undefined,
    log: [...state.log, `Manche ${state.handNumber + 1} distribuée.`],
  };
}

function subsetsSummingTo(cards: CardT[], target: number): CardT[][] {
  const results: CardT[][] = [];
  const n = cards.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    const combo: CardT[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += cards[i].rank;
        combo.push(cards[i]);
      }
    }
    if (sum === target) results.push(combo);
  }
  return results;
}

/** Cartes uniques ne signifie pas qu'il faut dédupliquer : si deux options
 * capturent exactement les mêmes cartes (même id) elles sont fusionnées. */
export function findCaptureOptions(table: CardT[], rank: number): CardT[][] {
  const all = subsetsSummingTo(table, rank);
  const singles = all.filter((c) => c.length === 1);
  if (singles.length > 0) return singles;
  return all;
}

export interface PlayCardResult {
  state: GameState;
  error?: string;
  scopa?: boolean;
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  captureCardIds: string[],
): PlayCardResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (state.turn !== playerIndex) return { state, error: "Ce n'est pas ton tour." };

  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return { state, error: 'Carte introuvable dans ta main.' };
  const card = player.hand[cardIndex];

  const options = findCaptureOptions(state.table, card.rank);
  let chosenCombo: CardT[] | null = null;

  // A capture is only ever performed when the player explicitly designates one.
  // Playing a card without designating anything simply lays it on the table,
  // even if a capture was mathematically available: spotting captures is the
  // player's job, never the game's.
  if (captureCardIds.length > 0) {
    const found = options.find(
      (opt) => opt.length === captureCardIds.length && opt.every((c) => captureCardIds.includes(c.id)),
    );
    if (!found) return { state, error: 'Capture invalide : cette sélection ne correspond à aucune capture possible.' };
    chosenCombo = found;
  }

  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);

  let newTable = [...state.table];
  let newCaptured = [...player.captured];
  let scopa = false;
  let lastCapturedBy = state.lastCapturedBy;

  if (chosenCombo) {
    const captureIds = new Set(chosenCombo.map((c) => c.id));
    newTable = newTable.filter((c) => !captureIds.has(c.id));
    newCaptured = [...newCaptured, card, ...chosenCombo];
    lastCapturedBy = playerIndex;
    if (newTable.length === 0) scopa = true;
  } else {
    newTable = [...newTable, card];
  }

  const newPlayers = state.players.map((p, i) =>
    i === playerIndex
      ? { ...p, hand: newHand, handCount: newHand.length, captured: newCaptured, scope: p.scope + (scopa ? 1 : 0) }
      : p,
  );

  const action = chosenCombo ? (scopa ? 'fait SCOPA avec' : 'capture avec') : 'joue';

  let nextState: GameState = {
    ...state,
    players: newPlayers,
    table: newTable,
    lastCapturedBy,
    log: [...state.log, `${player.name} ${action} ${RANK_LABEL[card.rank]} de ${SUIT_LABEL[card.suit]}.`],
  };

  nextState = advanceAfterPlay(nextState);

  return { state: nextState, scopa };
}

function nextTurnIndex(state: GameState): number {
  const n = state.players.length;
  return n === 0 ? 0 : (state.turn + 1) % n;
}

function advanceAfterPlay(state: GameState): GameState {
  const allHandsEmpty = state.players.every((p) => p.hand.length === 0);

  if (!allHandsEmpty) {
    return { ...state, turn: nextTurnIndex(state) };
  }

  if (state.deck.length > 0) {
    const deck = [...state.deck];
    const players = state.players.map((p) => {
      const hand = [deck.pop()!, deck.pop()!, deck.pop()!];
      return { ...p, hand, handCount: hand.length };
    });
    return { ...state, deck, players, turn: nextTurnIndex(state) };
  }

  let table = state.table;
  let players = state.players;
  if (table.length > 0 && state.lastCapturedBy !== null) {
    const sweeper = state.lastCapturedBy;
    players = players.map((p, i) => (i === sweeper ? { ...p, captured: [...p.captured, ...table] } : p));
    table = [];
  }

  return scoreHand({ ...state, players, table });
}

export function computeHandScore(state: GameState): HandScoreDetail[] {
  const players = state.players;
  const cardCounts = players.map((p) => p.captured.length);
  const maxCards = Math.max(...cardCounts, 0);
  const cardWinners = cardCounts.filter((c) => c === maxCards).length;

  const denariCounts = players.map((p) => p.captured.filter((c) => c.suit === 'denari').length);
  const maxDenari = Math.max(...denariCounts, 0);
  const denariWinners = denariCounts.filter((c) => c === maxDenari).length;

  const settebelloIndex = players.findIndex((p) => p.captured.some((c) => c.suit === 'denari' && c.rank === 7));

  const primieraScores = players.map((p) => {
    const bySuit: Record<string, number> = {};
    for (const c of p.captured) {
      const v = PRIMIERA_VALUE[c.rank];
      if (!bySuit[c.suit] || v > bySuit[c.suit]) bySuit[c.suit] = v;
    }
    return Object.values(bySuit).reduce((a, b) => a + b, 0);
  });
  const maxPrimiera = Math.max(...primieraScores, 0);
  const primieraWinners = primieraScores.filter((v) => v === maxPrimiera && v > 0).length;

  return players.map((p, i) => {
    const carte = cardWinners === 1 && cardCounts[i] === maxCards ? 1 : 0;
    const denari = denariWinners === 1 && denariCounts[i] === maxDenari && maxDenari > 0 ? 1 : 0;
    const settebello = settebelloIndex === i ? 1 : 0;
    const primiera = primieraWinners === 1 && primieraScores[i] === maxPrimiera ? 1 : 0;
    const scope = p.scope;
    return {
      playerId: p.id,
      carte,
      denari,
      settebello,
      primiera,
      scope,
      total: carte + denari + settebello + primiera + scope,
    };
  });
}

function scoreHand(state: GameState): GameState {
  const details = computeHandScore(state);
  const matchScores = state.matchScores.map((s, i) => s + details[i].total);
  const winnerIndex = matchScores.findIndex((s) => s >= state.targetScore);
  const phase = winnerIndex !== -1 ? 'match-end' : 'hand-end';
  return {
    ...state,
    matchScores,
    phase,
    lastHandScore: details,
    log: [...state.log, 'Fin de la manche : décompte des points.'],
  };
}

export function applyAction(state: GameState, action: ScopaAction): { state: GameState; error?: string } {
  switch (action.type) {
    case 'JOIN':
      return { state: addPlayer(state, action.playerId, action.name, action.userId ?? null) };
    case 'START': {
      if (state.players.length < 2) return { state, error: 'Il faut au moins 2 joueurs pour commencer.' };
      if (state.phase !== 'lobby') return { state, error: 'La partie a déjà commencé.' };
      return { state: startHand(state) };
    }
    case 'PLAY_CARD': {
      const result = playCard(state, action.playerId, action.cardId, action.captureCardIds);
      return { state: result.state, error: result.error };
    }
    case 'NEXT_HAND': {
      if (state.phase !== 'hand-end') return { state, error: 'La manche en cours n\'est pas terminée.' };
      return { state: startHand(state) };
    }
    case 'LEAVE':
      return {
        state: {
          ...state,
          players: state.players.map((p) => (p.id === action.playerId ? { ...p, connected: false } : p)),
        },
      };
    default:
      return { state };
  }
}
