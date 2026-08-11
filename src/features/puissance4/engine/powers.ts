import type { PowerId } from './types';

export type PowerTarget = 'column' | 'disc' | 'none';

/** Icons live in `components/powerIcons.ts` so the engine stays React-free. */
export interface PowerDef {
  id: PowerId;
  name: string;
  /** One line for the tooltip. */
  short: string;
  /** Full explanation for the rules modal. */
  long: string;
  /** What the player has to point at after confirming. */
  target: PowerTarget;
  uses: number;
  /**
   * Whether using it ends the turn. Everything costs your turn except the
   * double turn — that is the entire point of it — and the pierce, which *is*
   * your drop rather than a substitute for it.
   */
  endsTurn: boolean;
  /** Accent used by the button and by its signature effect. */
  color: string;
}

export const POWERS: Record<PowerId, PowerDef> = {
  pierce: {
    id: 'pierce',
    name: 'Traversée',
    short: 'Ton jeton traverse la colonne et se glisse tout en bas.',
    long: "Ton jeton ignore les jetons déjà présents : il traverse la colonne et se place dans la ligne du bas. Tout ce qui était dans la colonne remonte d'une case. La colonne doit avoir au moins une case libre.",
    target: 'column',
    uses: 2,
    endsTurn: true,
    color: '#e0a33c',
  },
  destroy: {
    id: 'destroy',
    name: 'Destruction',
    short: 'Pulvérise un jeton adverse, le reste retombe.',
    long: "Choisis un jeton adverse sur le plateau : il est détruit, et tous les jetons au-dessus retombent d'une case. Tu ne peux pas viser tes propres jetons, ni ceux de ton équipe.",
    target: 'disc',
    uses: 1,
    endsTurn: true,
    color: '#c8503f',
  },
  invert: {
    id: 'invert',
    name: 'Inversion de gravité',
    short: 'Une colonne tombe vers le haut, jusqu’à la fin de ton prochain tour.',
    long: "La gravité d'une colonne s'inverse : ses jetons remontent se coller en haut, et les jetons joués dessus se posent sous la pile. L'effet tient un tour de table complet plus ton tour suivant — tu as donc une fois l'occasion d'en profiter — puis la gravité revient et tout retombe d'un coup.",
    target: 'column',
    uses: 1,
    endsTurn: true,
    color: '#8b6bc4',
  },
  double: {
    id: 'double',
    name: 'Double-tour',
    short: "Joue deux jetons d'affilée.",
    long: "Ton tour ne passe pas après ton prochain jeton : tu en joues deux de suite. L'activation est gratuite, elle ne te coûte pas ton tour.",
    target: 'none',
    uses: 1,
    endsTurn: false,
    color: '#3f9e8c',
  },
  block: {
    id: 'block',
    name: 'Blocage de colonne',
    short: 'Condamne une colonne pour un tour de table.',
    long: "Une colonne est verrouillée : personne ne peut y jouer, toi compris, jusqu'à ce que le tour te revienne. Une colonne déjà bloquée ne peut pas l'être une seconde fois.",
    target: 'column',
    uses: 2,
    endsTurn: true,
    color: '#6d7f95',
  },
};

export const POWER_ORDER: PowerId[] = ['pierce', 'destroy', 'invert', 'double', 'block'];

export function initialPowers(): Record<PowerId, number> {
  return {
    pierce: POWERS.pierce.uses,
    destroy: POWERS.destroy.uses,
    invert: POWERS.invert.uses,
    double: POWERS.double.uses,
    block: POWERS.block.uses,
  };
}
