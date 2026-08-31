import { Spade, Grid3x3, Disc, Layers } from 'lucide-react';
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
 * The roster — playable features only. A planet with no game behind it was
 * costing the composition more than the promise was worth.
 *
 * To ship a planet: add its route to `App.tsx`, then set `to` here. Everything
 * else (grey-out, "bientôt disponible", click handling) follows from that.
 *
 * Placement, in both compositions, is a balance of three things: no two discs
 * may overlap, a label hangs ~0.1 half-heights *below* its planet and must
 * clear whatever is under it, and the HUD owns the top centre while the hint
 * owns the very bottom. Watch the units — `screen.x` is in half-*widths* and
 * `size` is a fraction of the half-*height*, so a horizontal gap is worth
 * `aspect` times what the same number buys vertically. That is why the
 * portrait arrangement stacks rather than spreads.
 */
export const PLANETS: PlanetDef[] = [
  {
    id: 'scopa',
    name: 'Scopa',
    description: 'Le jeu de cartes italien, à 2, 3 ou 4 joueurs. Crée une room ou rejoins-en une avec un code.',
    icon: Spade,
    to: '/scopa',
    // Anchors the left flank on wide screens; the centre of the stack on phones.
    landscape: { screen: [-0.6, -0.1], size: 0.27 },
    portrait: { screen: [0, -0.08], size: 0.165 },
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
    // Upper right, kept below the HUD block rather than beside it.
    landscape: { screen: [0.32, 0.28], size: 0.17 },
    portrait: { screen: [-0.44, 0.4], size: 0.105 },
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
    /*
     * Proximity to Puissance 4 is the only thing saying "moon", so it has to
     * stay that planet's nearest neighbour at *every* aspect ratio — and that
     * is why it sits above Puissance 4 rather than below.
     *
     * A horizontal gap is worth `spreadX` times a vertical one, so an offset
     * that reads as tight on a laptop stretches on an ultrawide: park the moon
     * between Puissance 4 and UNO and it drifts into UNO's orbit on wide
     * screens. Placing it on the far side, with UNO's whole height between
     * them, holds the relationship however the window is shaped.
     */
    landscape: { screen: [0.62, 0.42], size: 0.075 },
    portrait: { screen: [-0.04, 0.6], size: 0.052 },
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
    // Lower right, closing the triangle — and high enough that its label
    // clears the "choisis une planète" hint pinned to the bottom edge.
    landscape: { screen: [0.52, -0.44], size: 0.16 },
    portrait: { screen: [0, -0.62], size: 0.115 },
    depth: -0.5,
    // The deck itself: red body, yellow highs, a blue accent.
    colors: { deep: '#1a0d0d', mid: '#d8232a', high: '#f4c500', accent: '#0a6cb8' },
    seed: 8.5,
    noiseScale: 3,
    bands: 0,
    tilt: 0.28,
    spin: 0.058,
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
