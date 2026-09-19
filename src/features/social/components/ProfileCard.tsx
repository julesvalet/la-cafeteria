import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Pencil, UserPlus } from 'lucide-react';
import { NeonButton } from '../../account/components/NeonButton';
import { useAuth } from '../../account/useAuth';
import type { ProfileStats } from '../../account/types';
import { GAME_LABELS } from '../../account/types';
import { useFriends } from '../useFriends';
import { winRate } from '../format';
import { RankStrip } from './RankStrip';
import { UserAvatar } from './UserAvatar';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

interface PublicProfile {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  created_at: string;
}

/** La fiche d'un joueur : identité, bilan global, places au classement, et le lien d'amitié. */
export function ProfileCard({ profile, stats }: { profile: PublicProfile; stats: ProfileStats | null }) {
  const { user, status } = useAuth();
  const { friends, incoming, outgoing, online, presenceLive, addFriend, acceptRequest } = useFriends();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const self = user?.id === profile.id;
  const friend = friends.find((f) => f.user_id === profile.id);
  const pendingIn = incoming.find((f) => f.user_id === profile.id);
  const pendingOut = outgoing.find((f) => f.user_id === profile.id);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="acc-card acc-card-wide">
      <header className="acc-profile-head">
        <div className="soc-avatar-lg">
          <UserAvatar
            username={profile.username}
            src={profile.avatar}
            size={120}
            online={friend && presenceLive ? online.has(profile.id) : undefined}
          />
        </div>
        <div className="acc-profile-id">
          <h1 className="acc-title">{profile.username}</h1>
          <p className="acc-subtitle">{profile.bio || <em>Aucune description.</em>}</p>
          <p className="neon-hint">
            À la table depuis {DATE_FMT.format(new Date(profile.created_at))}
            {stats?.favorite_game && <> · joue surtout à {GAME_LABELS[stats.favorite_game]}</>}
          </p>
        </div>
        <div className="acc-profile-actions">
          {self ? (
            <Link to="/compte" className="neon-btn">
              <Pencil size={16} aria-hidden /> Modifier
            </Link>
          ) : status !== 'signed-in' ? null : friend ? (
            <span className="soc-tag soc-tag-lg">
              <Check size={14} aria-hidden /> Ami
            </span>
          ) : pendingIn ? (
            <NeonButton
              variant="solid"
              loading={busy}
              icon={<Check size={16} aria-hidden />}
              onClick={() => void run(() => acceptRequest(pendingIn.friendship_id))}
            >
              Accepter sa demande
            </NeonButton>
          ) : pendingOut ? (
            <span className="soc-tag soc-tag-lg">
              <Clock size={14} aria-hidden /> Demande envoyée
            </span>
          ) : (
            <NeonButton
              variant="solid"
              loading={busy}
              icon={<UserPlus size={16} aria-hidden />}
              onClick={() => void run(() => addFriend(profile.username))}
            >
              Ajouter en ami
            </NeonButton>
          )}
        </div>
      </header>
      {error && (
        <p className="neon-error" role="alert">
          {error}
        </p>
      )}

      <dl className="acc-stats soc-profile-stats">
        <div className="acc-stat">
          <dt>Points</dt>
          <dd className="acc-stat-hero">{stats?.points ?? 0}</dd>
        </div>
        <div className="acc-stat">
          <dt>Parties</dt>
          <dd>{stats?.games_played ?? 0}</dd>
        </div>
        <div className="acc-stat">
          <dt>Victoires</dt>
          <dd>{stats?.wins ?? 0}</dd>
        </div>
        <div className="acc-stat">
          <dt>Ratio</dt>
          <dd>{winRate(stats?.wins ?? 0, stats?.games_played ?? 0)}</dd>
        </div>
      </dl>

      <h2 className="acc-section-title soc-subsection">Au classement</h2>
      <RankStrip userId={profile.id} />
    </section>
  );
}
