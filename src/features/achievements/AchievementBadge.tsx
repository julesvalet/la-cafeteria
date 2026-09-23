import { Lock } from 'lucide-react';
import { achievementIcon } from './icons';
import { TIER_LABELS, type AchievementState } from './api';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Un trophée : médaillon, nom, rareté, description, progression.
 *
 * Verrouillé, il reste lisible (gris, cadenas) : savoir ce qu'on peut viser
 * vaut mieux qu'une liste de « ??? ». Débloqué, il prend la couleur de sa
 * rareté — du bronze au divin qui pulse, jusqu'à l'OG arc-en-ciel.
 */
export function AchievementBadge({ a, compact = false }: { a: AchievementState; compact?: boolean }) {
  const Icon = achievementIcon(a.icon);
  const unlocked = Boolean(a.unlocked_at);
  const pct = Math.round((Math.min(a.progress, a.goal) / a.goal) * 100);
  const progressText = unlocked
    ? `Débloqué le ${DATE.format(new Date(a.unlocked_at!))}`
    : `${Math.min(a.progress, a.goal).toLocaleString('fr-FR')} / ${a.goal.toLocaleString('fr-FR')}`;
  const parts = Object.entries(a.extra ?? {});

  if (compact) {
    return (
      <span className="ach-mini" data-tier={a.tier} title={`${a.title} — ${a.description}`}>
        {a.image_url ? <img src={a.image_url} alt="" className="ach-mini-img" /> : <Icon size={16} aria-hidden />}
        <span>{a.title}</span>
      </span>
    );
  }

  return (
    <li className="ach-badge" data-tier={a.tier} data-unlocked={unlocked || undefined} tabIndex={0}>
      <span className="ach-tier">{TIER_LABELS[a.tier] ?? a.tier}</span>
      {a.is_limited && <span className="ach-limited">Édition limitée</span>}
      <span className="ach-medal" aria-hidden>
        {unlocked ? a.image_url ? <img src={a.image_url} alt="" /> : <Icon size={24} /> : <Lock size={20} />}
      </span>
      <span className="ach-name">{a.title}</span>
      <span className="ach-desc">{a.description}</span>
      {!unlocked && <span className="ach-locked-tag">À débloquer</span>}
      {parts.length > 0 && (
        <span className="ach-parts" aria-label="Détail de la progression">
          {parts.map(([k, v]) => (
            <span key={k} data-done={v >= a.goal || undefined}>
              {k} {Math.min(v, a.goal)}/{a.goal}
            </span>
          ))}
        </span>
      )}
      <span className="ach-progress" aria-label={`Progression : ${progressText}`}>
        <span className="ach-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="ach-progress-text">{progressText}</span>
      </span>
    </li>
  );
}
