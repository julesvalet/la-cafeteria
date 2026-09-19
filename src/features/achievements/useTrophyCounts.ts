import { useEffect, useState } from 'react';
import { getAchievementCounts } from './api';

/** Nombre de trophées de chaque joueur affiché, relu quand la liste change. */
export function useTrophyCounts(userIds: string[]): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const key = userIds.join(',');
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    getAchievementCounts(key.split(','))
      .then((m) => {
        if (!cancelled) setCounts(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);
  return counts;
}
