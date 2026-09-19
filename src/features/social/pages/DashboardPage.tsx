import { Link } from 'react-router-dom';
import { ArrowRight, Flame, MailOpen, MessagesSquare, Radio, Trophy, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../account/useAuth';
import { useProfileStats } from '../../account/useProfileStats';
import { GAME_LABELS } from '../../account/types';
import { SocialPage } from '../components/SocialPage';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { UserAvatar } from '../components/UserAvatar';
import { ChallengeButton } from '../components/ChallengeButton';
import { ActiveSessions } from '../components/ActiveSessions';
import { useSocial } from '../useSocial';
import { useGroups } from '../useGroups';
import { useLeaderboard } from '../useLeaderboard';
import { timeAgo } from '../format';

export function DashboardPage() {
  const { profile } = useAuth();
  return (
    <SocialPage
      title={profile ? `Salut ${profile.username}` : 'Tableau de bord'}
      subtitle="Qui est là, où en sont les classements, et tes dernières parties."
      wide
    >
      <Dashboard />
    </SocialPage>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { friends, incoming, groupInvitations, online, presence, presenceLive } = useSocial();
  const { groups } = useGroups();
  const { recent } = useProfileStats(user?.id ?? null);
  const board = useLeaderboard('weekly', null, user?.id ?? null, 5);

  const onlineFriends = friends.filter((f) => online.has(f.user_id));
  const pending = incoming.length + groupInvitations.length;

  return (
    <div className="soc-dash">
      {pending > 0 && (
        <div className="soc-dash-alerts">
          {incoming.length > 0 && (
            <Link to="/amis" className="soc-alert">
              <UserPlus size={17} aria-hidden />
              {incoming.length} demande{incoming.length > 1 ? 's' : ''} d'ami en attente
              <ArrowRight size={15} aria-hidden />
            </Link>
          )}
          {groupInvitations.length > 0 && (
            <Link to="/groupes" className="soc-alert">
              <MailOpen size={17} aria-hidden />
              {groupInvitations.length} invitation{groupInvitations.length > 1 ? 's' : ''} de groupe
              <ArrowRight size={15} aria-hidden />
            </Link>
          )}
        </div>
      )}

      <section className="acc-card acc-card-wide soc-dash-friends">
        <h2 className="acc-section-title">
          <Users size={18} aria-hidden /> Amis en ligne
          {presenceLive && <span className="soc-count">{onlineFriends.length}</span>}
        </h2>
        {friends.length === 0 ? (
          <p className="soc-empty">
            Pas encore d'amis. <Link to="/amis">Ajoute tes partenaires de jeu</Link> pour les défier d'ici.
          </p>
        ) : !presenceLive ? (
          <p className="soc-empty">Le statut en ligne n'est pas disponible pour le moment.</p>
        ) : onlineFriends.length === 0 ? (
          <p className="soc-empty">Personne en ligne. Les derniers passés :</p>
        ) : (
          <ul className="soc-list">
            {onlineFriends.map((f) => (
              <li key={f.user_id} className="soc-row">
                <UserAvatar username={f.username} src={f.avatar} status={presence.get(f.user_id) ?? 'online'} />
                <div className="soc-row-main">
                  <Link to={`/joueur/${f.username}`} className="soc-name">
                    {f.username}
                  </Link>
                  <span className="soc-meta">{presence.get(f.user_id) === 'away' ? 'Absent' : 'En ligne'}</span>
                </div>
                <div className="soc-row-actions">
                  <ChallengeButton friendId={f.user_id} friendName={f.username} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {presenceLive && onlineFriends.length === 0 && friends.length > 0 && (
          <ul className="soc-list">
            {[...friends]
              .filter((f) => f.last_seen_at)
              .sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''))
              .slice(0, 3)
              .map((f) => (
                <li key={f.user_id} className="soc-row soc-row-compact">
                  <UserAvatar username={f.username} src={f.avatar} size={30} online={false} />
                  <div className="soc-row-main">
                    <Link to={`/joueur/${f.username}`} className="soc-name">
                      {f.username}
                    </Link>
                    <span className="soc-meta">Vu {timeAgo(f.last_seen_at!)}</span>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="acc-card acc-card-wide soc-dash-sessions">
        <h2 className="acc-section-title">
          <Radio size={18} aria-hidden /> Tables de tes amis
        </h2>
        <ActiveSessions compact />
        <Link to="/sessions" className="soc-see-all">
          Toutes les sessions <ArrowRight size={15} aria-hidden />
        </Link>
      </section>

      <section className="acc-card acc-card-wide soc-dash-board">
        <h2 className="acc-section-title">
          <Trophy size={18} aria-hidden /> Cette semaine
        </h2>
        <LeaderboardTable {...board} selfId={user?.id ?? null} compact />
        <Link to="/classements" className="soc-see-all">
          Tous les classements <ArrowRight size={15} aria-hidden />
        </Link>
      </section>

      <section className="acc-card acc-card-wide soc-dash-recent">
        <h2 className="acc-section-title">
          <Flame size={18} aria-hidden /> Dernières parties
        </h2>
        {recent.length === 0 ? (
          <p className="soc-empty">
            Aucune partie enregistrée. <Link to="/">Choisis un jeu</Link> et joue connecté.
          </p>
        ) : (
          <ul className="soc-list">
            {recent.slice(0, 5).map((g) => (
              <li key={g.id} className="soc-row soc-row-compact">
                <span className="acc-outcome soc-outcome-dot" data-won={g.won} aria-hidden />
                <div className="soc-row-main">
                  <span className="soc-name">{GAME_LABELS[g.game_type] ?? g.game_type}</span>
                  <span className="soc-meta">
                    {g.won ? 'Victoire' : 'Défaite'} · {g.player_count} joueurs · {timeAgo(g.created_at)}
                  </span>
                </div>
                <span className="soc-row-side soc-lb-points">{g.points > 0 ? `+${g.points}` : '—'}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/compte" className="soc-see-all">
          Tout mon profil <ArrowRight size={15} aria-hidden />
        </Link>
      </section>

      <section className="acc-card acc-card-wide soc-dash-groups">
        <h2 className="acc-section-title">
          <MessagesSquare size={18} aria-hidden /> Groupes
        </h2>
        {groups.length === 0 ? (
          <p className="soc-empty">
            Aucun groupe. <Link to="/groupes">Crée ou rejoins-en un</Link>.
          </p>
        ) : (
          <ul className="soc-list">
            {groups.slice(0, 4).map((g) => (
              <li key={g.id}>
                <Link to={`/groupes/${g.id}`} className="soc-row soc-row-link soc-row-compact">
                  <div className="soc-row-main">
                    <span className="soc-name">{g.name}</span>
                    <span className="soc-meta soc-ellipsis">
                      {g.last_message_deleted ? 'Message supprimé' : (g.last_message ?? '')}
                    </span>
                  </div>
                  <span className="soc-meta">{timeAgo(g.last_activity_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link to="/groupes" className="soc-see-all">
          Tous mes groupes <ArrowRight size={15} aria-hidden />
        </Link>
      </section>
    </div>
  );
}
