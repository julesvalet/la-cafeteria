import { useState } from 'react';

export type AvatarStatus = 'online' | 'away' | 'offline';

/**
 * La photo du joueur, ou l'initiale de son pseudo sur un disque ambré quand il
 * n'en a pas (ou qu'elle ne charge pas), avec une pastille de statut en option.
 */
export function UserAvatar({
  username,
  src,
  size = 36,
  online,
  status,
}: {
  username: string;
  src?: string | null;
  size?: number;
  /** Raccourci historique : vrai = en ligne, faux = hors ligne. */
  online?: boolean;
  /** Absent : pas de pastille (statut inconnu ou sans objet). */
  status?: AvatarStatus;
}) {
  // Une image cassée (fichier supprimé, réseau coupé) retombe sur l'initiale
  // plutôt que d'afficher l'icône d'image brisée du navigateur.
  const [broken, setBroken] = useState<string | null>(null);
  const shown = src && broken !== src ? src : null;
  const dot = status ?? (online === undefined ? undefined : online ? 'online' : 'offline');

  return (
    <span className="soc-avatar" style={{ width: size, height: size, fontSize: size * 0.44 }} aria-hidden>
      {shown ? (
        <img src={shown} alt="" loading="lazy" decoding="async" onError={() => setBroken(shown)} />
      ) : (
        username.charAt(0).toUpperCase()
      )}
      {dot && <span className="soc-presence" data-status={dot} data-online={dot === 'online'} />}
    </span>
  );
}
