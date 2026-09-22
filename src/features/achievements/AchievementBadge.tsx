import { Lock } from 'lucide-react';
import { achievementIcon } from './icons';
import { TIER_LABELS, type AchievementState } from './api';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Un trophée : médaillon, nom, rareté, description, progression.
 *
 * Verrouillé, il reste lisible (gris, cadenas) : savoir ce qu'on peut viser
 * vaut mieux qu'une liste de « ??? ». Marqué « À débloquer », avec sa jauge
 * et son compte ; débloqué, il s'allume en vert fluo.
 */
export function AchievementBadge({ a, compact = false }: { a: AchievementState; compact?: boolean }) {
  const Icon = achievementIcon(a.icon);
  const unlocked = Boolean(a.unlocked_at);
  const pct = Math.round((Math.min(a.progress, a.goal) / a.goal) * 100);
  const progressText = unlocked
    ? `Débloqué le ${DATE.format(new Date(a.unlocked_at!))}`
    : `${Math.min(a.progress, a.goal)} / ${a.goal}`;

  if (compact) {
    return (
      <span className="ach-mini" data-tier={a.tier} title={`${a.title} — ${a.description}`}>
        <Icon size={16} aria-hidden />
        <span>{a.title}</span>
      </span>
    );
  }

  return (
    <li className="ach-badge" data-tier={a.tier} data-unlocked={unlocked || undefined} tabIndex={0}>
      <span className="ach-tier">{TIER_LABELS[a.tier]}</span>
      <span className="ach-medal" aria-hidden>
        {unlocked ? <Icon size={24} /> : <Lock size={20} />}
      </span>
      <span className="ach-name">{a.title}</span>
      <span className="ach-desc">{a.description}</span>
      {!unlocked && <span className="ach-locked-tag">À débloquer</span>}
      <span className="ach-progress" aria-label={`Progression : ${progressText}`}>
        <span className="ach-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="ach-progress-text">{progressText}</span>
      </span>
    </li>
  );
}
