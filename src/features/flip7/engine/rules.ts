import { cardLabel, createDeck, shuffle } from './deck';
import type { Card, GameOptions, GameState, Player, PlayerAction, PublicState } from './types';

const freshPlayer = (id: string, name: string, bot = false): Player => ({
  id, name: name.trim().slice(0, 18) || 'Joueur', bot, connected: true, cards: [],
  status: 'active', total: 0, roundPoints: 0, variantPoints: 0, skip: false, chanceUsed: false,
});
export const numbers = (p: Player) => p.cards.filter(c => c.kind === 'number').map(c => c.value);
export const hasChance = (p: Player) => p.cards.some(c => c.kind === 'chance');
export function points(p: Player, ruleset: GameOptions['ruleset']): number {
  if (p.status === 'busted' || p.status === 'left') return 0;
  if (ruleset === 'cafeteria') return p.variantPoints;
  const ns = numbers(p);
  return ns.reduce((a, b) => a + b, 0) * (p.cards.some(c => c.kind === 'double') ? 2 : 1)
    + p.cards.filter(c => c.kind === 'bonus').reduce((a, c) => a + c.value, 0) + (ns.length === 7 ? 15 : 0);
}

export function createGame(code: string, hostId: string, name: string, options: GameOptions, random = Math.random): GameState {
  const normalized = { ...options, maxPlayers: options.mode === 'solo' ? 1 : Math.max(2, Math.min(options.mode === 'bots' ? 4 : 5, options.maxPlayers)) };
  const players = [freshPlayer(hostId, name)];
  if (options.mode === 'bots') {
    for (let i = 1; i < normalized.maxPlayers; i++) players.push(freshPlayer(`bot-${i}`, ['Moka', 'Nova', 'Paco'][i - 1], true));
  }
  return { id: `${code}-${Math.floor(random() * 1e12)}`, code, hostId, options: normalized,
    phase: 'lobby', players, deck: shuffle(createDeck(options.ruleset), random), discard: [], spent: [],
    round: 0, dealer: 0, turn: 0, queue: [], pending: null, revision: 0,
    lastEvent: { seq: 0, kind: 'ready', text: 'La table vous attend.' }, chat: [], winnerId: null };
}

