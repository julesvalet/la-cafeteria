export type P4Mode = 'duel' | 'trio' | 'quatuor' | 'teams';

export type PowerId = 'pierce' | 'destroy' | 'invert' | 'double' | 'block';

/** A disc keeps a stable id for its whole life so the UI can animate it moving. */
export interface Disc {
  id: string;
  owner: number;
}

export interface P4Player {
  id: string;
  name: string;
  /** Le compte du joueur, pour afficher ses cosmétiques (absent : invité ou bot). */
  userId?: string | null;
  /** Free-for-all modes give everyone their own team, so win checks are uniform. */
  team: number;
  connected: boolean;
  /**
   * The player's remaining discs, in the order they will be played: index 0 is
   * the very next one. A `PowerId` means that disc is charged and will fire
   * when it lands; `null` means it is an ordinary disc. Nobody picks which —
   * the whole run is rolled once at the start of the game.
   *
   * Length doubles as the disc counter, so playing one is just a shift.
   */
  charges: (PowerId | null)[];
}

/** A charged disc has landed and its power is waiting for a target. */
export interface PendingPower {
  power: PowerId;
  by: number;
}

export type ColumnEffectKind = 'blocked' | 'inverted';

export interface ColumnEffect {
  col: number;
  kind: ColumnEffectKind;
  /** Turn advances left before this wears off. */
  turnsLeft: number;
  by: number;
}

export type P4Phase = 'lobby' | 'playing' | 'won' | 'draw';

/**
 * The last thing that happened, for the client to animate. Carries a sequence
 * number because the payload can repeat (same power, same column) and clients
 * need to tell a genuine repeat from a re-render.
 */
export interface P4Event {
  seq: number;
  kind: 'none' | 'drop' | 'power';
  by?: number;
  power?: PowerId;
  col?: number;
  /** Cell index the disc landed in / was destroyed from. */
  cell?: number;
  /** Whether the disc fell against inverted gravity. */
  inverted?: boolean;
}

export interface P4Winner {
  team: number;
  /** Cell indices of the winning alignment. */
  cells: number[];
}

export interface P4State {
  roomCode: string;
  hostId: string;
  mode: P4Mode;
  cols: number;
  rows: number;
  players: P4Player[];
  /** Row-major from the bottom: index = row * cols + col, row 0 is the floor. */
  cells: (Disc | null)[];
  turn: number;
  phase: P4Phase;
  effects: ColumnEffect[];
  /** The player to move owes one more drop before the turn passes. */
  pendingDouble: boolean;
  /** Set while a landed power waits for its target; blocks everything else. */
  pendingPower: PendingPower | null;
  discSeq: number;
  winner: P4Winner | null;
  lastEvent: P4Event;
  log: string[];
}

export type P4Action =
  | { type: 'JOIN'; playerId: string; name: string; userId?: string | null }
  | { type: 'SET_MODE'; mode: P4Mode }
  | { type: 'START' }
  /** Drop the next disc. Whether it is charged is the engine's business. */
  | { type: 'DROP'; playerId: string; col: number }
  /** Aim the power of the disc that just landed. */
  | { type: 'RESOLVE_POWER'; playerId: string; col?: number; cell?: number }
  | { type: 'REMATCH' }
  | { type: 'LEAVE'; playerId: string };
