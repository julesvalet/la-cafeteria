import { Link } from 'react-router-dom';
import { Medal } from 'lucide-react';
import { AccBanner } from '../../account/components/AccBanner';
import { GAME_LABELS, type GameTypeId, type LeaderboardRow } from '../../account/types';
import { winRate } from '../format';
import { UserAvatar } from './UserAvatar';
import { LEADERBOARD_GAMES, PERIODS, PERIOD_LABELS, type LeaderboardPeriod, type LeaderboardRank } from '../types';

/** Les trois premières places : une médaille en icône, teintée or, argent, bronze. */
function Position({ position }: { position: number }) {
  if (position <= 3) {
    return (
      <span className="soc-medal" data-rank={position} aria-label={`${position}${position === 1 ? 're' : 'e'} place`}>
        <Medal size={18} aria-hidden />
      </span>
    );
  }
  return <span className="soc-pos">{position}</span>;
}

/** Les onglets de période et le choix du jeu. Contrôlés : l'état vit dans la page, et dans l'URL. */
export function LeaderboardFilters({
  period,
  gameType,
  onPeriod,
  onGame,
}: {
  period: LeaderboardPeriod;
  gameType: GameTypeId | null;
  onPeriod: (p: LeaderboardPeriod) => void;
  onGame: (g: GameTypeId | null) => void;
}) {
  return (
    <div className="soc-lb-filters">
      <div className="soc-tabs" role="group" aria-label="Période">
        {PERIODS.map((p) => (
          <button key={p} type="button" className="soc-tab" aria-pressed={p === period} onClick={() => onPeriod(p)}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <label className="soc-select-wrap">
        <span className="soc-sr-only">Jeu</span>
        <select
          className="neon-input soc-select"
          value={gameType ?? ''}
          onChange={(e) => onGame((e.target.value || null) as GameTypeId | null)}
        >
          {LEADERBOARD_GAMES.map((g) => (
            <option key={g ?? 'all'} value={g ?? ''}>
              {g ? GAME_LABELS[g] : 'Tous les jeux'}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function LeaderboardTable({
  rows,
  mine,
  selfId,
  loading,
  error,
  compact = false,
}: {
  rows: LeaderboardRow[];
  mine: LeaderboardRank | null;
  selfId: string | null;
  loading: boolean;
  error: string | null;
  /** Version courte pour le tableau de bord : sans colonnes secondaires. */
  compact?: boolean;
}) {
  if (error) return <AccBanner tone="error">{error}</AccBanner>;

  if (!loading && rows.length === 0) {
    return <p className="soc-empty">Personne n'a encore marqué de points sur cette période. La place est libre.</p>;
  }

  const mineVisible = mine && rows.some((r) => r.user_id === mine.user_id);

  return (
    <div className="acc-table-scroll" aria-busy={loading || undefined}>
      <table className="acc-table soc-lb" data-loading={loading || undefined}>
        <thead>
          <tr>
            <th scope="col" className="soc-lb-pos">
              #
            </th>
            <th scope="col">Joueur</th>
            <th scope="col" className="soc-num">
              Points
            </th>
            <th scope="col" className="soc-num">
              Victoires
            </th>
            {!compact && (
              <>
                <th scope="col" className="soc-num">
                  Parties
                </th>
                <th scope="col" className="soc-num">
                  Ratio
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} data-self={r.user_id === selfId || undefined} data-top={r.position <= 3 || undefined}>
              <td className="soc-lb-pos">
                <Position position={r.position} />
              </td>
              <td>
                <Link to={`/joueur/${r.username}`} className="soc-name soc-lb-player">
                  <UserAvatar username={r.username} src={r.avatar} size={compact ? 26 : 32} />
                  {r.username}
                </Link>
                {r.user_id === selfId && <span className="soc-tag">toi</span>}
              </td>
              <td className="soc-num soc-lb-points">{r.points}</td>
              <td className="soc-num">{r.wins}</td>
              {!compact && (
                <>
                  <td className="soc-num">{r.games}</td>
                  <td className="soc-num">{winRate(r.wins, r.games)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {mine && !mineVisible && (
          <tfoot>
            <tr data-self>
              <td className="soc-lb-pos">
                <span className="soc-pos">{mine.position}</span>
              </td>
              <td>
                {mine.username} <span className="soc-tag">toi</span>
              </td>
              <td className="soc-num soc-lb-points">{mine.points}</td>
              <td className="soc-num">{mine.wins}</td>
              {!compact && (
                <>
                  <td className="soc-num">{mine.games}</td>
                  <td className="soc-num">{winRate(mine.wins, mine.games)}</td>
                </>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
