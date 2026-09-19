/**
 * Le niveau d'un joueur, tiré de ses points.
 *
 * Une racine carrée : les premiers niveaux tombent vite (50 points pour le
 * niveau 2, une victoire suffit), les suivants demandent de plus en plus. Rien
 * n'est stocké : le niveau se recalcule à partir des points, qui eux font foi.
 */
export function levelFromPoints(points: number): { level: number; current: number; next: number; ratio: number } {
  const p = Math.max(0, points);
  const level = Math.floor(Math.sqrt(p / 50)) + 1;
  const current = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, current, next, ratio: (p - current) / (next - current) };
}
