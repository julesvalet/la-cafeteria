/**
 * Shared mutable state for the cinematic dive. It lives in a ref rather than
 * React state on purpose: the camera writes to it every frame, and planets and
 * labels read it every frame. Routing it through `useState` would re-render the
 * whole scene at 60fps.
 */
export interface FlightState {
  /** Planet being dived into, or null when idle. */
  id: string | null;
  /** Eased progress, 0 → 1. */
  t: number;
}

export const FLIGHT_DURATION = 1500;

/** Overlay starts covering the screen here, so the cut lands at full white. */
export const FLASH_AT = 0.78;

/**
 * Frame-rate independent exponential smoothing. `lambda` is roughly "how many
 * e-folds per second"; higher is snappier.
 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Descent curve, applied to *log* distance rather than position — the Google
 * Earth trick. Interpolating the exponent means the planet's apparent size
 * grows at a steady perceptual rate instead of sitting still and then snapping,
 * and the mild ease-in on top of it is what reads as "the camera accelerates".
 */
export function easeDive(t: number): number {
  return Math.pow(clamp01(t), 1.4);
}

/** Lateral settle (where the camera is looking) wants a symmetric curve. */
export function easeAim(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}
