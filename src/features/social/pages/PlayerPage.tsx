import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AccBanner } from '../../account/components/AccBanner';
import { useProfileStats } from '../../account/useProfileStats';
import { SocialPage } from '../components/SocialPage';
import { ProfileCard } from '../components/ProfileCard';
import { GameStats } from '../components/GameStats';
import { GameHistory } from '../components/GameHistory';
import { AchievementPanel } from '../../achievements/AchievementPanel';
import { getProfileByUsername } from '../api';

type Loaded = Awaited<ReturnType<typeof getProfileByUsername>>;

/** La fiche publique d'un joueur : consultable sans compte, comme les classements. */
export function PlayerPage() {
  const { username = '' } = useParams();
  const [profile, setProfile] = useState<Loaded | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const { stats } = useProfileStats(profile?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    setError(null);
    getProfileByUsername(username)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible.');
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <SocialPage public>
      {error ? (
        <AccBanner tone="error">{error}</AccBanner>
      ) : profile === undefined ? (
        <p className="neon-hint" role="status">
          Chargement…
        </p>
      ) : profile === null ? (
        <AccBanner tone="info">
          Aucun joueur ne s'appelle « {username} ». <Link to="/classements">Voir les classements</Link>
        </AccBanner>
      ) : (
        <>
          <ProfileCard profile={profile} stats={stats} />
          <GameStats userId={profile.id} />
          <AchievementPanel userId={profile.id} />
          <GameHistory userId={profile.id} />
        </>
      )}
    </SocialPage>
  );
}
