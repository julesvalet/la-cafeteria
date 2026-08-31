import { Spade, Grid3x3, Disc, Layers, Skull, MessageCircle, Gamepad2, Lightbulb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PlanetRing {
  inner: number;
  outer: number;
  color: string;
  opacity: number;
}

export interface PlanetPlacement {
  /** Screen position. x in half-widths, y in half-heights, both -1..1, 0 centred. */
  screen: [number, number];
  /** Apparent radius, as a fraction of the viewport half-height. */
  size: number;
}

export interface PlanetDef {
  id: string;
  name: string;
  /** Shown on the card fallback, and under the planet name on hover. */
  description: string;
  icon: LucideIcon;
  /** Route to fly to. Absent means the planet is not playable yet. */
  to?: string;
  /** Composition on wide screens, and the taller arrangement for phones. */
  landscape: PlanetPlacement;
  portrait: PlanetPlacement;
  /**
   * World-space z offset. Pure parallax: apparent size and screen position are
   * both compensated for depth, so this only changes how the planet drifts
   * against the others as the camera leans.
   */
  depth: number;
  /** Surface palette, from the deepest lows to the brightest highs. */
  colors: { deep: string; mid: string; high: string; accent: string };
  /** Noise seed + frequency: the surface identity of the planet. */
  seed: number;
  noiseScale: number;
  /** > 0 turns the surface into horizontal bands (gas giant look). */
  bands: number;
  /** Radians of axial tilt. */
  tilt: number;
  /** Radians per second. Kept low on purpose — this should feel calm. */
  spin: number;
  ring?: PlanetRing;
}

/**
 * The roster. Order matters only for the fallback grid and for tab order.
 *
 * To ship a planet: add its route to `App.tsx`, then set `to` here. Everything
 * else (grey-out, "bientôt disponible", click handling) follows from that.
 */
export const PLANETS: PlanetDef[] = [
  {
    id: 'scopa',
    name: 'Scopa',
    description: 'Le jeu de cartes italien, à 2, 3 ou 4 joueurs. Crée une room ou rejoins-en une avec un code.',
    icon: Spade,
    to: '/scopa',
    landscape: { screen: [0, -0.16], size: 0.295 },
    portrait: { screen: [0, -0.2], size: 0.2 },
    depth: 1.2,
    // The house planet: roasted coffee lows, crema mids, foam highs.
    colors: { deep: '#2e1c10', mid: '#a97844', high: '#f0d9b6', accent: '#c9975e' },
    seed: 1.7,
    noiseScale: 2.1,
    bands: 0,
    tilt: 0.22,
    spin: 0.055,
  },
  {
    id: 'puissance4',
    name: 'Puissance 4',
    description:
      'Aligne quatre jetons avant tes adversaires. Avec des pouvoirs spéciaux, de 2 à 4 joueurs, en équipes ou chacun pour soi.',
    icon: Grid3x3,
    to: '/puissance4',
    landscape: { screen: [-0.6, 0.2], size: 0.15 },
    portrait: { screen: [-0.62, 0.3], size: 0.105 },
    depth: -1,
    // Blue board, yellow and red counters.
    colors: { deep: '#0b1a4a', mid: '#2f57c4', high: '#f2c63c', accent: '#e2523c' },
    seed: 3.2,
    noiseScale: 3.4,
    bands: 0,
    tilt: -0.3,
    spin: 0.045,
  },
  {
    id: 'puissance4-original',
    name: 'Original',
    description:
      'Le Puissance 4 classique, sans pouvoirs : aligne 4 jetons sur une grille 7 × 6, à 2, 3 ou 4 joueurs.',
    icon: Disc,
    to: '/puissance4-original',
    // A small moon in orbit of Puissance 4, up and to its right.
    landscape: { screen: [-0.44, 0.34], size: 0.07 },
    portrait: { screen: [-0.4, 0.13], size: 0.055 },
    depth: -0.75,
    // A plain grey moonrock — deliberately calmer than its flashy neighbour.
    colors: { deep: '#28262a', mid: '#706e76', high: '#dcdadf', accent: '#9694a0' },
    seed: 7.8,
    noiseScale: 2.6,
    bands: 0,
    tilt: 0.15,
    spin: 0.05,
  },
  {
    id: 'uno',
    name: 'UNO',
    description:
      'Débarrasse-toi de toutes tes cartes. Avec cartes mystère, surenchère des + et le duel UNO / Contre UNO, de 2 à 4 joueurs.',
    icon: Layers,
    to: '/uno',
    // The left flank, clear of both Puissance 4 above and Le Salon below.
    landscape: { screen: [-0.85, -0.14], size: 0.115 },
    portrait: { screen: [0.58, -0.02], size: 0.085 },
    depth: -0.5,
    // The deck itself: red body, yellow highs, a blue accent.
    colors: { deep: '#1a0d0d', mid: '#d8232a', high: '#f4c500', accent: '#0a6cb8' },
    seed: 8.5,
    noiseScale: 3,
    bands: 0,
    tilt: 0.28,
    spin: 0.058,
  },
  {
    id: 'buckshot',
    name: 'Buckshot Roulette',
    description: 'Roulette russe au fusil à pompe. Bluff, comptage de balles, et beaucoup de sang-froid.',
    icon: Skull,
    landscape: { screen: [0.58, 0.16], size: 0.155 },
    portrait: { screen: [0.6, 0.48], size: 0.11 },
    depth: -1.4,
    // Gunmetal crust, dried blood, ember cracks.
    colors: { deep: '#100c0b', mid: '#54211c', high: '#c23a25', accent: '#e04a2c' },
    seed: 5.4,
    noiseScale: 2.7,
    bands: 0,
    tilt: 0.45,
    spin: 0.038,
  },
  {
    id: 'salon',
    name: 'Le Salon',
    description: 'Un espace de discussion pour papoter entre potes, sans quitter La Cafétéria.',
    icon: MessageCircle,
    landscape: { screen: [-0.64, -0.56], size: 0.12 },
    portrait: { screen: [-0.58, -0.6], size: 0.09 },
    depth: -0.3,
    // Calm sage/teal, like a mint tea.
    colors: { deep: '#08312e', mid: '#2f8375', high: '#b6e8d3', accent: '#4fc7a8' },
    seed: 6.9,
    noiseScale: 2.4,
    bands: 0,
    tilt: -0.16,
    spin: 0.05,
  },
  {
    id: 'flipper',
    name: 'Le Flipper',
    description: "Un mini-jeu d'arcade rapide à partager en attendant que tout le monde arrive.",
    icon: Gamepad2,
    landscape: { screen: [0.62, -0.54], size: 0.125 },
    portrait: { screen: [0.56, -0.54], size: 0.085 },
    depth: -0.7,
    // Neon arcade cabinet: violet body, magenta lights.
    colors: { deep: '#240c40', mid: '#8836bd', high: '#ff9ae8', accent: '#c25af0' },
    seed: 2.3,
    noiseScale: 1.9,
    bands: 7,
    tilt: 0.38,
    spin: 0.07,
    ring: { inner: 1.45, outer: 2.25, color: '#d98ae8', opacity: 0.5 },
  },
  {
    id: 'idees',
    name: 'La Boîte à Idées',
    description: 'Propose et vote pour la prochaine soirée, le prochain jeu, ou le prochain café.',
    icon: Lightbulb,
    landscape: { screen: [0.8, 0.58], size: 0.08 },
    // Kept off the left column: stacked under Puissance 4, its label ran into
    // that planet. Horizontal separation is what buys the label its room.
    portrait: { screen: [-0.14, 0.6], size: 0.07 },
    depth: -2.4,
    // A filament about to switch on.
    colors: { deep: '#3d2705', mid: '#c1841a', high: '#ffe9a3', accent: '#f7bb2b' },
    seed: 4.6,
    noiseScale: 2.9,
    bands: 0,
    tilt: -0.5,
    spin: 0.06,
  },
];

export interface PlanetLayout {
  id: string;
  position: [number, number, number];
  radius: number;
}

export interface SceneLayout {
  planets: PlanetLayout[];
  cameraZ: number;
}

const FOV = 45;
const TAN_HALF_FOV = Math.tan((FOV * Math.PI) / 180 / 2);

/** Fixed: with screen-space placement, this only sets how strong perspective is. */
const CAMERA_Z = 13;

/** Past this, spreading further just scatters the constellation on ultrawides. */
const MAX_SPREAD = 1.9;

/**
 * Turns the authored screen positions into world coordinates.
 *
 * Placing in screen space and converting is what keeps the composition honest:
 * a planet's apparent size and position would otherwise both drift with its
 * depth, which is exactly how a far planet ends up hidden behind a near one.
 */
export function computeLayout(aspect: number): SceneLayout {
  const portrait = aspect < 1;
  const spreadX = Math.min(aspect, MAX_SPREAD);

  const planets = PLANETS.map((p) => {
    const place = portrait ? p.portrait : p.landscape;
    // Half-height of the frustum at this planet's depth.
    const halfH = (CAMERA_Z - p.depth) * TAN_HALF_FOV;

    return {
      id: p.id,
      position: [place.screen[0] * halfH * spreadX, place.screen[1] * halfH, p.depth] as [
        number,
        number,
        number,
      ],
      radius: place.size * halfH,
    };
  });

  return { planets, cameraZ: CAMERA_Z };
}

export const CAMERA_FOV = FOV;
