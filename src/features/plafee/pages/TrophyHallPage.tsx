import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, Clock, Coins, Gem, Medal } from 'lucide-react';
import { useAuth } from '../../account/useAuth';
import { SocialPage } from '../../social/components/SocialPage';
import { UserAvatar } from '../../social/components/UserAvatar';
import { achievementIcon } from '../../achievements/icons';
import { CATEGORY_LABELS, type Category } from '../../achievements/api';
import { usePrefetchCosmetics } from '../useCosmetics';
import {
  getFeesLeaderboard,
  getRecentUnlocks,
  getTrophyLeaderboard,
  getTrophyRarity,
  type FeesRow,
  type RecentUnlock,
  type TrophyLeader,
  type TrophyRarity,
} from '../api';
import { FeesAmount, RarityTag, TemporalBadges } from '../components/bits';

type Tab = 'top' | 'rare' | 'recent' | 'fees';

const TABS: { id: Tab; label: string; icon: typeof Award }[] = [
  { id: 'top', label: 'Top 10 joueurs', icon: Medal },
  { id: 'rare', label: 'Trophées rares', icon: Gem },
  { id: 'recent', label: 'Récents', icon: Clock },
  { id: 'fees', label: 'Richesse', icon: Coins },
];

const RELATIVE = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

/** « il y a 2 h », « il y a 1 j ». */
function ago(iso: string): string {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  if (s > -3600) return RELATIVE.format(Math.round(s / 60), 'minute');
  if (s > -86400) return RELATIVE.format(Math.round(s / 3600), 'hour');
  return RELATIVE.format(Math.round(s / 86400), 'day');
}

function Podium({ position }: { position: number }) {
  return (
    <span className="plf-pos" data-top={position <= 3 || undefined}>
      {position === 1 ? '1er' : `${position}e`}
    </span>
  );
}

/** Le hall des trophées : qui en a le plus, lesquels sont rares, qui vient d'en gagner, et la richesse. */
export function TrophyHallPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('onglet'))?.id ?? 'top') as Tab;

  return (
    <SocialPage public>
      <section className="acc-card acc-card-wide">
        <h1 className="acc-title">
          <Award size={26} aria-hidden /> Hall des trophées
        </h1>
        <div className="soc-tabs plf-tabs" role="group" aria-label="Classements">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className="soc-tab" aria-pressed={tab === id} onClick={() => setParams({ onglet: id }, { replace: true })}>
              <Icon size={15} aria-hidden /> {label}
            </button>
          ))}
        </div>
        {tab === 'top' && <TopPlayers />}
        {tab === 'rare' && <RareTrophies />}
        {tab === 'recent' && <RecentUnlocks />}
        {tab === 'fees' && <Richest />}
      </section>
    </SocialPage>
  );
}

function useLoad<T>(load: () => Promise<T>): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Chargement impossible.'));
    return () => {
      cancelled = true;
    };
    // Chaque onglet charge une fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, error };
}

function Status({ error, empty }: { error: string | null; empty?: string }) {
  if (error)
    return (
      <p className="neon-error" role="alert">
        {error}
      </p>
    );
  if (empty) return <p className="soc-empty">{empty}</p>;
  return (
    <p className="neon-hint" role="status">
      Chargement…
    </p>
  );
}

function TopPlayers() {
  const { user } = useAuth();
  const { data, error } = useLoad<TrophyLeader[]>(() => getTrophyLeaderboard(10));
  usePrefetchCosmetics(data?.map((r) => r.user_id) ?? []);
  if (!data) return <Status error={error} />;
  if (!data.length) return <Status error={null} empty="Personne n'a encore de trophée. La première victoire en rapporte un." />;
  return (
    <ol className="plf-rank-list">
      {data.map((r) => (
        <li key={r.user_id} data-self={r.user_id === user?.id || undefined}>
          <Podium position={r.position} />
          <Link to={`/joueur/${r.username}`} className="plf-rank-player">
            <UserAvatar username={r.username} src={r.avatar} size={36} userId={r.user_id} />
            <span>{r.username}</span>
          </Link>
          <TemporalBadges userId={r.user_id} />
          <span className="plf-rank-stats">
            <strong>{r.total}</strong> trophées
            {r.divin > 0 && <span className="plf-rarity" data-tier="divin">{r.divin} divin</span>}
            {r.og > 0 && <span className="plf-rarity" data-tier="og">{r.og} OG</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function RareTrophies() {
  const { data, error } = useLoad<TrophyRarity[]>(getTrophyRarity);
  if (!data) return <Status error={error} />;
  return (
    <ol className="plf-rare-list">
      {data.map((t) => {
        const Icon = achievementIcon(t.icon);
        return (
          <li key={t.id} data-tier={t.tier}>
            <span className="plf-rare-icon" aria-hidden>
              <Icon size={20} />
            </span>
            <span className="plf-rare-name">
              <strong>{t.title}</strong>
              <small>{CATEGORY_LABELS[t.category as Category] ?? t.category}</small>
            </span>
            <RarityTag tier={t.tier} />
            <span className="plf-rare-pct">
              {t.pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %<small>{t.holders} joueur{t.holders > 1 ? 's' : ''}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RecentUnlocks() {
  const { data, error } = useLoad<RecentUnlock[]>(() => getRecentUnlocks(7, 40));
  if (!data) return <Status error={error} />;
  if (!data.length) return <Status error={null} empty="Aucun trophée débloqué cette semaine." />;
  return (
    <ol className="plf-recent-list">
      {data.map((r) => {
        const Icon = achievementIcon(r.icon);
        return (
          <li key={`${r.user_id}-${r.achievement_id}`} data-tier={r.tier}>
            <UserAvatar username={r.username} src={r.avatar} size={30} />
            <span>
              <Link to={`/joueur/${r.username}`} className="soc-name">
                {r.username}
              </Link>{' '}
              a débloqué <Icon size={14} aria-hidden className="plf-inline-icon" /> <strong>{r.title}</strong> <RarityTag tier={r.tier} />
            </span>
            <time dateTime={r.unlocked_at}>{ago(r.unlocked_at)}</time>
          </li>
        );
      })}
    </ol>
  );
}

function Richest() {
  const { user } = useAuth();
  const { data, error } = useLoad<FeesRow[]>(() => getFeesLeaderboard(100));
  usePrefetchCosmetics(data?.slice(0, 30).map((r) => r.user_id) ?? []);
  if (!data) return <Status error={error} />;
  if (!data.length) return <Status error={null} empty="Personne n'a encore de FEES. Une victoire suffit." />;
  return (
    <ol className="plf-rank-list">
      {data.map((r) => (
        <li key={r.user_id} data-self={r.user_id === user?.id || undefined}>
          <Podium position={r.position} />
          <Link to={`/joueur/${r.username}`} className="plf-rank-player">
            <UserAvatar username={r.username} src={r.avatar} size={32} userId={r.position <= 30 ? r.user_id : undefined} />
            <span>{r.username}</span>
          </Link>
          <span className="plf-rank-stats">
            <FeesAmount value={r.balance} size="sm" />
          </span>
        </li>
      ))}
    </ol>
  );
}
