import { Spade, MessageCircle, Gamepad2, Lightbulb } from 'lucide-react';
import { FeatureCard } from '../components/FeatureCard';

const FEATURES = [
  {
    title: 'Scopa',
    description: "Le jeu de cartes italien, à 2, 3 ou 4 joueurs. Crée une room ou rejoins-en une avec un code.",
    icon: Spade,
    to: '/scopa',
  },
  {
    title: 'Le Salon',
    description: "Un espace de discussion pour papoter entre potes, sans quitter La Cafétéria.",
    icon: MessageCircle,
    comingSoon: true,
  },
  {
    title: 'Le Flipper',
    description: "Un mini-jeu d'arcade rapide à partager en attendant que tout le monde arrive.",
    icon: Gamepad2,
    comingSoon: true,
  },
  {
    title: 'La Boîte à Idées',
    description: 'Propose et vote pour la prochaine soirée, le prochain jeu, ou le prochain café.',
    icon: Lightbulb,
    comingSoon: true,
  },
];

export function Home() {
  return (
    <div className="home">
      <section className="home-hero">
        <div className="container">
          <p className="home-eyebrow">Bienvenue à</p>
          <h1>La Cafétéria</h1>
          <p className="home-tagline">
            Le hub de mini-applications et de jeux entre potes. Un seul endroit, plusieurs façons de traîner ensemble.
          </p>
        </div>
      </section>

      <section className="home-grid-section">
        <div className="container">
          <h2>Ce qu'il y a au menu</h2>
          <div className="home-grid">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