function event(s: GameState, kind: GameState['lastEvent']['kind'], text: string, by?: number, card?: Card) {
  s.lastEvent = { seq: s.lastEvent.seq + 1, kind, text, by, card };
}
const active = (s: GameState) => s.players.map((p, i) => p.connected && p.status === 'active' ? i : -1).filter(i => i >= 0);
export function targetSeats(s: Pick<GameState, 'players' | 'pending'>): number[] {
  if (!s.pending) return [];
  return s.players.flatMap((p, i) => p.connected && p.status === 'active'
    && (s.pending!.card.kind !== 'chance' || !hasChance(p)) ? [i] : []);
}
function endRound(s: GameState) {
  s.pending = null; s.queue = [];
  s.players.forEach(p => { p.roundPoints = points(p, s.options.ruleset); p.total += p.roundPoints; if (p.status === 'active') p.status = 'stayed'; });
  const ranked = s.players.filter(p => p.connected).sort((a, b) => b.total - a.total);
  const winner = s.options.mode !== 'solo' && s.options.ruleset === 'official' && ranked[0]?.total >= 200
    && ranked[0]?.total !== ranked[1]?.total ? ranked[0] : null;
  s.winnerId = winner?.id ?? null;
  s.phase = winner ? 'finished' : 'roundOver';
}
function advance(s: GameState) {
  if (!active(s).length) { endRound(s); return; }
  for (let i = 1; i <= s.players.length * 2; i++) {
    const seat = (s.turn + i) % s.players.length;
    const p = s.players[seat];
    if (!p.connected || p.status !== 'active') continue;
    if (p.skip) { p.skip = false; continue; }
    s.turn = seat; return;
  }
}
function normalize(s: GameState) {
  if (s.phase !== 'playing') return;
  if (!active(s).length) { endRound(s); return; }
  if (s.pending && !targetSeats(s).length) s.pending = null;
  if (!s.pending && !s.queue.length && s.players[s.turn].status !== 'active') advance(s);
}
function beginRound(s: GameState) {
  s.discard.push(...s.spent); s.spent = [];
  s.players.forEach(p => {
    s.discard.push(...p.cards); p.cards = []; p.roundPoints = 0; p.variantPoints = 0;
    p.skip = false; p.chanceUsed = false; p.status = p.connected ? 'active' : 'left';
  });
  s.round++; s.phase = 'playing'; s.turn = s.dealer; s.pending = null; s.queue = [];
  if (s.players[s.turn].status !== 'active') advance(s);
  if (s.options.ruleset === 'official') {
    for (let i = 0; i < s.players.length; i++) {
      const seat = (s.dealer + i) % s.players.length;
      if (s.players[seat].connected) s.queue.push({ kind: 'draw', seat, remaining: 1, forced: false, after: [] });
    }
  }
  event(s, 'round', `Manche ${s.round} · Que la chance soit avec vous.`);
}
function resolveTarget(s: GameState, seat: number) {
  const pending = s.pending!; s.pending = null;
  const p = s.players[seat];
  if (pending.card.kind === 'freeze') {
    p.status = 'frozen'; event(s, 'freeze', `${p.name} est gelé·e : ${points(p, s.options.ruleset)} points sécurisés.`, seat, pending.card);
  } else if (pending.card.kind === 'flip3') {
    s.queue.unshift({ kind: 'draw', seat, remaining: 3, forced: true, after: [] });
    event(s, 'target', `${p.name} doit retourner trois cartes.`, seat, pending.card);
  } else {
    // Duplicate Second Chance cards live in the discard while targeting.
    s.discard = s.discard.filter(c => c.id !== pending.card.id);
    p.cards.push(pending.card);
    event(s, 'saved', `${p.name} reçoit une seconde chance.`, seat, pending.card);
  }
  normalize(s);
}
function requestTarget(s: GameState, card: Card, by: number) {
  s.pending = { card, by };
  const seats = targetSeats(s);
  if (seats.length === 1) resolveTarget(s, seats[0]);
  else if (!seats.length) s.pending = null;
}
function draw(s: GameState, seat: number, random: () => number, forcedJob?: Extract<GameState['queue'][number], { kind: 'draw' }>) {
  if (!s.deck.length) { s.deck = shuffle(s.discard, random); s.discard = []; }
  const card = s.deck.pop();
  if (!card) { endRound(s); return; }
  const p = s.players[seat];
  const official = s.options.ruleset === 'official';
  event(s, 'draw', `${p.name} retourne ${cardLabel(card)}.`, seat, card);
  if (card.kind === 'number') {
    if (numbers(p).includes(card.value)) {
      s.discard.push(card);
      if (hasChance(p) && (official || !p.chanceUsed)) {
        const chance = p.cards.find(c => c.kind === 'chance')!;
        p.cards = p.cards.filter(c => c.id !== chance.id); s.discard.push(chance); p.chanceUsed = true;
        if (!official) { s.discard.push(...p.cards); p.cards = []; p.variantPoints = 0; }
        event(s, 'saved', official ? `${p.name} évite le doublon !` : `${p.name} recommence avec sa seconde chance.`, seat, card);
      } else {
        p.status = 'busted'; p.variantPoints = 0;
        event(s, 'bust', `Doublon ! ${p.name} perd les points de la manche.`, seat, card);
      }
    } else {
      p.cards.push(card); p.variantPoints += card.value;
      if (official && numbers(p).length === 7) {
        event(s, 'flip7', `FLIP 7 ! ${p.name} gagne 15 points bonus.`, seat, card); endRound(s);
      }
    }
  } else if (card.kind === 'bonus' || card.kind === 'double') {
    p.cards.push(card);
    p.variantPoints = card.kind === 'double' ? p.variantPoints * 2 : p.variantPoints + card.value;
  } else if (card.kind === 'chance' && !hasChance(p) && (official || !p.chanceUsed)) {
    p.cards.push(card);
  } else {
    if (official && card.kind !== 'chance') s.spent.push(card);
    else s.discard.push(card);
    if (!official) {
      if (card.kind === 'flip3') p.variantPoints = Math.max(0, p.variantPoints - 3);
      if (card.kind === 'freeze') { p.skip = true; event(s, 'freeze', `${p.name} passe sa prochaine occasion de jouer.`, seat, card); advance(s); }
    } else if (forcedJob && card.kind !== 'chance') forcedJob.after.push(card);
    else requestTarget(s, card, seat);
  }
}

