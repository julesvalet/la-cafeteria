import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../account/useAuth';
import { GAME_LABELS, type GameTypeId } from '../../account/types';
import { SocialPage } from '../components/SocialPage';
import { LeaderboardFilters, LeaderboardTable } from '../components/LeaderboardTable';
import { useLeaderboard } from '../useLeaderboard';
import { LEADERBOARD_GAMES, PERIODS, type LeaderboardPeriod } from '../types';

/** Le fuseau de remise à zéro, dit en clair : minuit UTC n'est pas minuit à Paris. */
const RESET_NOTE: Record<LeaderboardPeriod, string> = {
  daily: 'Remise à zéro chaque jour à minuit UTC.',
  weekly: 'Remise à zéro chaque lundi à minuit UTC.',
  monthly: 'Remise à zéro le premier du mois à minuit UTC.',
  alltime: 'Tous les points depuis l’ouverture des comptes.',
};

export function LeaderboardsPage() {
  const { user } = useAuth();
  // Période et jeu dans l'URL : un classement se partage, et le bouton Retour
  // doit ramener au filtre d'avant.
  const [params, setParams] = useSearchParams();
  const periodParam = params.get('periode') as LeaderboardPeriod | null;
  const gameParam = params.get('jeu') as GameTypeId | null;
  const period: LeaderboardPeriod = periodParam && PERIODS.includes(periodParam) ? periodParam : 'weekly';
  const gameType = gameParam && LEADERBOARD_GAMES.includes(gameParam) ? gameParam : null;

  const { rows, mine, loading, error } = useLeaderboard(period, gameType, user?.id ?? null);

  function update(next: { periode?: string; jeu?: string | null }) {
    const merged = new URLSearchParams(params);
    if (next.periode) merged.set('periode', next.periode);
    if (next.jeu !== undefined) {
      if (next.jeu) merged.set('jeu', next.jeu);
      else merged.delete('jeu');
    }
    setParams(merged, { replace: true });
  }

  return (
    <SocialPage
      public
      title="Classements"
      subtitle={`${gameType ? GAME_LABELS[gameType] : 'Tous les jeux'} — les 100 meilleurs. ${RESET_NOTE[period]}`}
    >
      <section className="acc-card acc-card-wide">
        <LeaderboardFilters
          period={period}
          gameType={gameType}
          onPeriod={(p) => update({ periode: p })}
          onGame={(g) => update({ jeu: g })}
        />
        {mine && (
          <p className="soc-lb-mine">
            Tu es <strong>{mine.position}e</strong> sur {mine.total} avec <strong>{mine.points} points</strong>.
          </p>
        )}
        <LeaderboardTable rows={rows} mine={mine} selfId={user?.id ?? null} loading={loading} error={error} />
      </section>
      <p className="neon-hint soc-footnote">
        Une victoire rapporte des points selon le jeu, avec une prime toutes les trois victoires d'affilée. Les
        parties solo et contre des bots ne comptent pas.
      </p>
    </SocialPage>
  );
}
