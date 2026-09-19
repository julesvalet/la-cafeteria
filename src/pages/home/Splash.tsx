import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * L'écran de chargement : la Terre, « LA CAFETERIA », « chargement… ».
 *
 * Montré une fois par visite : revenir à l'accueil depuis un jeu ne doit pas
 * refaire patienter.
 */
export function Splash() {
  const reduce = useReducedMotion();
  // Rendu à la racine du document : la page qui l'accueille est animée, et
  // son animation enfermerait le chargement sous l'en-tête.
  return createPortal(
    <motion.div
      className="home-splash"
      role="status"
      aria-label="Chargement de La Cafétéria"
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: 'blur(10px)' }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.h1
        className="home-splash-title"
        initial={reduce ? false : { opacity: 0, letterSpacing: '0.3em' }}
        animate={{ opacity: 1, letterSpacing: '0.04em' }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        LA CAFETERIA
      </motion.h1>
      <p className="home-splash-loading">
        chargement
        <span className="home-splash-dots" aria-hidden>
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </p>
    </motion.div>,
    document.body,
  );
}
