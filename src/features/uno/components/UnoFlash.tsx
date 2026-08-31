import { motion } from 'framer-motion';
import { UnoCardBack } from './UnoCardFace';

export interface UnoShot {
  key: number;
  who: string;
  /** False when the shout came from someone not actually down to one card. */
  legit: boolean;
}

interface UnoFlashProps {
  shot: UnoShot | null;
}

/** Whole sequence, in seconds. Keyframe `times` below are fractions of this. */
const TOTAL = 2.8;

/*
 * Beat map, as fractions of TOTAL — kept in one place so the card, the name and
 * the effects stay in step if the timing is retuned.
 *
 *   0.00  name lands
 *   0.11  card pops in, front showing
 *   0.20  flip starts
 *   0.41  "UNO" fully revealed
 *   0.73  hold ends, card flips back
 *   0.88  front showing again
 *   1.00  faded out
 */
const T_CARD_IN = 0.11;
const T_FLIP_START = 0.2;
const T_REVEALED = 0.41;
const T_FLIP_BACK = 0.73;
const T_FRONT_AGAIN = 0.88;

const PARTICLES = 18;
const RAYS = 14;

/** UNO's four suits, reused for the confetti and the ray fan. */
const CONFETTI = ['#d8232a', '#f4c500', '#1a9c4b', '#0a6cb8'];

/**
 * The "UNO!" announcement — the loudest moment in the game, so it gets the
 * biggest gesture: the caller's name, then a card that flips over to shout the
 * word back at the table.
 *
 * Purely decorative. `pointer-events: none` throughout and no state is touched,
 * so the turn it interrupts keeps running underneath — a player can carry on
 * clicking while it plays.
 *
 * Deliberately without AnimatePresence, matching `MysteryReveal`: a stalled
 * exit on a fixed, full-screen layer is a bug that lingers on top of the game.
 * The fade-out is baked into the keyframes and the room clears the shot on a
 * timer instead.
 */
export function UnoFlash({ shot }: UnoFlashProps) {
  if (!shot) return null;

  return (
    <motion.div
      key={shot.key}
      className="uno-flash"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: TOTAL, times: [0, 0.06, 0.9, 1], ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {/* Impact flash, gone almost as fast as it arrives. */}
      <motion.span
        className="uno-flash-burst"
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.85, 0], scale: [0.2, 1.6, 2.2] }}
        transition={{ duration: 0.75, times: [0, 0.12, 1], ease: 'easeOut' }}
      />

      {/* Two shockwave rings, offset so the second reads as the echo. */}
      {[0, 0.14].map((delay, i) => (
        <motion.span
          key={i}
          className="uno-flash-ring"
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0.9, 0], scale: [0.2, 2.6] }}
          transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}

      {/* Anime-style speed lines fanning out from the centre. */}
      {Array.from({ length: RAYS }, (_, i) => (
        <motion.span
          key={`ray-${i}`}
          className="uno-flash-ray"
          style={{ rotate: `${(i / RAYS) * 360}deg`, background: CONFETTI[i % CONFETTI.length] }}
          initial={{ scaleY: 0, opacity: 0.85 }}
          animate={{ scaleY: [0, 1, 0.2], opacity: [0.85, 0.5, 0] }}
          transition={{ duration: 1.1, delay: 0.06, ease: 'easeOut' }}
        />
      ))}

      {/* Confetti in the four UNO colours. */}
      {Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2;
        const distance = 150 + (i % 4) * 55;
        return (
          <motion.span
            key={`p-${i}`}
            className="uno-flash-confetti"
            style={{ background: CONFETTI[i % CONFETTI.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: [1, 1, 0],
              scale: [1, 1.1, 0.3],
              rotate: (i % 2 === 0 ? 1 : -1) * 220,
            }}
            transition={{ duration: 1.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}

      <div className="uno-flash-stack">
        <motion.p
          className="uno-flash-name"
          initial={{ opacity: 0, scale: 0.5, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
        >
          {shot.who}
        </motion.p>

        <motion.p
          className="uno-flash-verb"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: 'easeOut' }}
        >
          {shot.legit ? 'annonce' : 'crie dans le vide'}
        </motion.p>

        {/* The perspective has to live on the parent, or rotateY stays flat. */}
        <div className="uno-flash-stage">
          <motion.div
            className="uno-flash-card"
            initial={{ scale: 0, rotateY: 0, y: 30 }}
            animate={{
              scale: [0, 1.12, 1, 1, 0.94],
              rotateY: [0, 0, 180, 180, 0],
              y: [30, 0, 0, 0, 10],
            }}
            transition={{
              duration: TOTAL,
              times: [0, T_CARD_IN, T_REVEALED, T_FLIP_BACK, T_FRONT_AGAIN],
              // One curve per keyframe gap. The flips get the slow-in/slow-out
              // that sells the weight of the card turning over.
              ease: ['backOut', [0.65, 0, 0.35, 1], 'linear', [0.65, 0, 0.35, 1]],
            }}
          >
            <div className="uno-flash-face uno-flash-front">
              <UnoCardBack className="uno-card-svg" />
            </div>

            <div className="uno-flash-face uno-flash-back">
              <span className="uno-flash-word">UNO</span>
            </div>
          </motion.div>

          {/* Glow behind the card, brightest while the word is showing. */}
          <motion.span
            className="uno-flash-halo"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.35, 0.9, 0.9, 0.2], scale: [0.6, 1, 1.15, 1.15, 0.9] }}
            transition={{
              duration: TOTAL,
              times: [0, T_FLIP_START, T_REVEALED, T_FLIP_BACK, 1],
              ease: 'easeInOut',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
