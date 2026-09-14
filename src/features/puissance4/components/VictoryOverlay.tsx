import { motion } from 'framer-motion';
import { Handshake, RotateCcw, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { teamColor } from '../engine/modes';
import { teamLabel, teamMembers } from '../engine/rules';
import type { P4State } from '../engine/types';

interface VictoryOverlayProps {
  state: P4State;
  /** Only the host can deal a new game. */
  canRematch: boolean;
  onRematch: () => void;
  /** Slipped under the result — the points tally, in practice. */
  children?: ReactNode;
}

/**
 * The finisher. A white flash, then the result card drifts in while the board
 * behind it stays zoomed on the winning line (that part lives in the stage's
 * CSS, so the discs themselves remain visible under the overlay).
 */
export function VictoryOverlay({ state, canRematch, onRematch, children }: VictoryOverlayProps) {
  const done = state.phase === 'won' || state.phase === 'draw';
  const won = state.phase === 'won' && state.winner !== null;
  const team = state.winner?.team ?? 0;
  const color = won ? teamColor(state.mode, team) : 'var(--color-primary)';
  const members = won ? teamMembers(state, team) : [];

  if (!done) return null;

  /*
   * Deliberately not wrapped in AnimatePresence. This overlay covers the whole
   * screen, so a stalled exit animation does not merely look wrong — it leaves
   * "Victoire !" sitting on top of the next game and swallows every click.
   * Unmounting the moment the phase changes is worth losing a fade-out for;
   * the entrance, which is the part anyone actually watches, still animates.
   */
  return (
    <>
        <motion.div
          className="p4-victory"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.4, delay: 0.55 } }}
        >
          {/* Impact flash, fired before the card so the cut lands hard. */}
          <motion.span
            className="p4-victory-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.7, times: [0, 0.12, 1], ease: 'easeOut' }}
          />

          <motion.div
            className="p4-victory-card"
            style={{ '--p4-win-color': color } as React.CSSProperties}
            initial={{ opacity: 0, scale: 0.7, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.7 }}
          >
            <motion.span
              className="p4-victory-icon"
              initial={{ rotate: -25, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.85 }}
            >
              {won ? <Trophy size={38} strokeWidth={1.8} /> : <Handshake size={38} strokeWidth={1.8} />}
            </motion.span>

            <h2>{won ? 'Victoire !' : 'Match nul'}</h2>

            {won ? (
              <p className="p4-victory-who">
                <strong>{teamLabel(state, team)}</strong>
                {members.length > 1 && <span>{members.map((m) => m.name).join(' & ')}</span>}
              </p>
            ) : (
              <p className="p4-victory-who">
                <span>Le plateau est plein, personne n'a aligné quatre jetons.</span>
              </p>
            )}

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
    </>
  );
}
