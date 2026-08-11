import { ArrowDownToLine, ArrowUpDown, Bomb, Lock, Repeat2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PowerId } from '../engine/types';

/** Kept out of the engine so the rules stay importable without React. */
export const POWER_ICONS: Record<PowerId, LucideIcon> = {
  pierce: ArrowDownToLine,
  destroy: Bomb,
  invert: ArrowUpDown,
  double: Repeat2,
  block: Lock,
};
