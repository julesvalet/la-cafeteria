import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboardRank } from '../api';
import { PERIOD_LABELS, type LeaderboardPeriod, type LeaderboardRank } from '../types';

const SHOWN: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly'];

/** Position d'un joueur au classement général, pour chaque période. */
export function RankStrip({ userId }: { userId: string }) {
  const [ranks, setRanks] = useState<Partial<Record<LeaderboardPeriod, LeaderboardRank | null>>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(SHOWN.map((p) => getLeaderboardRank(p, null, userId).catch(() => null))).then((results) => {
      if (cancelled) return;
      setRanks(Object.fromEntries(SHOWN.map((p, i) => [p, results[i]])));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <dl className="acc-stats soc-ranks">
      {SHOWN.map((p) => {
        const r = ranks[p];
        return (
          <div key={p} className="acc-stat">
            <dt>{PERIOD_LABELS[p]}</dt>
            <dd>
              <Link to={`/classements?periode=${p}`} className="soc-rank-link">
                {r === undefined ? '…' : r ? `${r.position}e` : '—'}
              </Link>
              {r && <span className="soc-meta"> / {r.total}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
