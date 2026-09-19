import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flame, Radio, Trophy } from 'lucide-react';
import { GameTitle } from '../components/GameTitle';
import { accountsEnabled } from '../lib/supabase';
import { GAMES, gameById, type GameEntry } from '../features/games';
import { getTrendingGame, refreshMyAchievements } from '../features/achievements/api';
import { useAuth } from '../features/account/useAuth';
import { Splash } from './home/Splash';
import { HomeSide } from './home/HomeSide';
import './home/home.css';

// Le tableau de bord (tables, classement, parties, groupes) sous l'écran
// d'accueil : chargé à la demande, il ne concerne que les joueurs connectés.
const DashboardSections = lazy(() =>
  import('../features/social/pages/DashboardPage').then((m) => ({ default: m.DashboardSections })),
);

const SPLASH_KEY = 'cafet-splash-seen';
const SPLASH_MIN_MS = 1400;

function splashSeen() {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * L'accueil, d'après la maquette : bienvenue et logo à gauche, les jeux au
 * centre (le jeu du moment en tête, en vert), le joueur et ses amis à droite.
 *
 * À la première visite, l'écran « LA CAFETERIA — chargement… » laisse place à
 * l'interface par un zoom flouté, comme sur la maquette.
 */
export function Home() {
  const reduce = useReducedMotion();
  const { status } = useAuth();
  const [splash, setSplash] = useState(() => !splashSeen());
  const [trending, setTrending] = useState<GameEntry>(() => gameById('flip7')!);

  useEffect(() => {
    if (!splash) return;
    // La photo de la Terre est l'image du chargement : on attend qu'elle soit
    // prête (dans la limite du raisonnable) plutôt que d'afficher un fond noir.
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}assets/backdrops/earth.webp`;
    const start = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.setTimeout(() => {
        setSplash(false);
        try {
          sessionStorage.setItem(SPLASH_KEY, '1');
        } catch {
          // Tant pis, il reviendra à la prochaine visite.
        }
      }, Math.max(0, SPLASH_MIN_MS - (Date.now() - start)));
    };
    img.decode().then(finish, finish);
    const cap = window.setTimeout(finish, 3500);
    return () => window.clearTimeout(cap);
  }, [splash]);

  useEffect(() => {
    if (!accountsEnabled) return;
    getTrendingGame()
      .then((id) => setTrending(gameById(id) ?? gameById('flip7')!))
      .catch(() => {});
  }, []);

  // Les trophées qui ne viennent pas d'une partie (groupes, podium de la
  // semaine passée) : relus une fois par visite. Un déblocage s'annonce tout
  // seul par sa notification.
  useEffect(() => {
    if (status !== 'signed-in') return;
    try {
      if (sessionStorage.getItem('cafet-ach-refreshed') === '1') return;
      sessionStorage.setItem('cafet-ach-refreshed', '1');
    } catch {
      // Pas de stockage : on relit à chaque accueil, sans conséquence.
    }
    refreshMyAchievements().catch(() => {});
  }, [status]);

  const others = GAMES.filter((g) => g.id !== trending.id);
  const TrendingIcon = trending.icon;

  return (
    <div className="home">
      <AnimatePresence>{splash && <Splash key="splash" />}</AnimatePresence>

      {!splash && (
        <motion.div
          className="home-layout"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.12, x: 80, filter: 'blur(16px)' }}
          animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <section className="home-welcome" aria-labelledby="home-title">
            <h1 id="home-title">
              Bienvenue sur
              <br />
              La cafétéria
            </h1>
            <div className="home-logo-card">
              <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="Logo de La Cafétéria" />
            </div>
          </section>

          <nav className="home-games" aria-label="Les jeux">
            <Link to={trending.to} className="home-tile" data-tone="tendance">
              <span className="home-tile-badge">
                <Flame size={15} aria-hidden /> jeu tendance
              </span>
              <TrendingIcon size={38} strokeWidth={1.6} aria-hidden />
              <GameTitle game={trending.id} size="lg" motto className="gt-vivid" />
              <small>{trending.players}</small>
            </Link>
            {others.map((g) => {
              const Icon = g.icon;
              return (
                <Link key={g.id} to={g.to} className="home-tile" data-tone="jeu">
                  <Icon size={34} strokeWidth={1.6} aria-hidden />
                  <GameTitle game={g.id} size="lg" motto className="gt-vivid" />
                  <small>{g.players}</small>
                </Link>
              );
            })}
            {/* La sixième tuile de la maquette : les tables des amis pour un
                joueur connecté, les classements pour un visiteur. */}
            {status === 'signed-in' ? (
              <Link to="/sessions" className="home-tile" data-tone="extra">
                <Radio size={34} strokeWidth={1.6} aria-hidden />
                <strong>Tables</strong>
                <small>Rejoindre tes amis</small>
              </Link>
            ) : (
              <Link to="/classements" className="home-tile" data-tone="extra">
                <Trophy size={34} strokeWidth={1.6} aria-hidden />
                <strong>Classements</strong>
                <small>Qui mène cette semaine</small>
              </Link>
            )}
          </nav>

          <HomeSide />
        </motion.div>
      )}

      {!splash && status === 'signed-in' && (
        <Suspense fallback={null}>
          <div className="container">
            <DashboardSections withFriends={false} />
          </div>
        </Suspense>
      )}
    </div>
  );
}
