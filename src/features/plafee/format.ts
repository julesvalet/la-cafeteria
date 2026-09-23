import { GAME_LABELS } from '../account/types';
import type { PlafeeEvent } from './api';

const NUMBER = new Intl.NumberFormat('fr-FR');

/** 1 234 567 : les montants de FEES, en français. */
export const formatFees = (n: number) => NUMBER.format(n);

/** La phrase d'objectif d'un événement : « Gagne 10 parties de Flip 7 ». */
export function objectiveText(e: Pick<PlafeeEvent, 'objective_type' | 'objective_value' | 'game'>): string {
  const game = e.game ? ` de ${GAME_LABELS[e.game] ?? e.game}` : '';
  if (e.objective_type === 'victories') return `Gagne ${e.objective_value} partie${e.objective_value > 1 ? 's' : ''}${game}`;
  if (e.objective_type === 'games') return `Joue ${e.objective_value} partie${e.objective_value > 1 ? 's' : ''}${game}`;
  return `Tous ensemble : ${e.objective_value.toLocaleString('fr-FR')} parties${game}`;
}

/** Progression affichée : la sienne, ou celle de la communauté pour un objectif commun. */
export function eventProgress(e: PlafeeEvent): { value: number; goal: number } {
  const value = e.objective_type === 'global_target' ? e.global_progress : (e.my_progress ?? 0);
  return { value: Math.min(value, e.objective_value), goal: e.objective_value };
}
