import { Eye, LogIn, RefreshCw, Users } from 'lucide-react';
import { GameTitle } from '../../../components/GameTitle';
import { AccBanner } from '../../account/components/AccBanner';
import { useFriendSessions } from '../useFriendSessions';
import { useJoinSession } from '../useJoinSession';
import { useSocial } from '../useSocial';
import { timeAgo } from '../format';
import { UserAvatar } from './UserAvatar';
import type { FriendSession } from '../types';

/**
 * Les tables publiques de tes amis : celles qu'ils hébergent, et celles où ils
 * sont assis. Une table qui attend se rejoint ; une table lancée ou pleine
 * s'observe.
 */
export function ActiveSessions({ compact = false }: { compact?: boolean }) {
  const { sessions, loading, error, refresh } = useFriendSessions();
  const { currentRoom } = useSocial();
  const join = useJoinSession();

  const shown = compact ? sessions.slice(0, 3) : sessions;

  if (error) return <AccBanner tone="error">{error}</AccBanner>;
  if (loading && sessions.length === 0) {
    return (
      <p className="neon-hint" role="status">
        Chargement…
      </p>
    );
  }

  return (
    <div className="sess-list-wrap">
      {!compact && (
        <div className="sess-list-tools">
          <button type="button" className="soc-link-btn" onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden /> Actualiser
          </button>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="soc-empty">
          Aucune table publique chez tes amis pour l'instant. Crées-en une : ils la verront ici.
        </p>
      ) : (
        <ul className="sess-list">
          {shown.map((s) => (
            <SessionCard
              key={`${s.game_type}:${s.room_code}`}
              session={s}
              here={currentRoom?.game === s.game_type && currentRoom.code === s.room_code}
              onJoin={() => join(s.game_type, s.room_code)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionCard({ session: s, here, onJoin }: { session: FriendSession; here: boolean; onJoin: () => void }) {
  const full = s.player_count >= s.max_players;
  const watch = s.status === 'playing' || full;
  const others = s.friends_inside.filter((f) => f.user_id !== s.host_id);

  return (
    <li className="sess-card" data-status={s.status}>
      <div className="sess-card-game">
        <GameTitle game={s.game_type} size="sm" className="sess-game gt-start" />
        <span className="sess-state" data-status={s.status}>
          {s.status === 'playing' ? 'En cours' : full ? 'Complète' : 'En attente de joueurs'}
        </span>
      </div>

      <div className="sess-card-host">
        <UserAvatar username={s.host_username} src={s.host_avatar} size={30} />
        <span>
          Créée par <strong>{s.is_mine ? 'toi' : s.host_username}</strong>
          <span className="soc-meta"> · {timeAgo(s.created_at)}</span>
        </span>
      </div>

      <div className="sess-card-meta">
        <span>
          <Users size={14} aria-hidden /> {s.player_count}/{s.max_players} joueurs
          {full && ' (complet)'}
        </span>
        {s.spectator_count > 0 && (
          <span>
            <Eye size={14} aria-hidden /> {s.spectator_count} observe{s.spectator_count > 1 ? 'nt' : ''}
          </span>
        )}
        {others.length > 0 && (
          <span className="sess-friends">
            Avec {others.map((f) => f.username + (f.role === 'spectator' ? ' (observe)' : '')).join(', ')}
          </span>
        )}
      </div>

      <button type="button" className="sess-join" data-watch={watch || undefined} disabled={here || s.is_mine} onClick={onJoin}>
        {here || s.is_mine ? (
          'Tu y es'
        ) : watch ? (
          <>
            <Eye size={16} aria-hidden /> Observer
          </>
        ) : (
          <>
            <LogIn size={16} aria-hidden /> Rejoindre
          </>
        )}
      </button>
    </li>
  );
}
