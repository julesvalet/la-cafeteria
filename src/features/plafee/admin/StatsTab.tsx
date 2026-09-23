import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';
import { formatFees } from '../format';
import { getAdminStats, type AdminStats } from './adminApi';

const RANGES = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '3 mois' },
];

/** L'évolution par rapport à la période précédente, en flèche et pourcentage. */
function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="adm-delta">=</span>;
  const up = pct > 0;
  return (
    <span className="adm-delta" data-up={up || undefined}>
      {up ? <ArrowUpRight size={13} aria-hidden /> : <ArrowDownRight size={13} aria-hidden />}
      {up ? '+' : ''}
      {pct} %<span className="sr-only"> par rapport à la semaine précédente</span>
    </span>
  );
}

function Tile({ label, value, extra, hero = false }: { label: string; value: string | number; extra?: ReactNode; hero?: boolean }) {
  return (
    <div className="adm-tile" data-hero={hero || undefined}>
      <span className="adm-tile-label">{label}</span>
      <strong className="adm-tile-value">{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</strong>
      {extra}
    </div>
  );
}

export function StatsTab() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getAdminStats(days)
      .then((s) => !cancelled && setStats(s))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Statistiques indisponibles.'));
    return () => {
      cancelled = true;
    };
  }, [days, nonce]);

  if (error)
    return (
      <p className="neon-error" role="alert">
        {error}
      </p>
    );
  if (!stats)
    return (
      <p className="neon-hint" role="status">
        Chargement des statistiques…
      </p>
    );

  const maxGames = Math.max(1, ...stats.per_game.map((g) => g.games));

  return (
    <div className="adm-stack">
      <section className="acc-card acc-card-wide">
        <div className="adm-row-between">
          <h2 className="acc-section-title">Cette semaine</h2>
          <button type="button" className="neon-btn adm-btn" data-variant="ghost" onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw size={14} aria-hidden /> Actualiser
          </button>
        </div>
        <div className="adm-tiles">
          <Tile label="Visites" value={stats.visits_week} hero extra={<Delta now={stats.visits_week} before={stats.visits_prev_week} />} />
          <Tile label="Joueurs actifs" value={stats.active_players} />
          <Tile label="Parties" value={stats.games_week} extra={<Delta now={stats.games_week} before={stats.games_prev_week} />} />
          <Tile label="Taux de victoire" value={stats.win_rate === null ? '—' : `${stats.win_rate.toLocaleString('fr-FR')} %`} />
          <Tile label="Nouveaux joueurs" value={stats.new_players} extra={<small className="neon-hint">{stats.total_players} au total</small>} />
          <Tile label="En ligne maintenant" value={stats.online_now} />
          <Tile label="FEES en circulation" value={formatFees(Number(stats.fees_in_circulation))} />
          <Tile label="Signalements en attente" value={stats.pending_reports} />
        </div>
      </section>

      <section className="acc-card acc-card-wide">
        <div className="adm-row-between">
          <h2 className="acc-section-title">Visites par jour</h2>
          <div className="soc-tabs" role="group" aria-label="Période">
            {RANGES.map((r) => (
              <button key={r.days} type="button" className="soc-tab" aria-pressed={days === r.days} onClick={() => setDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <VisitsChart series={stats.visits_series} />
        <details className="adm-table-toggle">
          <summary>Voir les chiffres en tableau</summary>
          <div className="acc-table-scroll">
            <table className="acc-table">
              <thead>
                <tr>
                  <th scope="col">Jour</th>
                  <th scope="col">Visiteurs</th>
                  <th scope="col">Pages vues</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.visits_series].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{new Date(d.day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td>{d.visits}</td>
                    <td>{d.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="acc-card acc-card-wide">
        <h2 className="acc-section-title">Parties par jeu (7 jours)</h2>
        <ul className="adm-bars">
          {stats.per_game.map((g) => (
            <li key={g.game}>
              <span className="adm-bars-label">{g.label}</span>
              <span className="adm-bars-track" aria-hidden>
                <span style={{ width: `${(g.games / maxGames) * 100}%` }} />
              </span>
              <span className="adm-bars-value">{g.games}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Un histogramme d'une seule série : une barre par jour, arrondie au sommet,
 * posée sur la ligne de base. Grille discrète, survol par barre (zone de
 * survol plus large que la barre), valeur dans une infobulle.
 */
function VisitsChart({ series }: { series: AdminStats['visits_series'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(4, ...series.map((d) => d.visits));
  const niceMax = Math.ceil(max / 4) * 4;
  const step = innerW / Math.max(1, series.length);
  const barW = Math.max(2, Math.min(18, step - 2));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  const labelEvery = Math.ceil(series.length / 8);
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const total = series.reduce((s, d) => s + d.visits, 0);

  const h = hover === null ? null : series[hover];

  return (
    <figure className="adm-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Visites par jour : ${total} visiteurs sur ${series.length} jours`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="adm-chart-grid" />
            <text x={pad.left - 6} y={y(t) + 4} className="adm-chart-axis" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {series.map((d, i) => {
          const x = pad.left + i * step + (step - barW) / 2;
          const top = y(d.visits);
          const hgt = pad.top + innerH - top;
          const r = Math.min(4, barW / 2, hgt);
          return (
            <g key={d.day}>
              {d.visits > 0 && (
                <path
                  className="adm-chart-bar"
                  data-hover={hover === i || undefined}
                  d={`M${x},${top + hgt} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + hgt} Z`}
                />
              )}
              {/* Zone de survol : toute la colonne, plus facile à viser que la barre. */}
              <rect x={pad.left + i * step} y={pad.top} width={step} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 8} className="adm-chart-axis" textAnchor="middle">
                  {fmt(d.day)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} className="adm-chart-base" />
      </svg>
      {h && hover !== null && (
        <div className="adm-chart-tip" style={{ left: `${((pad.left + hover * step + step / 2) / W) * 100}%` }} role="status">
          <strong>{new Date(h.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          <span>
            {h.visits} visiteur{h.visits > 1 ? 's' : ''} · {h.hits} page{h.hits > 1 ? 's' : ''}
          </span>
        </div>
      )}
      <figcaption className="neon-hint">Un visiteur = un navigateur par jour. Le suivi commence avec cette version.</figcaption>
    </figure>
  );
}
