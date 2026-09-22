import type { PowerId } from './types';

export type PowerTarget = 'column' | 'disc' | 'none';

/** Icons live in `components/powerIcons.ts` so the engine stays React-free. */
export interface PowerDef {
  id: PowerId;
  name: string;
  /** One line, for the next-disc badge and the board hint. */
  short: string;
  /** Full explanation for the rules modal. */
  long: string;
  /**
   * What the player has to point at *after* the charged disc lands. Powers that
   * ride the drop itself need nothing and resolve on the spot.
   */
  target: PowerTarget;
  /** Relative chance of turning up when a player's run is rolled. */
  weight: number;
  /** Accent used by the badge and by the power's signature effect. */
  color: string;
}

/**
 * Note what each power needs once its disc has landed:
 *  - `pierce` changes where that very disc comes to rest, so it resolves during
 *    the drop and asks for nothing.
 *  - `double` is immediate too — it simply does not pass the turn.
 *  - the other three need a target, and only then does a picker appear.
 */
export const POWERS: Record<PowerId, PowerDef> = {
  pierce: {
    id: 'pierce',
    name: 'Traversée',
    short: 'Ce jeton traversera la colonne et se glissera tout en bas.',
    long: "Le jeton ignore ceux déjà présents : il traverse la colonne et se place dans la ligne du bas, tout le reste de la colonne remontant d'une case. Tu choisis ta colonne normalement, l'effet est automatique.",
    target: 'none',
    weight: 3,
    color: '#ffc53d',
  },
  destroy: {
    id: 'destroy',
    name: 'Destruction',
    short: 'À son atterrissage, tu pulvériseras un jeton adverse.',
    long: "Dès que le jeton se pose, on te demande de désigner un jeton adverse : il est pulvérisé, et tout ce qui reposait dessus retombe d'une case. Tu ne peux viser ni tes jetons, ni ceux de ton équipe. S'il n'y a aucune cible sur le plateau, le pouvoir se perd.",
    target: 'disc',
    weight: 2,
    color: '#ff3d6e',
  },
  invert: {
    id: 'invert',
    name: 'Inversion de gravité',
    short: 'À son atterrissage, tu inverseras la gravité d’une colonne.',
    long: "Dès que le jeton se pose, tu désignes une colonne : ses jetons remontent se coller en haut, et ceux joués dessus se posent sous la pile. Au bout d'un tour de table complet la gravité revient et tout retombe — ce qui peut compléter un alignement.",
    target: 'column',
    weight: 2,
    color: '#b45cff',
  },
  double: {
    id: 'double',
    name: 'Double-tour',
    short: 'Tu rejoueras aussitôt après ce jeton.',
    long: "Ton tour ne passe pas : tu enchaînes immédiatement avec le jeton suivant. Si celui-là est chargé lui aussi, son pouvoir part dans la foulée.",
    target: 'none',
    weight: 2,
    color: '#29f1ff',
  },
  block: {
    id: 'block',
    name: 'Blocage de colonne',
    short: 'À son atterrissage, tu condamneras une colonne.',
    long: "Dès que le jeton se pose, tu désignes une colonne : elle est verrouillée et personne ne peut y jouer, toi compris, jusqu'à ce que le tour te revienne. Une colonne déjà bloquée ne peut pas l'être une seconde fois.",
    target: 'column',
    weight: 3,
    color: '#9aa7b8',
  },
};

export const POWER_ORDER: PowerId[] = ['pierce', 'destroy', 'invert', 'double', 'block'];

/** Share of a player's run that carries a power. Kept low on purpose. */
export const CHARGED_RATIO = 0.28;

/** So no run ever leans on a single power. */
export const MAX_PER_POWER = 2;

/**
 * Rolls one player's whole run: the discs they will play, in order, a minority
 * of which carry a power. Called once at the start of a game, by the host only,
 * so `Math.random` here is safe — the result is part of the broadcast state.
 */
export function rollCharges(discs: number, random: () => number = Math.random): (PowerId | null)[] {
  const run: (PowerId | null)[] = Array(discs).fill(null);

  const base = Math.round(discs * CHARGED_RATIO);
  const jitter = Math.floor(random() * 3) - 1; // -1, 0 or +1
  const wanted = Math.max(2, Math.min(discs, base + jitter));

  // Shuffle the slots, then fill the first `wanted` of them.
  const slots = run.map((_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const taken: Partial<Record<PowerId, number>> = {};
  let placed = 0;

  for (const slot of slots) {
    if (placed >= wanted) break;
    const pool = POWER_ORDER.filter((id) => (taken[id] ?? 0) < MAX_PER_POWER);
    if (pool.length === 0) break;

    const total = pool.reduce((sum, id) => sum + POWERS[id].weight, 0);
    let ticket = random() * total;
    const chosen = pool.find((id) => (ticket -= POWERS[id].weight) < 0) ?? pool[pool.length - 1];

    run[slot] = chosen;
    taken[chosen] = (taken[chosen] ?? 0) + 1;
    placed++;
  }

  return run;
}
