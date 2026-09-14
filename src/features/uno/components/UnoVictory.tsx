import { motion } from 'framer-motion';
import { RotateCcw, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import type { UnoState } from '../engine/types';

interface UnoVictoryProps {
  state: UnoState;
  canRematch: boolean;
  onRematch: () => void;
  /** Glissé sous le nom du vainqueur — le bilan de points, en pratique. */
  children?: ReactNode;
}

/**
 * Unmounted outright rather than animated out, for the same reason as the
 * Puissance 4 overlay: a stalled exit would leave this covering the next game
 * and swallowing every click.
 */
export function UnoVictory({ state, canRematch, onRematch, children }: UnoVictoryProps) {
  if (state.phase !== 'won' || state.winner === null) return null;
  const winner = state.players[state.winner];

  return (
    <motion.div
      className="p4-victory"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4, delay: 0.4 } }}
    >
      <motion.span
        className="p4-victory-flash"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0] }}
        transition={{ duration: 0.7, times: [0, 0.12, 1], ease: 'easeOut' }}
      />

      <motion.div
        className="p4-victory-card"
        style={{ '--p4-win-color': 'var(--color-primary)' } as React.CSSProperties}
        initial={{ opacity: 0, scale: 0.7, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.55 }}
      >
        <motion.span
          className="p4-victory-icon"
          initial={{ rotate: -25, scale: 0.4 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.7 }}
        >
          <Trophy size={38} strokeWidth={1.8} />
        </motion.span>

        <h2>Victoire !</h2>
        <p className="p4-victory-who">
          <strong>{winner?.name ?? 'Quelqu’un'}</strong>
          <span>a posé sa dernière carte</span>
        </p>

        {children}

        {canRematch ? (
          <button type="button" className="btn btn-primary p4-victory-again" onClick={onRematch}>
            <RotateCcw size={16} /> Rejouer
          </button>
        ) : (
          <p className="p4-victory-wait">L'hôte peut relancer une partie.</p>
        )}
      </motion.div>
    </motion.div>
  );
}
