import { findCaptureOptions } from './rules';
import type { CardT, GameState, ScopaAction } from './types';
import { pick, thinkDelay, type BotLevel, type BotMove, type BotSeat } from '../../bots/bots';

/*
 * Le bot de Scopa. Chaque coup possible (une carte, et la prise qu'elle fait
 * ou non) reçoit une note ; le bot joue le mieux noté, avec plus ou moins de
 * bruit selon son niveau.
 */

interface Move {
  card: CardT;
  capture: CardT[];
}

/** Ce que vaut une carte pour la primiera : les 7, puis les 6 et les as. */
const PRIMIERA: Record<number, number> = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 };

const isSettebello = (c: CardT) => c.suit === 'denari' && c.rank === 7;

function cardWorth(c: CardT): number {
  let v = 1; // une carte de plus pour « les cartes »
  if (c.suit === 'denari') v += 0.9;
  if (isSettebello(c)) v += 6;
  v += (PRIMIERA[c.rank] - 10) / 6; // un 7 vaut ~2, un roi ~0
  return v;
}

function legalMoves(state: GameState, seat: number): Move[] {
  const hand = state.players[seat].hand;
  const moves: Move[] = [];
  for (const card of hand) {
    const options = findCaptureOptions(state.table, card.rank);
    for (const capture of options) moves.push({ card, capture });
    moves.push({ card, capture: [] });
  }
  return moves;
}

/**
 * La note d'un coup. Une prise rapporte ce qu'elle ramasse (et beaucoup si
 * elle vide la table) ; une carte posée coûte ce qu'elle offre à l'adversaire
 * — surtout une table qu'il pourrait balayer d'une seule carte.
 */
function score(state: GameState, move: Move, level: BotLevel): number {
  if (move.capture.length > 0) {
    const cleared = move.capture.length === state.table.length;
    let s = 5 + cardWorth(move.card) + move.capture.reduce((sum, c) => sum + cardWorth(c), 0);
    if (cleared) s += 14;
    return s;
  }

  // Ne pas prendre quand on peut : seul le bot facile s'y laisse aller.
  const couldCapture = findCaptureOptions(state.table, move.card.rank).length > 0;
  let s = -cardWorth(move.card);
  if (couldCapture) s -= level === 'hard' ? 20 : 8;

  const table = [...state.table, move.card];
  const sum = table.reduce((t, c) => t + c.rank, 0);
  // Une table dont la somme tient dans une carte se balaie : scopa offerte.
  if (sum <= 10) s -= level === 'hard' ? 9 : 5;
  if (level === 'hard') {
    // Chaque carte de la table qu'une seule carte adverse peut prendre est une
    // prise offerte ; les 7 et les denari encore plus.
    for (const c of table) {
      if (findCaptureOptions(table, c.rank).some((o) => o.length === 1 && o[0].id !== move.card.id)) s -= 0.5;
    }
    if (move.card.rank === 7) s -= 1.5;
  }
  return s;
}

export function scopaBotAction(state: GameState, seat: number, level: BotLevel, random: () => number = Math.random): ScopaAction | null {
  const player = state.players[seat];
  if (!player || player.hand.length === 0) return null;
  const moves = legalMoves(state, seat);
  if (moves.length === 0) return null;

  let chosen: Move;
  if (level === 'easy') {
    // Prend une fois sur deux quand il le peut, joue au hasard sinon.
    const captures = moves.filter((m) => m.capture.length > 0);
    chosen = captures.length > 0 && random() < 0.55 ? pick(captures, random) : pick(moves.filter((m) => m.capture.length === 0), random);
  } else {
    const noise = level === 'normal' ? 2.5 : 0.3;
    const rated = moves.map((m) => ({ m, s: score(state, m, level) + (random() - 0.5) * noise }));
    rated.sort((a, b) => b.s - a.s);
    chosen = rated[0].m;
  }

  return { type: 'PLAY_CARD', playerId: player.id, cardId: chosen.card.id, captureCardIds: chosen.capture.map((c) => c.id) };
}

/** Le pilote : un bot joue quand c'est son tour. */
export function scopaDecide(state: GameState, bots: BotSeat[]): BotMove<ScopaAction> | null {
  if (state.phase !== 'playing') return null;
  const current = state.players[state.turn];
  const bot = bots.find((b) => b.id === current?.id);
  if (!bot) return null;
  const action = scopaBotAction(state, state.turn, bot.level);
  return action ? { action, delay: thinkDelay(bot.level) + 300 } : null;
}
