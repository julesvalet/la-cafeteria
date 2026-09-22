/*
 * Roulette de Vérité — le modèle de données.
 *
 * Comme pour les autres jeux, l'hôte tient l'état complet et le fait évoluer
 * par `applyAction` (rules.ts), sans React ni réseau. Les autres reçoivent une
 * version masquée : ni la pioche, ni les questions perso des autres joueurs.
 */

export type VeriteTheme = 'clean' | 'normal' | 'hard';

export const THEMES: VeriteTheme[] = ['clean', 'normal', 'hard'];

export interface VeriteQuestion {
  id: string;
  text: string;
  theme: VeriteTheme;
  /** base : la banque du jeu · private : ajoutée pour cette partie · public : le pool partagé en base. */
  source: 'base' | 'private' | 'public';
  /** Qui l'a ajoutée (questions perso). */
  byId?: string;
  byName?: string;
}

export interface VeritePlayer {
  id: string;
  name: string;
  connected: boolean;
  /** Réponses validées par le chef. */
  score: number;
  /** Nombre de fois où la bouteille l'a désigné : sert à répartir les tours. */
  turns: number;
}

/**
 * Une manche : la bouteille tourne, la carte se retourne, le joueur répond,
 * le chef tranche.
 *
 * `spinning` → `reveal` → `answering` sont cadencés par l'hôte (minuteries),
 * pour que tout le monde voie la carte se retourner au même moment.
 */
export type RoundStage = 'spinning' | 'reveal' | 'answering' | 'judging' | 'verdict';

export interface VeriteRound {
  /** Numéro de manche, à partir de 1. */
  seq: number;
  /** Incrémenté quand le chef change de question : relance l'animation de la carte. */
  draw: number;
  targetId: string;
  /** Les joueurs autour de la bouteille au moment du lancer, dans l'ordre du cercle. */
  ring: string[];
  /** Angle absolu de la bouteille, en degrés (cumulé d'une manche à l'autre). */
  angle: number;
  question: VeriteQuestion;
  stage: RoundStage;
  answer: string | null;
  verdict: boolean | null;
  /** Le joueur désigné est parti avant la fin : manche annulée. */
  voided: boolean;
}

export interface RoundRecord {
  seq: number;
  targetId: string;
  targetName: string;
  question: string;
  theme: VeriteTheme;
  answer: string | null;
  verdict: boolean | null;
}

export type VeritePhase = 'lobby' | 'playing' | 'ended';

export interface VeriteState {
  roomCode: string;
  hostId: string;
  /** Participants au total, chef compris. */
  maxPlayers: number;
  phase: VeritePhase;
  theme: VeriteTheme;
  /** Nombre de manches ; 0 = partie libre, jusqu'à ce que le chef arrête. */
  rounds: number;
  chefId: string | null;
  players: VeritePlayer[];
  /** Questions perso de la partie (privées ou déjà publiées). */
  customs: VeriteQuestion[];
  /** Questions publiques tirées de la base au lancement. Hôte seulement. */
  publicPool: VeriteQuestion[];
  /** Pioches restantes par thème. Hôte seulement. */
  decks: Record<VeriteTheme, VeriteQuestion[]>;
  /** Graine du tirage (mulberry32). Hôte seulement. */
  seed: number;
  round: VeriteRound | null;
  history: RoundRecord[];
}

export type VeriteAction =
  | { type: 'JOIN'; playerId: string; name: string }
  | { type: 'LEAVE'; playerId: string }
  | { type: 'SET_OPTIONS'; playerId: string; theme: VeriteTheme; rounds: number }
  | { type: 'SET_CHEF'; playerId: string; chefId: string }
  | { type: 'RANDOM_CHEF'; playerId: string }
  | { type: 'ADD_CUSTOM'; playerId: string; text: string; theme: VeriteTheme; publicId?: string }
  | { type: 'REMOVE_CUSTOM'; playerId: string; questionId: string }
  | { type: 'START'; playerId: string; publicPool?: VeriteQuestion[] }
  | { type: 'ADVANCE'; seq: number; draw: number; to: 'reveal' | 'answering' }
  | { type: 'ANSWER'; playerId: string; text: string }
  | { type: 'VERDICT'; playerId: string; valid: boolean }
  | { type: 'REDRAW'; playerId: string }
  | { type: 'SPIN'; playerId: string }
  | { type: 'END'; playerId: string }
  | { type: 'REMATCH'; playerId: string };

export interface ActionResult {
  state: VeriteState;
  error?: string;
}
