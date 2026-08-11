export type Suit = 'denari' | 'coppe' | 'spade' | 'bastoni';

export interface CardT {
  id: string;
  suit: Suit;
  rank: number;
}

export interface Player {
  id: string;
  name: string;
  hand: CardT[];
  handCount: number;
  captured: CardT[];
  scope: number;
  connected: boolean;
}

export type GamePhase = 'lobby' | 'playing' | 'hand-end' | 'match-end';

export interface HandScoreDetail {
  playerId: string;
  carte: number;
  denari: number;
  settebello: number;
  primiera: number;
  scope: number;
  total: number;
}

export interface GameState {
  roomCode: string;
  hostId: string;
  players: Player[];
  table: CardT[];
  deck: CardT[];
  turn: number;
  lastCapturedBy: number | null;
  phase: GamePhase;
  matchScores: number[];
  targetScore: number;
  handNumber: number;
  lastHandScore?: HandScoreDetail[];
  log: string[];
}

export type ScopaAction =
  | { type: 'JOIN'; playerId: string; name: string }
  | { type: 'START' }
  | { type: 'PLAY_CARD'; playerId: string; cardId: string; captureCardIds: string[] }
  | { type: 'NEXT_HAND' }
  | { type: 'LEAVE'; playerId: string };
