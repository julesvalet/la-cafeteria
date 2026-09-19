import { lazy, Suspense, useState } from 'react';
import { FeatureCard } from '../components/FeatureCard';
import { PLANETS } from '../components/planets/planets.data';
import { hasWebGL } from '../components/planets/useEnvironment';
import { HomeSessionsChip } from '../features/social/components/HomeSessionsChip';

// Three.js is the heaviest thing on the site and only the home page needs it.
// Splitting it out keeps a deep link straight into a game room lightweight.
const PlanetHub = lazy(() =>
  import('../components/planets/PlanetHub').then((m) => ({ default: m.PlanetHub })),
);

/** Plain card grid for browsers without WebGL, or if we lose the context. */
function FeatureGrid({ reason }: { reason: 'unsupported' | 'lost' | null }) {
  return (
    <div className="planet-fallback">
      <div className="container">
        <p className="home-eyebrow">Bienvenue à</p>
        <h1>La Cafétéria</h1>
        <p className="planet-fallback-note">
          {reason === 'lost'
            ? "L'affichage 3D s'est interrompu — voici le menu classique."
            : "Ton navigateur ne gère pas la 3D — voici le menu classique."}
        </p>
        <div className="home-grid">
          {PLANETS.map((planet) => (
            <FeatureCard
              key={planet.id}
              title={planet.name}
              description={planet.description}
              icon={planet.icon}
              to={planet.to}
              comingSoon={!planet.to}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const [fallback, setFallback] = useState<'unsupported' | 'lost' | null>(() =>
    hasWebGL() ? null : 'unsupported',
  );

  if (fallback) {
    return (
      <>
        <FeatureGrid reason={fallback} />
        <HomeSessionsChip />
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<div className="planet-hub" aria-busy="true"><div className="planet-hub-sky" /></div>}>
        <PlanetHub onContextLost={() => setFallback('lost')} />
      </Suspense>
      <HomeSessionsChip />
    </>
  );
}
