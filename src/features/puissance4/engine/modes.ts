import type { P4Mode } from './types';

export interface ModeConfig {
  id: P4Mode;
  label: string;
  tagline: string;
  players: number;
  cols: number;
  rows: number;
  /**
   * Discs each player gets for the whole game. Deliberately short of what it
   * would take to fill their share of the grid: the run is a resource, and the
   * powers scattered through it are what makes spending it a decision.
   */
  discs: number;
  /** Team of each seat, by seat order. Free-for-all gives everyone their own. */
  teams: number[];
  teamNames?: string[];
}

/**
 * Grids grow with the player count: four players on a 7x6 board run out of
 * room before anyone can build a threat, and every drop becomes forced.
 * Seats in `teams` alternate so teammates never play back to back.
 */
export const MODES: Record<P4Mode, ModeConfig> = {
  duel: {
    id: 'duel',
    label: '1 v 1',
    tagline: 'Le duel classique, grille 7 × 6.',
    players: 2,
    cols: 7,
    rows: 6,
    discs: 16,
    teams: [0, 1],
  },
  trio: {
    id: 'trio',
    label: '1 v 1 v 1',
    tagline: 'Trois joueurs, chacun pour soi, grille 9 × 7.',
    players: 3,
    cols: 9,
    rows: 7,
    discs: 14,
    teams: [0, 1, 2],
  },
  quatuor: {
    id: 'quatuor',
    label: '1 v 1 v 1 v 1',
    tagline: 'Quatre joueurs, chacun pour soi, grille 10 × 8.',
    players: 4,
    cols: 10,
    rows: 8,
    discs: 12,
    teams: [0, 1, 2, 3],
  },
  teams: {
    id: 'teams',
    label: '2 v 2',
    tagline: 'Deux équipes, un alignement commun, grille 8 × 7.',
    players: 4,
    cols: 8,
    rows: 7,
    discs: 12,
    teams: [0, 1, 0, 1],
    teamNames: ['Équipe Crema', 'Équipe Menthe'],
  },
};

export const MODE_ORDER: P4Mode[] = ['duel', 'trio', 'quatuor', 'teams'];

/** Free-for-all palette: four hues that stay distinct on the beige board. */
const SOLO_COLORS = ['#e0a33c', '#3f9e8c', '#c8503f', '#8b6bc4'];

/** In 2v2 teammates share a hue family so the alliance is readable at a glance. */
const TEAM_COLORS = ['#e0a33c', '#3f9e8c', '#c2762a', '#2f7d97'];

export function discColor(mode: P4Mode, playerIndex: number): string {
  const palette = mode === 'teams' ? TEAM_COLORS : SOLO_COLORS;
  return palette[playerIndex % palette.length];
}

export function teamColor(mode: P4Mode, team: number): string {
  const seat = MODES[mode].teams.indexOf(team);
  return discColor(mode, seat === -1 ? team : seat);
}
