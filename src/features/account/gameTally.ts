import { useRef } from 'react';
import type { GameOutcome } from './recordGame';

export type TallyKey =
  | 'scopas'
  | 'scopa_streak'
  | 'special_cards'
  | 'early_stays'
  | 'zero_stays'
  | 'answered'
  | 'valid_answers'
  | 'answer_streak'
  | 'streak_clean'
  | 'streak_normal'
  | 'streak_hard'
  | 'custom_validated'
  | 'chef_complete';

/**
 * Les compteurs d'une partie, pour les trophées (scopas, cartes spéciales…).
 *
 * Comptés pendant le rendu, et non dans un effet : le dernier coup d'une
 * partie — la carte spéciale qui la termine — doit être compté avant que
 * l'issue ne parte en base, ce qui se joue dans le même rendu. Chaque
 * événement est identifié (numéro de séquence, ou valeur déjà vue), donc un
 * rendu répété (StrictMode) ne compte jamais deux fois.
 *
 * Remise à zéro quand une nouvelle partie commence : on entre en jeu depuis
 * le salon d'attente ou depuis l'écran de fin (revanche).
 */
export function useGameTally(phase: string | undefined, endPhases: string[]) {
  const ref = useRef({
    counts: {} as Partial<Record<TallyKey, number>>,
    phase: undefined as string | undefined,
    seq: -1,
    trackKey: '',
    trackValue: 0,
  });
  const t = ref.current;

  if (phase !== t.phase) {
    const fresh = phase === 'playing' && (t.phase === undefined || t.phase === 'lobby' || endPhases.includes(t.phase));
    if (fresh) {
      t.counts = {};
      t.trackKey = '';
      t.trackValue = 0;
    }
    t.phase = phase;
  }

  return {
    /** Un événement numéroté : `decide` dit s'il compte, et pour quoi. */
    event(seq: number, decide: () => TallyKey | null) {
      if (seq <= t.seq) return;
      t.seq = seq;
      const key = decide();
      if (key) t.counts[key] = (t.counts[key] ?? 0) + 1;
    },
    /**
     * Une valeur qui ne fait que monter tant que `scope` ne change pas (les
     * scopas d'une manche) : on compte ce qui s'y ajoute.
     */
    track(scope: string, value: number, key: TallyKey) {
      const delta = scope === t.trackKey ? value - t.trackValue : value;
      if (delta > 0) t.counts[key] = (t.counts[key] ?? 0) + delta;
      t.trackKey = scope;
      t.trackValue = value;
    },
    /** Un record de la partie (meilleure série) : on garde le plus haut. */
    max(key: TallyKey, value: number) {
      if (value > (t.counts[key] ?? 0)) t.counts[key] = value;
    },
    counts: t.counts,
  };
}

/** L'issue d'une partie, avec ses compteurs. */
export function withTally(outcome: GameOutcome | null, counts: Partial<Record<TallyKey, number>>): GameOutcome | null {
  return outcome ? { ...outcome, details: { ...counts } } : null;
}
