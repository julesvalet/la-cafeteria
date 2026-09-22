import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PlafeeMark, PlafeeWordmark } from '../../components/brand/PlafeeLogo';

/**
 * L'écran de démarrage, comme une borne qu'on allume : le symbole s'embrase
 * flamme par flamme, le lettrage s'allume lettre par lettre, la jauge se
 * remplit case par case.
 *
 * Montré une fois par visite : revenir à l'accueil depuis un jeu ne doit pas
 * refaire patienter.
 */
export function Splash() {
  const reduce = useReducedMotion();
  // Rendu à la racine du document : la page qui l'accueille est animée, et
  // son animation enfermerait le démarrage sous l'en-tête.
  return createPortal(
    <motion.div
      className="home-splash"
      role="status"
      aria-label="Chargement de PLAFEE"
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: 'blur(10px)' }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="splash-logo">
        <PlafeeMark animated className="splash-mark" />
        <PlafeeWordmark animated className="splash-word" />
      </div>
      <div className="splash-bar" aria-hidden>
        <span />
      </div>
      <p className="splash-text" aria-hidden>
        Chargement<span className="plf-blink">_</span>
      </p>
      <p className="splash-credit" aria-hidden>
        Insert coin · Player 1
      </p>
    </motion.div>,
    document.body,
  );
}
