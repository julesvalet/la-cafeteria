import { useCallback, useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { SocialPage } from '../components/SocialPage';
import { FriendsPanel } from '../components/FriendsPanel';
import { UserAvatar } from '../components/UserAvatar';
import { useSocial } from '../useSocial';
import * as api from '../api';
import type { BlockedUser } from '../types';

export function FriendsPage() {
  return (
    <SocialPage title="Amis" subtitle="Qui est là, qui t'a demandé, et à qui lancer un défi.">
      <FriendsPanel />
      <BlockedList />
    </SocialPage>
  );
}

/**
 * Les joueurs bloqués. Repliée par défaut : c'est une liste qu'on consulte
 * rarement, et qui n'a rien à faire en évidence sur une page d'amis.
 */
function BlockedList() {
  const { active, friendships } = useSocial();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!active) return;
    api.listBlocked().then(setBlocked).catch(() => {});
  }, [active]);

  // Relire quand la liste d'amis bouge : un blocage depuis la liste d'amis
  // doit apparaître ici sans recharger la page.
  useEffect(load, [load, friendships]);

  if (blocked.length === 0) return null;

  return (
    <details className="acc-card acc-card-wide soc-details">
      <summary className="acc-section-title">
        <Ban size={18} aria-hidden /> Joueurs bloqués
        <span className="soc-count">{blocked.length}</span>
      </summary>
      <ul className="soc-list">
        {blocked.map((b) => (
          <li key={b.user_id} className="soc-row">
            <UserAvatar username={b.username} src={b.avatar} />
            <div className="soc-row-main">
              <span className="soc-name">{b.username}</span>
            </div>
            <div className="soc-row-actions">
              <button
                type="button"
                className="soc-pill"
                disabled={busy === b.user_id}
                onClick={() => {
                  setBusy(b.user_id);
                  api
                    .unblockUser(b.user_id)
                    .then(load)
                    .catch(() => {})
                    .finally(() => setBusy(null));
                }}
              >
                Débloquer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