/** Runs one forced/deal step only, so every real card receives its own reveal animation. */
export function tick(input: GameState, random = Math.random): GameState {
  if (input.phase !== 'playing' || input.pending || !input.queue.length) return input;
  const s = structuredClone(input); s.revision++;
  const job = s.queue.shift()!;
  if (s.players[job.seat].status !== 'active' || !s.players[job.seat].connected) { normalize(s); return s; }
  if (job.kind === 'effect') requestTarget(s, job.card, job.seat);
  else {
    draw(s, job.seat, random, job.forced ? job : undefined);
    job.remaining--;
    if (s.phase === 'playing' && s.players[job.seat].status === 'active') {
      if (job.remaining > 0) s.queue.unshift(job);
      else s.queue.unshift(...job.after.map(card => ({ kind: 'effect' as const, seat: job.seat, card })));
    }
  }
  normalize(s); return s;
}

export function applyAction(input: GameState, actor: string, action: PlayerAction, random = Math.random): { state: GameState; error?: string } {
  const fail = (error: string) => ({ state: input, error });
  const seat = input.players.findIndex(p => p.id === actor);
  if (action.type === 'JOIN') {
    if (seat >= 0) return { state: input };
    if (input.phase !== 'lobby') return fail('Cette partie a déjà commencé.');
    if (input.players.length >= input.options.maxPlayers) return fail('Cette table est complète.');
    if (typeof action.name !== 'string' || !action.name.trim()) return fail('Choisis un pseudo.');
    const s = structuredClone(input); s.players.push(freshPlayer(actor, action.name)); s.revision++; return { state: s };
  }
  if (seat < 0 || !input.players[seat].connected) return fail('Rejoins la table avant de jouer.');
  if (action.type === 'CHAT') {
    if (typeof action.text !== 'string' || !action.text.trim() || action.text.length > 300) return fail('Message vide ou trop long (300 caractères maximum).');
    const s = structuredClone(input);
    s.chat = [...s.chat, { id: (s.chat.at(-1)?.id ?? 0) + 1, playerId: actor, name: s.players[seat].name, text: action.text.trim(), time: Date.now() }].slice(-100);
    // Chat does not change the game revision or restart a reveal timer.
    return { state: s };
  }
  const s = structuredClone(input); s.revision++;
  if (action.type === 'START' || action.type === 'NEXT_ROUND' || action.type === 'REMATCH') {
    if (actor !== input.hostId) return fail('Seul l’hôte peut lancer la manche.');
    if (action.type === 'START' && input.phase !== 'lobby') return fail('La partie est déjà lancée.');
    if (action.type === 'NEXT_ROUND' && input.phase !== 'roundOver') return fail('La manche est encore en cours.');
    if (action.type === 'REMATCH' && input.phase !== 'finished') return fail('La partie est encore en cours.');
    if (input.options.mode !== 'solo' && input.players.filter(p => p.connected).length < 2) return fail('Il faut au moins deux joueurs connectés.');
    if (action.type === 'START' && input.players.length !== input.options.maxPlayers) return fail(`Il faut ${input.options.maxPlayers} joueurs pour commencer.`);
    if (action.type === 'NEXT_ROUND') s.dealer = (s.dealer + 1) % s.players.length;
    if (action.type === 'REMATCH') {
      s.id = `${s.code}-${Math.floor(random() * 1e12)}`; s.round = 0; s.dealer = 0; s.winnerId = null;
      s.players = s.players.filter(p => p.connected).map(p => freshPlayer(p.id, p.name, p.bot));
      s.deck = shuffle(createDeck(s.options.ruleset), random); s.discard = []; s.spent = [];
    }
    beginRound(s); return { state: s };
  }
  if (input.phase !== 'playing') return fail('Aucune manche en cours.');
  if (action.type === 'TARGET') {
    if (!s.pending || s.pending.by !== seat) return fail('Ce choix appartient à un autre joueur.');
    const target = s.players.findIndex(p => p.id === action.targetId);
    if (!targetSeats(s).includes(target)) return fail('Choisis un joueur encore actif.');
    resolveTarget(s, target); return { state: s };
  }
  if (s.pending || s.queue.length) return fail('Les cartes spéciales doivent être résolues.');
  if (seat !== s.turn || s.players[seat].status !== 'active') return fail('Ce n’est pas ton tour.');
  if (action.type === 'STAY') {
    if (!s.players[seat].cards.length && s.options.ruleset === 'official') return fail('Retourne au moins une carte.');
    s.players[seat].status = 'stayed';
    event(s, 'stay', `${s.players[seat].name} sécurise ${points(s.players[seat], s.options.ruleset)} points.`, seat); advance(s);
  } else if (action.type === 'HIT') {
    draw(s, seat, random);
    if (s.phase === 'playing' && s.options.ruleset === 'official') advance(s);
    else normalize(s);
  } else return fail('Action inconnue.');
  normalize(s); return { state: s };
}

