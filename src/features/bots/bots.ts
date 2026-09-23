/*
 * Les bots, communs à tous les jeux.
 *
 * Une partie contre des bots n'ouvre aucune connexion : le navigateur tient
 * seul la table, comme l'hôte d'une partie en ligne, et joue pour les bots
 * avec le même moteur que tout le monde. Seule la décision (quel coup jouer)
 * est propre à chaque jeu : voir `ai.ts` dans chaque dossier de jeu.
 */

export type BotLevel = 'easy' | 'normal' | 'hard';
/** « Aléatoire » : chaque bot tire son niveau en secret. */
export type BotChoice = BotLevel | 'random';

export interface BotSetup {
  count: number;
  level: BotChoice;
}

export interface BotSeat {
  id: string;
  name: string;
  level: BotLevel;
}

export const BOT_CHOICES: { id: BotChoice; label: string; hint: string }[] = [
  { id: 'easy', label: 'Facile', hint: 'Joue un peu au hasard.' },
  { id: 'normal', label: 'Normal', hint: 'Voit les coups évidents.' },
  { id: 'hard', label: 'Difficile', hint: 'Calcule, et ne pardonne rien.' },
  { id: 'random', label: 'Aléatoire', hint: 'Chaque bot tire son niveau en secret.' },
];

export const BOT_LEVEL_LABELS: Record<BotLevel, string> = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' };

const NAMES = ['Moka', 'Nova', 'Paco', 'Zazie', 'Rex', 'Lulu', 'Bravo', 'Kiki'];
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard'];

/** Le joueur humain d'une table locale. */
export const LOCAL_SELF_ID = 'moi';
const BOT_PREFIX = 'bot-';

export const isBotId = (id: string | null | undefined): boolean => Boolean(id?.startsWith(BOT_PREFIX));

export function makeBots(setup: BotSetup, random: () => number = Math.random): BotSeat[] {
  const names = [...NAMES].sort(() => random() - 0.5);
  return Array.from({ length: setup.count }, (_, i) => ({
    id: `${BOT_PREFIX}${i + 1}`,
    name: names[i],
    level: setup.level === 'random' ? LEVELS[Math.floor(random() * LEVELS.length)] : setup.level,
  }));
}

/** Le code d'une table locale : il n'est jamais partagé, il sert aux clés de partie. */
export function botRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BOT';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export const isBotRoomCode = (code: string) => /^BOT[A-Z0-9]{5}$/i.test(code);

/**
 * Un dé rejouable : même graine, même tirage. Le pilote des bots redécide à
 * chaque changement d'état ; sans ça, un bot « distrait » relancerait sa
 * chance d'oublier UNO à chaque carte jouée par un autre.
 */
export function roll(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function pick<T>(items: T[], random: () => number = Math.random): T {
  return items[Math.floor(random() * items.length)];
}

/** Le temps de « réfléchir » : assez pour suivre le coup, pas assez pour s'ennuyer. */
export function thinkDelay(level: BotLevel, random: () => number = Math.random): number {
  const base = level === 'easy' ? 900 : level === 'normal' ? 800 : 700;
  return base + Math.floor(random() * 500);
}

export interface BotMove<A> {
  action: A;
  delay: number;
}

/**
 * Le pilote : après chaque coup, redemande au jeu si un bot doit jouer, et
 * joue pour lui après un délai. Un nouveau coup (d'un humain) annule le
 * précédent calcul, qui repart de l'état à jour.
 */
export function createBotRunner<S, A>(opts: {
  get: () => S | null;
  apply: (action: A) => void;
  decide: (state: S) => BotMove<A> | null;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    poke() {
      clearTimeout(timer);
      const s = opts.get();
      if (!s) return;
      const move = opts.decide(s);
      if (move) timer = setTimeout(() => opts.apply(move.action), move.delay);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}
