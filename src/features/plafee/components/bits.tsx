import type { CSSProperties } from 'react';
import { Coins } from 'lucide-react';
import { achievementIcon } from '../../achievements/icons';
import { BADGE_RARITY_LABELS, BADGE_TYPE_LABELS, TIER_LABELS, type PlayerBadge, type Tier } from '../api';
import { useCosmetics } from '../useCosmetics';
import { formatFees } from '../format';

/** Un montant de FEES, avec sa pièce. `signed` : « +50 » / « −150 ». */
export function FeesAmount({ value, signed = false, size = 'md' }: { value: number; signed?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const text = `${signed && value > 0 ? '+' : value < 0 ? '−' : ''}${formatFees(Math.abs(value))}`;
  return (
    <span className="plf-fees" data-size={size} data-negative={value < 0 || undefined}>
      <Coins size={size === 'lg' ? 26 : size === 'sm' ? 13 : 16} aria-hidden />
      <span className="plf-fees-n">{text}</span>
      <small>FEES</small>
    </span>
  );
}

/** L'étiquette de rareté d'un trophée. */
export function RarityTag({ tier }: { tier: Tier }) {
  return (
    <span className="plf-rarity" data-tier={tier}>
      {TIER_LABELS[tier] ?? tier}
    </span>
  );
}

/** Un badge : image ou icône, dans la couleur de sa rareté. */
export function BadgeChip({ badge }: { badge: PlayerBadge }) {
  const Icon = achievementIcon(badge.style.icon ?? (badge.type === 'temporal' ? 'PartyPopper' : 'Star'));
  const label = badge.note ?? badge.name;
  const expires = badge.expiry_date ? ` — jusqu'au ${new Date(badge.expiry_date).toLocaleDateString('fr-FR')}` : '';
  return (
    <span
      className="plf-badge"
      data-rarity={badge.rarity}
      data-type={badge.type}
      style={badge.style.color ? ({ '--badge': badge.style.color } as CSSProperties) : undefined}
      title={`${BADGE_TYPE_LABELS[badge.type]} ${BADGE_RARITY_LABELS[badge.rarity].toLowerCase()}${badge.description ? ` : ${badge.description}` : ''}${expires}`}
    >
      {badge.image_url ? <img src={badge.image_url} alt="" /> : <Icon size={13} aria-hidden />}
      <span>{label}</span>
    </span>
  );
}

/**
 * Ce qui accompagne un pseudo : son titre, sa plaque, ses badges. Rien tant
 * que les cosmétiques ne sont pas chargés (ou pour un joueur sans compte).
 */
export function PlayerFlair({ userId, badges = true, compact = false }: { userId: string; badges?: boolean; compact?: boolean }) {
  const c = useCosmetics(userId);
  if (!c) return null;
  const shown = badges ? c.badges.filter((b) => b.type !== 'title' || !c.title || (b.note ?? b.name) !== c.title) : [];
  if (!c.title && !c.plate && !shown.length && !c.banned) return null;
  return (
    <span className="plf-flair" data-compact={compact || undefined}>
      {c.banned && <span className="plf-banned-tag">Suspendu</span>}
      {c.plate && <span className="plf-plate">{c.plate}</span>}
      {c.title && <span className="plf-title">{c.title}</span>}
      {shown.slice(0, compact ? 2 : 12).map((b) => (
        <BadgeChip key={b.id} badge={b} />
      ))}
    </span>
  );
}

/** Seulement les badges temporaires encore valides : pour les classements. */
export function TemporalBadges({ userId }: { userId: string }) {
  const c = useCosmetics(userId);
  const list = c?.badges.filter((b) => b.type === 'temporal') ?? [];
  if (!list.length && !c?.plate) return null;
  return (
    <span className="plf-flair" data-compact>
      {c?.plate && <span className="plf-plate">{c.plate}</span>}
      {list.slice(0, 2).map((b) => (
        <BadgeChip key={b.id} badge={b} />
      ))}
    </span>
  );
}
