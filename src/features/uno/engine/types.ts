export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';

export type UnoKind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' | 'mystery';

/** `color` is null only for wild, wild4 and mystery — the three colorless kinds. */
export interface UnoCard {
  id: string;
  kind: UnoKind;
  color: UnoColor | null;
  /** 0-9, only meaningful for `kind: 'number'`. */
  number?: number;
}

export interface UnoPlayer {
  id: string;
  name: string;
  /** Le compte du joueur, pour afficher ses cosmétiques (absent : invité ou bot). */
  userId?: string | null;
  hand: UnoCard[];
  /**
   * Kept in lockstep with `hand.length` even when `hand` itself is masked to
   * `[]` for everyone but its owner — otherwise the room could never show how
   * many cards an opponent is holding.
   */
  handCount: number;
  connected: boolean;
  /** True once this player has clicked "UNO" while sitting on exactly one card. */
  hasDeclaredUno: boolean;
}

export type UnoPhase = 'lobby' | 'playing' | 'won';

export type UnoMysteryEffect = 'draw10' | 'draw8' | 'colorChangeDraw2' | 'reverseColorChange' | 'swapHands';

/**
 * The last thing that happened, for clients to animate and announce. Carries
 * a sequence number because the payload can repeat (two draws in a row) and
 * clients need to tell a genuine repeat from a re-render.
 */
export interface UnoEvent {
  seq: number;
  kind: 'none' | 'play' | 'draw' | 'penalty' | 'mystery' | 'uno' | 'contre-uno';
  by?: number;
  cardId?: string;
  count?: number;
  effect?: UnoMysteryEffect;
  target?: number;
  success?: boolean;
}

export interface UnoState {
  roomCode: string;
  hostId: string;
  maxPlayers: number;
  stackingEnabled: boolean;
  /** Decided when the game starts: off in a 1v1, since there is no one to surprise. */
  mysteryEnabled: boolean;
  players: UnoPlayer[];
  deck: UnoCard[];
  discard: UnoCard[];
  /** The colour a card must match — the card's own colour, or the last chosen wild colour. */
  activeColor: UnoColor;
  direction: 1 | -1;
  turn: number;
  phase: UnoPhase;
  /** Cards owed by whoever's turn it is next, accumulated while stacking is on. */
  pendingDraw: number;
  /** Whether the player to move has already drawn their one voluntary card this turn. */
  hasDrawnThisTurn: boolean;
  winner: number | null;
  lastEvent: UnoEvent;
  log: string[];
}

export type UnoAction =
  | { type: 'JOIN'; playerId: string; name: string; userId?: string | null }
  | { type: 'SET_OPTIONS'; maxPlayers: number; stackingEnabled: boolean }
  | { type: 'START' }
  | { type: 'PLAY_CARD'; playerId: string; cardId: string; chosenColor?: UnoColor }
  | { type: 'DRAW_CARD'; playerId: string }
  | { type: 'PASS'; playerId: string }
  | { type: 'DECLARE_UNO'; playerId: string }
  | { type: 'CONTRE_UNO'; playerId: string }
  | { type: 'REMATCH' }
  | { type: 'LEAVE'; playerId: string };