export function leave(input: GameState, actor: string): GameState {
  const s = structuredClone(input); const i = s.players.findIndex(p => p.id === actor);
  if (i < 0) return input;
  if (s.phase === 'lobby') s.players.splice(i, 1);
  else {
    const p = s.players[i]; p.connected = false; p.status = 'left';
    if (s.pending?.by === i) s.pending = null;
    event(s, 'leave', `${p.name} a quitté la table.`, i);
    normalize(s);
  }
  s.revision++; return s;
}

export function duplicateRisk(s: GameState, seat: number): number {
  const pool = s.deck.length ? s.deck : s.discard;
  const ns = numbers(s.players[seat]);
  return pool.length ? pool.filter(c => c.kind === 'number' && ns.includes(c.value)).length / pool.length : 0;
}
export function publicState(s: GameState): PublicState {
  const { deck, queue, ...visible } = s;
  return { ...structuredClone(visible), deckCount: deck.length, automatic: queue.length > 0,
    risk: s.players.map((_, i) => duplicateRisk(s, i)) };
}

export function botAction(s: GameState, seat: number, random = Math.random): PlayerAction {
  if (s.pending) {
    const seats = targetSeats(s);
    const sorted = seats.sort((a, b) => (s.players[b].total + points(s.players[b], s.options.ruleset)) - (s.players[a].total + points(s.players[a], s.options.ruleset)));
    const choice = s.pending.card.kind === 'chance' ? sorted.at(-1)! : sorted.find(i => i !== seat) ?? seat;
    return { type: 'TARGET', targetId: s.players[choice].id };
  }
  const p = s.players[seat]; const score = points(p, s.options.ruleset);
  if (!p.cards.length || (hasChance(p) && s.options.difficulty === 'hard')) return { type: 'HIT' };
  const hit = s.options.difficulty === 'easy' ? random() < .5 : s.options.difficulty === 'medium'
    ? score < 10 || (score <= 20 && random() < .6) : duplicateRisk(s, seat) < .3;
  return { type: hit ? 'HIT' : 'STAY' };
}
