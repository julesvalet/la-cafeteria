import { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { GameTitle } from '../../../components/GameTitle';
import { getGameStats } from '../api';
import { winRate } from '../format';
import type { GameStatRow } from '../types';

/** Le bilan d'un joueur, jeu par jeu. Les jeux jamais joués n'apparaissent pas. */
export function GameStats({ userId }: { userId: string }) {
  const [rows, setRows] = useState<GameStatRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGameStats(userId)
      .then((r) => {
        if (!cancelled) setRows(r.sort((a, b) => b.played - a.played));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section className="acc-card acc-card-wide">
      <h2 className="acc-section-title">
        <Gamepad2 size={18} aria-hidden /> Par jeu
      </h2>
      {rows === null ? (
        <p className="neon-hint" role="status">
          Chargement…
        </p>
      ) : rows.length === 0 ? (
        <p className="soc-empty">Aucune partie enregistrée.</p>
      ) : (
        <ul className="soc-game-grid">
          {rows.map((r) => (
            <li key={r.game_type} className="acc-stat soc-game-stat">
              <GameTitle game={r.game_type} size="sm" className="soc-game-name gt-start" />
              <span className="soc-game-points">{r.points} pts</span>
              <span className="soc-meta">
                {r.played} partie{r.played > 1 ? 's' : ''} · {r.wins} victoire{r.wins > 1 ? 's' : ''} ·{' '}
                {winRate(r.wins, r.played)}
              </span>
              {/* La barre dit le ratio d'un coup d'oeil ; le texte au-dessus reste la source exacte. */}
              <span className="soc-bar" aria-hidden>
                <span style={{ width: `${r.played ? (r.wins / r.played) * 100 : 0}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
