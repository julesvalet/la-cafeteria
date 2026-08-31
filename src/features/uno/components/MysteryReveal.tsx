import { motion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { MYSTERY_EFFECTS } from '../engine/deck';
import type { UnoMysteryEffect } from '../engine/types';

export interface MysteryShot {
  key: number;
  effect: UnoMysteryEffect;
  who: string;
}

interface MysteryRevealProps {
  shot: MysteryShot | null;
}

const RAYS = 12;

/**
 * The mystery card announcement — the whole point of the mechanic, so it takes
 * over the screen for a moment rather than settling for a toast.
 *
 * Deliberately without AnimatePresence: a stalled exit would leave this sitting
 * on top of the table and swallowing clicks. The room clears it on a timer.
 */
export function MysteryReveal({ shot }: MysteryRevealProps) {
  if (!shot) return null;
  const def = MYSTERY_EFFECTS[shot.effect];

  return (
    <motion.div
      key={shot.key}
      className="uno-mystery"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      aria-hidden="true"
    >
      <motion.span
        className="uno-mystery-flash"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 0.8, times: [0, 0.15, 1], ease: 'easeOut' }}
      />

      <motion.div
        className="uno-mystery-card"
        initial={{ scale: 0.4, rotate: -18, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 15 }}
      >
        {Array.from({ length: RAYS }, (_, i) => (
          <motion.span
            key={i}
            className="uno-mystery-ray"
            style={{ rotate: `${(i / RAYS) * 360}deg` }}
            initial={{ scaleY: 0, opacity: 0.9 }}
            animate={{ scaleY: 1, opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
          />
        ))}

        <motion.span
          className="uno-mystery-icon"
          initial={{ scale: 0.3, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.15 }}
        >
          <Gift size={40} strokeWidth={1.9} />
        </motion.span>

        <p className="uno-mystery-eyebrow">Carte mystère révélée !</p>
        <h2>{def.label}</h2>
        <p className="uno-mystery-desc">{def.description}</p>
        <p className="uno-mystery-who">Piochée par {shot.who}</p>
      </motion.div>
    </motion.div>
  );
}
