import { canDrop, discAt, dropDisc, isBlocked, isInverted, resolvePower } from './rules';
import type { P4Action, P4State } from './types';
import { pick, thinkDelay, type BotLevel, type BotMove, type BotSeat } from '../../bots/bots';

/*
 * Le bot de Puissance 4, pour la Forge comme pour le Classique : chaque coup
 * (colonne, puis cible du pouvoir s'il y en a un) est simulé avec le vrai
 * moteur, puis noté. Gagner d'abord, empêcher l'adversaire de gagner ensuite,
 * et sinon construire des alignements — plus finement selon le niveau.
 */

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

const teamOf = (s: P4State, owner: number) => s.players[owner]?.team ?? owner;

/** La valeur d'une position pour une équipe : ses fenêtres de 4 ouvertes, moins celles des autres. */
function evaluate(s: P4State, team: number): number {
  const weights = [0, 1, 5, 40];
  let total = 0;
  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      for (const [dr, dc] of DIRS) {
        const endR = row + dr * 3;
        const endC = col + dc * 3;
        if (endR < 0 || endR >= s.rows || endC < 0 || endC >= s.cols) continue;
        let mine = 0;
        let theirs = 0;
        const other = new Set<number>();
        for (let k = 0; k < 4; k++) {
          const d = discAt(s, row + dr * k, col + dc * k);
          if (!d) continue;
          if (teamOf(s, d.owner) === team) mine++;
          else {
            theirs++;
            other.add(teamOf(s, d.owner));
          }
        }
        if (mine > 0 && theirs === 0) total += weights[mine] ?? 0;
        else if (theirs > 0 && mine === 0 && other.size === 1) total -= (weights[theirs] ?? 0) * 1.2;
      }
    }
  }
  // Le centre compte plus que les bords.
  const center = (s.cols - 1) / 2;
  for (let col = 0; col < s.cols; col++) {
    for (let row = 0; row < s.rows; row++) {
      const d = discAt(s, row, col);
      if (d && teamOf(s, d.owner) === team) total += (center - Math.abs(col - center)) * 0.3;
    }
  }
  return total;
}

/** Combien de coups gagnants immédiats les adversaires de `team` auraient-ils ? */
function threats(s: P4State, team: number): number {
  if (s.phase !== 'playing') return 0;
  let count = 0;
  s.players.forEach((p, i) => {
    if (p.team === team || !p.connected || p.charges.length === 0) return;
    const asThem: P4State = { ...s, turn: i, pendingPower: null, pendingDouble: false };
    for (let col = 0; col < s.cols; col++) {
      if (!canDrop(asThem, col)) continue;
      const r = dropDisc(asThem, p.id, col);
      if (!r.error && r.state.phase === 'won' && r.state.winner?.team === p.team) count++;
    }
  });
  return count;
}

function rateOutcome(next: P4State, team: number, level: BotLevel): number {
  if (next.phase === 'won') return next.winner?.team === team ? 10_000 : -10_000;
  if (next.phase === 'draw') return 0;
  const danger = level === 'easy' ? 0 : threats(next, team);
  return -danger * 800 + (level === 'hard' ? evaluate(next, team) : evaluate(next, team) * 0.5);
}

function dropMove(s: P4State, seat: number, level: BotLevel, random: () => number): P4Action | null {
  const me = s.players[seat];
  const cols = Array.from({ length: s.cols }, (_, c) => c).filter((c) => canDrop(s, c));
  if (cols.length === 0) return null;

  const rated = cols.map((col) => {
    const r = dropDisc(s, me.id, col);
    return { col, s: r.error ? -Infinity : rateOutcome(r.state, me.team, level) };
  });

  if (level === 'easy') {
    const win = rated.find((x) => x.s >= 10_000);
    if (win && random() < 0.6) return { type: 'DROP', playerId: me.id, col: win.col };
    return { type: 'DROP', playerId: me.id, col: pick(cols, random) };
  }
  const noise = level === 'normal' ? 6 : 0.5;
  rated.forEach((x) => (x.s += (random() - 0.5) * noise));
  rated.sort((a, b) => b.s - a.s);
  return { type: 'DROP', playerId: me.id, col: rated[0].col };
}

function powerMove(s: P4State, seat: number, level: BotLevel, random: () => number): P4Action | null {
  const pending = s.pendingPower;
  const me = s.players[seat];
  if (!pending) return null;

  const targets: { col?: number; cell?: number }[] = [];
  if (pending.power === 'destroy') {
    s.cells.forEach((d, cell) => {
      if (d && teamOf(s, d.owner) !== me.team) targets.push({ cell });
    });
  } else if (pending.power === 'invert') {
    for (let col = 0; col < s.cols; col++) if (!isInverted(s, col)) targets.push({ col });
  } else if (pending.power === 'block') {
    for (let col = 0; col < s.cols; col++) if (!isBlocked(s, col)) targets.push({ col });
  }
  if (targets.length === 0) return null;

  const action = (t: { col?: number; cell?: number }): P4Action => ({ type: 'RESOLVE_POWER', playerId: me.id, ...t });
  if (level === 'easy') return action(pick(targets, random));

  const noise = level === 'normal' ? 6 : 0.5;
  const rated = targets.map((t) => {
    const r = resolvePower(s, me.id, t);
    return { t, s: (r.error ? -Infinity : rateOutcome(r.state, me.team, level)) + (random() - 0.5) * noise };
  });
  rated.sort((a, b) => b.s - a.s);
  return action(rated[0].t);
}

export function p4BotAction(s: P4State, seat: number, level: BotLevel, random: () => number = Math.random): P4Action | null {
  if (s.pendingPower) return s.pendingPower.by === seat ? powerMove(s, seat, level, random) : null;
  return dropMove(s, seat, level, random);
}

export function p4Decide(state: P4State, bots: BotSeat[]): BotMove<P4Action> | null {
  if (state.phase !== 'playing') return null;
  const seat = state.pendingPower ? state.pendingPower.by : state.turn;
  const bot = bots.find((b) => b.id === state.players[seat]?.id);
  if (!bot) return null;
  const action = p4BotAction(state, seat, bot.level);
  return action ? { action, delay: thinkDelay(bot.level) - (state.pendingPower ? 200 : 0) } : null;
}
