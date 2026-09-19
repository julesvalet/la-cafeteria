import type { PresenceStatus } from './socialContext';

export const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'En ligne',
  away: 'Absent',
  offline: 'Hors ligne',
};

export const STATUS_HINTS: Record<PresenceStatus, string> = {
  online: 'Tes amis te voient et peuvent te rejoindre.',
  away: 'Visible, mais tes amis savent que tu n’es pas devant l’écran.',
  offline: 'Invisible : tu vois tes amis, eux ne te voient pas.',
};
