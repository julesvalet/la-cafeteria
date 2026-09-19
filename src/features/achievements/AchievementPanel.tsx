import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { useNotificationEvents } from '../social/useSocial';
import { AchievementBadge } from './AchievementBadge';
import { CATEGORY_LABELS, getAchievements, type AchievementState, type Category } from './api';

type Filter = 'all' | 'unlocked' | 'locked';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'unlocked', label: 'Débloqués' },
  { id: 'locked', label: 'À débloquer' },
];

/** La vitrine des trophées d'un joueur, groupés par thème. */
export function AchievementPanel({ userId, self = false }: { userId: string; self?: boolean }) {
  const [list, setList] = useState<AchievementState[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAchievements(userId)
      .then((l) => {
        if (!cancelled) setList(l);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, nonce]);

  // Un trophée débloqué pendant qu'on regarde sa propre vitrine s'y ajoute.
  useNotificationEvents((event) => {
    if (self && event.kind === 'achievement') setNonce((n) => n + 1);
  });

  const unlocked = list?.filter((a) => a.unlocked_at).length ?? 0;
  const shown = (list ?? []).filter((a) =>
    filter === 'all' ? true : filter === 'unlocked' ? a.unlocked_at : !a.unlocked_at,
  );
  const categories = [...new Set(shown.map((a) => a.category))] as Category[];

  return (
    <section className="acc-card acc-card-wide ach-panel" id="trophees">
      <header className="ach-panel-head">
        <h2 className="acc-section-title">
          <Award size={18} aria-hidden /> Trophées
          {list && (
            <span className="soc-count">
              {unlocked} / {list.length}
            </span>
          )}
        </h2>
        <div className="soc-tabs" role="group" aria-label="Filtrer les trophées">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="soc-tab" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {list === null ? (
        <p className="neon-hint" role="status">
          Chargement…
        </p>
      ) : shown.length === 0 ? (
        <p className="soc-empty">{filter === 'unlocked' ? 'Aucun trophée pour l’instant. La première victoire en rapporte un.' : 'Tout est débloqué. Respect.'}</p>
      ) : (
        categories.map((c) => (
          <div key={c} className="ach-group">
            <h3 className="ach-group-title">{CATEGORY_LABELS[c]}</h3>
            <ul className="ach-grid">
              {shown.filter((a) => a.category === c).map((a) => (
                <AchievementBadge key={a.id} a={a} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
