import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../../features/account/useAuth';
import { useProfileStats } from '../../features/account/useProfileStats';
import { levelFromPoints } from '../../features/account/level';
import { useSocial } from '../../features/social/useSocial';
import { useFriendSessions } from '../../features/social/useFriendSessions';
import { useJoinSession } from '../../features/social/useJoinSession';
import { UserAvatar, type AvatarStatus } from '../../features/social/components/UserAvatar';
import { GAME_LABELS } from '../../features/account/types';
import * as api from '../../features/social/api';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const RANK: Record<AvatarStatus, number> = { online: 0, away: 1, offline: 2 };
/** La barre de niveau : dix cases, comme une jauge d'arcade. */
const LEVEL_CELLS = 10;

/**
 * La colonne du joueur sur l'accueil : sa fiche « Joueur 1 », ses amis et
 * l'ajout d'un ami par pseudo.
 */
export function HomeSide() {
  const { status, profile, user } = useAuth();

  if (!accountsEnabled) return null;

  if (status !== 'signed-in' || !profile || !user) {
    return (
      <aside className="home-side" aria-label="Ton compte">
        <header className="home-side-head">
          <span>Joueur 1</span>
          <span className="home-side-status">Invité</span>
        </header>
        <div className="home-profile" data-guest>
          <UserAvatar username="?" size={56} />
          <div className="home-profile-id">
            <strong>Invité</strong>
            <span>Connecte-toi pour tes amis, tes points et tes trophées.</span>
          </div>
        </div>
        <div className="home-guest-actions">
          <Link to="/connexion" className="btn btn-primary">
            <LogIn size={16} aria-hidden /> Se connecter
          </Link>
          <Link to="/inscription" className="btn">
            <UserPlus size={16} aria-hidden /> Créer un compte
          </Link>
        </div>
      </aside>
    );
  }

  return <SignedInSide userId={user.id} username={profile.username} avatar={profile.avatar} createdAt={profile.created_at} />;
}

function SignedInSide({ userId, username, avatar, createdAt }: { userId: string; username: string; avatar: string | null; createdAt: string }) {
  const { stats } = useProfileStats(userId);
  const { friends, presence, presenceLive, refreshFriends } = useSocial();
  const { sessionOf } = useFriendSessions();
  const join = useJoinSession();
  const lvl = levelFromPoints(stats?.points ?? 0);
  const filled = Math.round(lvl.ratio * LEVEL_CELLS);

  const statusOf = (id: string): AvatarStatus => (presenceLive ? (presence.get(id) ?? 'offline') : 'offline');
  const sorted = [...friends].sort((a, b) => RANK[statusOf(a.user_id)] - RANK[statusOf(b.user_id)] || a.username.localeCompare(b.username));
  const onlineCount = friends.filter((f) => statusOf(f.user_id) !== 'offline').length;

  return (
    <aside className="home-side" aria-label="Ton profil et tes amis">
      <header className="home-side-head">
        <span>Joueur 1</span>
        <span className="home-side-status" data-on>
          En ligne
        </span>
      </header>

      <Link to="/compte" className="home-profile">
        <UserAvatar username={username} src={avatar} size={56} userId={userId} />
        <div className="home-profile-id">
          <strong>{username}</strong>
          <span className="home-level" aria-label={`Niveau ${lvl.level}`}>
            Niv. {lvl.level}
            <span className="home-level-bar" aria-hidden>
              {Array.from({ length: LEVEL_CELLS }, (_, i) => (
                <i key={i} data-on={i < filled || undefined} />
              ))}
            </span>
          </span>
          <span className="home-since">Membre depuis le {DATE.format(new Date(createdAt))}</span>
        </div>
      </Link>

      <div className="home-friends-head">
        <h2>Amis</h2>
        {presenceLive && <span>{onlineCount} en ligne</span>}
      </div>

      <ul className="home-friends" aria-label="Tes amis">
        {sorted.length === 0 && <li className="home-friends-empty">Pas encore d'amis : ajoute-les par leur pseudo ci-dessous.</li>}
        {sorted.map((f) => {
          const st = statusOf(f.user_id);
          const session = sessionOf(f.user_id);
          return (
            <li key={f.user_id} className="home-friend" data-status={st}>
              <Link to={`/joueur/${f.username}`} className="home-friend-link">
                <UserAvatar username={f.username} src={f.avatar} size={34} status={st} />
                <span className="home-friend-text">
                  <strong>{f.username}</strong>
                  <small data-session={session ? true : undefined}>
                    {session
                      ? `${GAME_LABELS[session.game_type]} · ${session.status === 'playing' ? 'en partie' : 'en attente'}`
                      : st === 'online'
                        ? 'En ligne'
                        : st === 'away'
                          ? 'Absent'
                          : 'Hors ligne'}
                  </small>
                </span>
              </Link>
              <button
                type="button"
                className="home-join"
                disabled={!session}
                aria-label={session ? `Rejoindre la table de ${f.username}` : `${f.username} n'est pas à une table publique`}
                title={session ? 'Rejoindre sa table' : 'Pas à une table publique'}
                onClick={() => session && join(session.game_type, session.room_code)}
              >
                <ArrowRight size={18} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <AddFriend onAdded={() => void refreshFriends()} />
    </aside>
  );
}

function AddFriend({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.sendFriendRequest(name.trim());
      setMsg({ ok: true, text: res.status === 'accepted' ? `Vous êtes amis avec ${res.username} !` : `Demande envoyée à ${res.username}.` });
      setName('');
      onAdded();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Envoi impossible.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="home-add" onSubmit={submit}>
      <label htmlFor="home-add-input" className="soc-sr-only">
        Pseudo de l'ami à ajouter
      </label>
      <input
        id="home-add-input"
        className="home-add-input"
        placeholder="Pseudo d'un ami"
        value={name}
        maxLength={20}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn home-add-btn" disabled={busy || !name.trim()}>
        <UserPlus size={16} aria-hidden />
        <span>Ajouter</span>
      </button>
      {msg && (
        <p className="home-add-msg" data-ok={msg.ok} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
