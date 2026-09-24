import { useState } from 'react';
import { useCosmetics } from '../../plafee/useCosmetics';
import { achievementIcon } from '../../achievements/icons';
import { AvatarAccessory } from '../../plafee/components/AvatarAccessory';

export type AvatarStatus = 'online' | 'away' | 'offline';

/**
 * La photo du joueur, ou l'initiale de son pseudo sur un disque ambré quand il
 * n'en a pas (ou qu'elle ne charge pas), avec une pastille de statut en option.
 *
 * Avec `userId`, l'avatar porte aussi ses cosmétiques : le contour acheté à la
 * boutique (ou décerné), et l'icône de son badge visuel en coin.
 */
export function UserAvatar({
  username,
  src,
  size = 36,
  online,
  status,
  userId,
  preview,
}: {
  username: string;
  src?: string | null;
  size?: number;
  /** Raccourci historique : vrai = en ligne, faux = hors ligne. */
  online?: boolean;
  /** Absent : pas de pastille (statut inconnu ou sans objet). */
  status?: AvatarStatus;
  /** Pour afficher contour et badge du joueur. */
  userId?: string | null;
  /** Aperçu de boutique : un contour ou un accessoire, à la place des siens. */
  preview?: { border?: string | null; accessory?: string | null };
}) {
  // Une image cassée (fichier supprimé, réseau coupé) retombe sur l'initiale
  // plutôt que d'afficher l'icône d'image brisée du navigateur.
  const [broken, setBroken] = useState<string | null>(null);
  const cosmetics = useCosmetics(userId);
  const accessory = preview && 'accessory' in preview ? preview.accessory : cosmetics?.accessory;
  const shown = src && broken !== src ? src : null;
  const dot = status ?? (online === undefined ? undefined : online ? 'online' : 'offline');
  const visual = size >= 40 ? cosmetics?.badges.find((b) => b.type === 'visual') : undefined;
  const VisualIcon = visual && !visual.image_url ? achievementIcon(visual.style.icon ?? 'Star') : null;

  return (
    <span
      className="soc-avatar"
      data-border={(preview && 'border' in preview ? preview.border : cosmetics?.border) ?? undefined}
      data-accessory={accessory ?? undefined}
      style={{ width: size, height: size, fontSize: size * 0.44 }}
      aria-hidden
    >
      {shown ? (
        <img src={shown} alt="" loading="lazy" decoding="async" onError={() => setBroken(shown)} />
      ) : (
        username.charAt(0).toUpperCase()
      )}
      {dot && <span className="soc-presence" data-status={dot} data-online={dot === 'online'} />}
      <AvatarAccessory id={accessory} />
      {visual && (
        <span className="plf-avatar-badge" style={{ color: visual.style.color }} title={visual.name}>
          {visual.image_url ? <img src={visual.image_url} alt="" /> : VisualIcon && <VisualIcon size={Math.max(11, size * 0.24)} />}
        </span>
      )}
    </span>
  );
}
