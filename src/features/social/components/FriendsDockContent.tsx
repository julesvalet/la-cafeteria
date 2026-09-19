import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, LogIn, Radio, Search, Send, Users, X } from 'lucide-react';
import { GAME_LABELS } from '../../account/types';
import { useSocial } from '../useSocial';
import { useFriendSessions } from '../useFriendSessions';
import { useJoinSession } from '../useJoinSession';
import { STATUS_LABELS } from '../presence';
import { timeAgo } from '../format';
import * as api from '../api';
import { StatusToggle } from './StatusToggle';
import { UserAvatar, type AvatarStatus } from './UserAvatar';
import { SessionCreator } from './SessionCreator';
import type { Friendship, FriendSession } from '../types';

const RANK: Record<AvatarStatus, number> = { online: 0, away: 1, offline: 2 };

/** Le contenu du panneau d'amis — chargé à la première ouverture. */
export function DockContent({ onClose }: { onClose: () => void }) {
  const { friends, presence, presenceLive, currentRoom } = useSocial();
  const { sessionOf } = useFriendSessions();
  const join = useJoinSession();
  const [query, setQuery] = useState('');
  const [creatorFor, setCreatorFor] = useState<{ id: string; username: string } | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeRef.current?.focus(), []);

  // Une invitation vaut pour une table : en changer remet les compteurs à zéro.
  const roomKey = currentRoom ? `${currentRoom.game}:${currentRoom.code}` : null;
  useEffect(() => setInvited(new Set()), [roomKey]);

  const statusOf = (f: Friendship): AvatarStatus => (presenceLive ? (presence.get(f.user_id) ?? 'offline') : 'offline');

  const q = query.trim().toLowerCase();
  const list = friends
    .filter((f) => !q || f.username.toLowerCase().includes(q))
    .sort((a, b) => RANK[statusOf(a)] - RANK[statusOf(b)] || a.username.localeCompare(b.username));
  const present = friends.filter((f) => statusOf(f) !== 'offline').length;

  async function invite(f: Friendship) {
    setError(null);
    if (!currentRoom) {
      setCreatorFor({ id: f.user_id, username: f.username });
      return;
    }
    try {
      await api.inviteToGame(f.user_id, currentRoom.game, currentRoom.code);
      setInvited((s) => new Set(s).add(f.user_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation impossible.');
    }
  }

  function describe(f: Friendship, status: AvatarStatus, session: FriendSession | null) {
    if (session) {
      const where = `${GAME_LABELS[session.game_type]} · ${session.player_count}/${session.max_players}`;
      return `${where} · ${session.status === 'playing' ? 'en partie' : 'en attente'}`;
    }
    if (status !== 'offline') return STATUS_LABELS[status];
    return f.last_seen_at ? `Vu ${timeAgo(f.last_seen_at)}` : STATUS_LABELS.offline;
  }

  return (
    <>
      <header className="dock-head">
        <h2>
          <Users size={17} aria-hidden /> Amis en ligne{' '}
          <span className="dock-count">
            ({present}/{friends.length})
          </span>
        </h2>
        <button ref={closeRef} type="button" className="dock-icon" aria-label="Fermer le panneau d'amis" onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
      </header>

      <div className="dock-bar">
        <StatusToggle />
      </div>

      {currentRoom && (
        <p className="dock-room">
          <Radio size={14} aria-hidden /> Tu es à une table de {GAME_LABELS[currentRoom.game]} ({currentRoom.code}) :
          « Inviter » y invite.
        </p>
      )}

      {friends.length > 6 && (
        <label className="dock-search">
          <Search size={15} aria-hidden />
          <span className="soc-sr-only">Chercher un ami</span>
          <input value={query} placeholder="Chercher un ami" onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}

      {error && (
        <p className="dock-error" role="alert">
          {error}
        </p>
      )}

      {friends.length === 0 ? (
        <p className="dock-empty">
          Pas encore d'amis. <Link to="/amis" onClick={onClose}>Ajoute quelqu'un</Link> pour jouer ensemble.
        </p>
      ) : list.length === 0 ? (
        <p className="dock-empty">Aucun ami ne correspond.</p>
      ) : (
        <ul className="dock-list">
          {list.map((f) => {
            const status = statusOf(f);
            const session = sessionOf(f.user_id);
            const here = session && currentRoom && session.room_code === currentRoom.code && session.game_type === currentRoom.game;
            const done = invited.has(f.user_id);
            return (
              <li key={f.user_id} className="dock-friend" data-status={status}>
                <div className="dock-friend-id">
                  <UserAvatar username={f.username} src={f.avatar} size={32} status={status} />
                  <div className="dock-friend-text">
                    <Link to={`/joueur/${f.username}`} className="dock-name" onClick={onClose}>
                      {f.username}
                    </Link>
                    <span className="dock-sub">{here ? 'À ta table' : describe(f, status, session)}</span>
                  </div>
                </div>
                <div className="dock-actions">
                  <button
                    type="button"
                    className="dock-btn"
                    disabled={done || Boolean(here)}
                    onClick={() => void invite(f)}
                    title={currentRoom ? `Inviter à ta table de ${GAME_LABELS[currentRoom.game]}` : 'Créer une table et inviter'}
                  >
                    {done ? <Check size={14} aria-hidden /> : <Send size={14} aria-hidden />}
                    {done ? 'Invité' : 'Inviter'}
                  </button>
                  <button
                    type="button"
                    className="dock-btn"
                    disabled={!session || Boolean(here)}
                    title={
                      !session
                        ? 'Pas à une table publique en ce moment'
                        : session.status === 'playing'
                          ? 'Partie en cours : tu entreras en observation'
                          : 'Rejoindre sa table'
                    }
                    onClick={() => {
                      if (!session) return;
                      join(session.game_type, session.room_code);
                      onClose();
                    }}
                  >
                    <LogIn size={14} aria-hidden /> Rejoindre
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="dock-foot">
        <Link to="/sessions" onClick={onClose}>
          Tables ouvertes
        </Link>
        <Link to="/amis" onClick={onClose}>
          Gérer mes amis
        </Link>
      </footer>

      <SessionCreator
        open={creatorFor !== null}
        invitee={creatorFor}
        onClose={() => {
          setCreatorFor(null);
        }}
      />
    </>
  );
}
