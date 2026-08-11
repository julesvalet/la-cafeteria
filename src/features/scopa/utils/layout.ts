/** Fan-out transform for a card at `index` among `total` cards held in a hand. */
export function fanTransform(index: number, total: number, spread = 34, tilt = 6) {
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

/** Deterministic pseudo-random scatter offset for a table card, seeded by its id. */
export function scatterTransform(id: string) {
  const h = hashString(id);
  const angle = (h % 360) * (Math.PI / 180);
  const radiusSeed = (h >> 8) % 100;
  const rotSeed = (h >> 16) % 100;
  const radius = 14 + (radiusSeed / 100) * 44;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.5,
    rotate: -14 + (rotSeed / 100) * 28,
  };
}
