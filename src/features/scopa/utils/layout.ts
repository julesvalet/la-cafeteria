/** Fan-out transform for a card at `index` among `total` cards held in a hand. */
export function fanTransform(index: number, total: number, spread = 58, tilt = 9) {
  const mid = (total - 1) / 2;
  const offset = index - mid;
  return {
    rotate: offset * tilt,
    x: offset * spread,
    y: offset * offset * 1.4,
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Small deterministic pseudo-random jitter for a table card, seeded by its id.
 * Cards are laid out in a flowing grid (flexbox); this only nudges each card a
 * few pixels/degrees for a "dropped by hand" feel — never enough to overlap
 * a neighbour given the grid's gap.
 */
export function scatterTransform(id: string) {
  const h = hashString(id);
  const angleSeed = (h % 100) / 100;
  const radiusSeed = ((h >> 8) % 100) / 100;
  const rotSeed = ((h >> 16) % 100) / 100;
  const angle = angleSeed * Math.PI * 2;
  const radius = 2 + radiusSeed * 5;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    rotate: -7 + rotSeed * 14,
  };
}

/** Scale factor applied to table cards so a crowded table shrinks instead of overlapping. */
export function tableCardScale(count: number): number {
  if (count <= 4) return 1;
  if (count <= 6) return 0.9;
  if (count <= 8) return 0.8;
  if (count <= 10) return 0.72;
  return 0.64;
}

/**
 * Scale factor for the player's own hand: shrinks cards a little once there
 * are enough of them that the fan spread would otherwise start overlapping
 * within the available width, instead of tightening the spread.
 */
export function handCardScale(count: number): number {
  if (count <= 3) return 1;
  if (count <= 5) return 0.9;
  if (count <= 7) return 0.8;
  return 0.7;
}
