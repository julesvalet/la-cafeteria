export type CardKind = 'number' | 'bonus' | 'double' | 'flip3' | 'freeze' | 'chance';
export interface Card { id: string; kind: CardKind; value: number }
export type Ruleset = 'official' | 'cafeteria';
/** « random » : chaque bot tire son niveau à la création de la table. */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'random';
export type BotSkill = Exclude<Difficulty, 'random'>;
export type GameMode = 'online' | 'bots' | 'solo';
export interface Player {
  id: string; name: string; bot: boolean; connected: boolean;
  /** Le compte du joueur, pour afficher ses cosmétiques (absent : invité ou bot). */
  userId?: string | null;

  /** Le niveau d'un bot (absent pour un humain). */
  level?: BotSkill;
  cards: Card[]; status: 'active' | 'stayed' | 'busted' | 'frozen' | 'left';
  total: number; roundPoints: number; variantPoints: number;
  skip: boolean; chanceUsed: boolean;
}
export interface GameOptions { mode: GameMode; maxPlayers: number; difficulty: Difficulty; ruleset: Ruleset }
export interface ChatMessage { id: number; playerId: string; name: string; text: string; time: number }
export interface GameEvent {
  seq: number; kind: 'ready' | 'draw' | 'bust' | 'saved' | 'freeze' | 'flip7' | 'stay' | 'round' | 'target' | 'leave';
  text: string; by?: number; card?: Card;
}
export type Job = { kind: 'draw'; seat: number; remaining: number; forced: boolean; after: Card[] }
  | { kind: 'effect'; seat: number; card: Card };
export interface GameState {
  id: string; code: string; hostId: string; options: GameOptions;
  phase: 'lobby' | 'playing' | 'roundOver' | 'finished';
  players: Player[]; deck: Card[]; discard: Card[]; spent: Card[]; round: number; dealer: number; turn: number;
  queue: Job[]; pending: { by: number; card: Card } | null;
  revision: number; lastEvent: GameEvent; chat: ChatMessage[]; winnerId: string | null;
}
export type PublicState = Omit<GameState, 'deck' | 'queue'> & { deckCount: number; automatic: boolean; risk: number[] };
export type PlayerAction =
  | { type: 'JOIN'; name: string; userId?: string | null }
  | { type: 'START' | 'NEXT_ROUND' | 'REMATCH' | 'HIT' | 'STAY' }
  | { type: 'TARGET'; targetId: string }
  | { type: 'CHAT'; text: string };
export interface Envelope { action: PlayerAction; revision: number; requestId: string }
