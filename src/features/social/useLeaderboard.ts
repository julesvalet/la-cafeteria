import { useEffect, useState } from 'react';
import { accountsEnabled } from '../../lib/supabase';
import type { GameTypeId, LeaderboardRow } from '../account/types';
import * as api from './api';
import type { LeaderboardPeriod, LeaderboardRank } from './types';

/**
 * Un classement et, pour un joueur connecté, sa propre place.
 *
 * La position personnelle vient d'une seconde requête plutôt que d'une
 * recherche dans les lignes affichées : 142e d'un classement coupé à cent,
 * le joueur n'y figurerait pas, et c'est précisément là qu'il veut savoir où
 * il en est.
 */
export function useLeaderboard(
  period: LeaderboardPeriod,
  gameType: GameTypeId | null,
  userId: string | null,
  limit = 100,
) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [mine, setMine] = useState<LeaderboardRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountsEnabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getLeaderboard(period, gameType, limit),
      userId ? api.getLeaderboardRank(period, gameType, userId) : Promise.resolve(null),
    ])
      .then(([board, rank]) => {
        if (cancelled) return;
        setRows(board);
        setMine(rank);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Classement indisponible.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period, gameType, userId, limit]);

  return { rows, mine, loading, error };
}
