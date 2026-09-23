import { canPlay } from './rules';
import type { UnoAction, UnoCard, UnoColor, UnoState } from './types';
import { pick, roll, thinkDelay, type BotLevel, type BotMove, type BotSeat } from '../../bots/bots';

/*
 * Le bot d'UNO : quelle carte poser, quelle couleur annoncer, et les cris.
 * Il annonce UNO (le facile l'oublie parfois) et prend en flagrant délit un
 * joueur qui oublie le sien (plus ou moins vite selon son niveau).
 */

const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
const isColorless = (c: UnoCard) => c.color === null;

/** La couleur la plus présente dans ce qui reste en main. */
function bestColor(hand: UnoCard[], random: () => number): UnoColor {
  const counts = new Map<UnoColor, number>();
  for (const c of hand) if (c.color) counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? pick(COLORS, random);
}

/** Le prochain joueur à jouer après `seat`, dans le sens du jeu. */
function nextSeat(state: UnoState, seat: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (((seat + state.direction * step) % n) + n) % n;
    if (state.players[i]?.connected) return i;
  }
  return seat;
}

function rate(card: UnoCard, state: UnoState, seat: number, level: BotLevel): number {
  const hand = state.players[seat].hand;
  const nextCount = state.players[nextSeat(state, seat)]?.handCount ?? 7;
  const sameColor = card.color ? hand.filter((c) => c.color === card.color).length : 0;
  let s = 0;
  if (card.kind === 'number') s += 2 + (card.number ?? 0) / 10;
  if (card.kind === 'skip' || card.kind === 'reverse') s += 2.5;
  if (card.kind === 'draw2') s += 2;
  // Les jokers se gardent pour quand on est coincé…
  if (isColorless(card)) s -= level === 'hard' ? 3 : 1.5;
  // …sauf quand l'adversaire va sortir : alors on l'attaque.
  if (level === 'hard' && nextCount <= 2 && (card.kind === 'draw2' || card.kind === 'wild4' || card.kind === 'skip')) s += 8;
  // Rester sur une couleur qu'on a en nombre.
  s += sameColor * (level === 'hard' ? 0.6 : 0.3);
  return s;
}

export function unoTurnAction(state: UnoState, seat: number, level: BotLevel, random: () => number = Math.random): UnoAction | null {
  const player = state.players[seat];
  if (!player) return null;
  const playable = player.hand.filter((c) => canPlay(state, c));

  if (playable.length === 0) {
    if (state.pendingDraw > 0 || !state.hasDrawnThisTurn) return { type: 'DRAW_CARD', playerId: player.id };
    return { type: 'PASS', playerId: player.id };
  }

  // Une pile de +2/+4 : le facile encaisse parfois alors qu'il pourrait renvoyer.
  if (state.pendingDraw > 0 && level === 'easy' && random() < 0.4) return { type: 'DRAW_CARD', playerId: player.id };

  let card: UnoCard;
  if (level === 'easy') card = pick(playable, random);
  else {
    const noise = level === 'normal' ? 1.5 : 0.2;
    card = playable
      .map((c) => ({ c, s: rate(c, state, seat, level) + (random() - 0.5) * noise }))
      .sort((a, b) => b.s - a.s)[0].c;
  }

  const rest = player.hand.filter((c) => c.id !== card.id);
  return {
    type: 'PLAY_CARD',
    playerId: player.id,
    cardId: card.id,
    chosenColor: isColorless(card) ? (level === 'easy' ? pick(COLORS, random) : bestColor(rest, random)) : undefined,
  };
}

/** Réflexes : une chance d'annoncer UNO, une chance de prendre l'autre en faute. */
const UNO_MEMORY: Record<BotLevel, number> = { easy: 0.6, normal: 0.9, hard: 1 };
const CATCH_REFLEX: Record<BotLevel, number> = { easy: 0.3, normal: 0.65, hard: 0.95 };
const CATCH_DELAY: Record<BotLevel, number> = { easy: 3200, normal: 2400, hard: 1600 };

export function unoDecide(state: UnoState, bots: BotSeat[]): BotMove<UnoAction> | null {
  if (state.phase !== 'playing') return null;
  const seq = state.lastEvent.seq;

  // 1. Un bot sur sa dernière carte annonce UNO — s'il y pense.
  for (const bot of bots) {
    const p = state.players.find((x) => x.id === bot.id);
    if (p && p.hand.length === 1 && !p.hasDeclaredUno && roll(`uno:${bot.id}:${seq}`) < UNO_MEMORY[bot.level]) {
      return { action: { type: 'DECLARE_UNO', playerId: bot.id }, delay: 450 };
    }
  }

  // 2. Quelqu'un d'autre sur une carte, sans l'avoir annoncé : contre-UNO.
  const caught = state.players.some((p) => p.connected && p.hand.length === 1 && !p.hasDeclaredUno);
  if (caught) {
    const hunter = bots.find((b) => {
      const p = state.players.find((x) => x.id === b.id);
      const target = state.players.find((x) => x.id !== b.id && x.connected && x.hand.length === 1 && !x.hasDeclaredUno);
      return p && target && roll(`contre:${b.id}:${seq}`) < CATCH_REFLEX[b.level];
    });
    if (hunter) return { action: { type: 'CONTRE_UNO', playerId: hunter.id }, delay: CATCH_DELAY[hunter.level] };
  }

  // 3. Le tour d'un bot.
  const current = state.players[state.turn];
  const bot = bots.find((b) => b.id === current?.id);
  if (!bot) return null;
  const action = unoTurnAction(state, state.turn, bot.level);
  return action ? { action, delay: thinkDelay(bot.level) } : null;
}
