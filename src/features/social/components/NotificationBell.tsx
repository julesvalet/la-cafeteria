import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { useSocial } from '../useSocial';
import { useOpenNotification } from '../useOpenNotification';
import { describeNotification } from '../notificationText';
import { timeAgo } from '../format';
import * as api from '../api';
import { UserAvatar } from './UserAvatar';
import type { AppNotification } from '../types';

/**
 * La cloche de l'en-tête.
 *
 * Le panneau est un `popover` natif : couche supérieure (au-dessus de la scène
 * 3D et des plateaux sans bataille de z-index), fermeture à Échap et au clic
 * extérieur, focus rendu au bouton — sans une ligne de gestion d'événements.
 *
 * Les demandes d'ami et invitations de groupe se traitent directement ici :
 * devoir changer de page pour dire oui, c'est ce qui fait qu'on ne répond pas.
 */
export function NotificationBell() {
  const { active, notifications, unreadCount, markRead } = useSocial();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  if (!active) return null;

  const close = () => panelRef.current?.hidePopover();

  return (
    <>
      <button
        type="button"
        className="account-chip soc-bell"
        popoverTarget={panelId}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'}
      >
        <Bell size={17} aria-hidden />
        {unreadCount > 0 && (
          <span className="soc-badge soc-bell-badge" aria-hidden>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <div id={panelId} ref={panelRef} popover="auto" className="soc-bell-panel acc-scope">
        <header className="soc-bell-head">
          <h2>Notifications</h2>
          {unreadCount > 0 && (
            <button type="button" className="soc-link-btn" onClick={() => void markRead().catch(() => {})}>
              <CheckCheck size={15} aria-hidden /> Tout marquer comme lu
            </button>
          )}
        </header>

        {notifications.length === 0 ? (
          <p className="soc-empty">Rien de neuf pour l'instant.</p>
        ) : (
          <ul className="soc-bell-list">
            {notifications.map((n) => (
              <NotificationItem key={n.id} n={n} onNavigate={close} />
            ))}
          </ul>
        )}

        <footer className="soc-bell-foot">
          <Link to="/amis" onClick={close}>
            Amis
          </Link>
          <Link to="/groupes" onClick={close}>
            Groupes
          </Link>
        </footer>
      </div>
    </>
  );
}

function NotificationItem({ n, onNavigate }: { n: AppNotification; onNavigate: () => void }) {
  const { incoming, groupInvitations, markRead, refreshFriends, refreshInvitations } = useSocial();
  const open = useOpenNotification();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor = n.actor?.username ?? null;
  const { text, to } = describeNotification(n, actor);

  // Une demande n'est actionnable que tant qu'elle attend : celle déjà
  // acceptée depuis la page Amis ne doit plus proposer « Accepter ».
  const pendingFriend =
    n.kind === 'friend_request' && incoming.some((f) => f.friendship_id === n.payload.friendship_id);
  const pendingInvite =
    n.kind === 'group_invite' && groupInvitations.some((i) => i.invitation_id === n.payload.invitation_id);

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (pendingFriend) {
        await api.respondFriendRequest(n.payload.friendship_id!, accept);
        await refreshFriends();
      } else if (pendingInvite) {
        await api.respondGroupInvitation(n.payload.invitation_id!, accept);
        await refreshInvitations();
      }
      await markRead([n.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="soc-bell-item" data-unread={n.read_at === null}>
      <UserAvatar username={actor ?? '?'} src={n.actor?.avatar} size={32} />
      <div className="soc-bell-body">
        {to ? (
          <button
            type="button"
            className="soc-bell-text"
            onClick={() => {
              void markRead([n.id]).catch(() => {});
              onNavigate();
              open(n);
            }}
          >
            {text}
          </button>
        ) : (
          <p className="soc-bell-text">{text}</p>
        )}
        <span className="soc-meta">{timeAgo(n.created_at)}</span>
        {(pendingFriend || pendingInvite) && (
          <div className="soc-row-actions">
            <button type="button" className="soc-pill" data-tone="accept" disabled={busy} onClick={() => void respond(true)}>
              <Check size={14} aria-hidden /> {pendingInvite ? 'Rejoindre' : 'Accepter'}
            </button>
            <button type="button" className="soc-pill" disabled={busy} onClick={() => void respond(false)}>
              <X size={14} aria-hidden /> Refuser
            </button>
          </div>
        )}
        {error && (
          <p className="neon-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
