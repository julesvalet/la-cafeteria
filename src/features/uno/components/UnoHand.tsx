import { motion } from 'framer-motion';
import { cardLabel } from '../engine/deck';
import { UnoCardFace } from './UnoCardFace';
import type { UnoCard } from '../engine/types';

interface UnoHandProps {
  cards: UnoCard[];
  /** Cards are only clickable on your own turn — but never marked as playable. */
  enabled: boolean;
  onPlay: (card: UnoCard) => void;
}

/**
 * The player's own hand, fanned out.
 *
 * Note what is deliberately absent: nothing here consults the rules. Every card
 * looks and behaves identically whether or not it can legally be played — the
 * "no assistance" requirement means finding your move is the player's job, and
 * an illegal click is answered by the engine, not pre-empted by the UI.
 */
export function UnoHand({ cards, enabled, onPlay }: UnoHandProps) {
  const count = cards.length;
  // Tighten the fan as the hand grows so a big hand still fits the screen.
  const spread = count <= 1 ? 0 : Math.min(46, 340 / count);
  const arc = count <= 1 ? 0 : Math.min(3.2, 26 / count);

  return (
    <div className="uno-hand" style={{ '--uno-hand-count': count } as React.CSSProperties}>
      <div className="uno-hand-inner">
        {cards.map((card, i) => {
          const offset = i - (count - 1) / 2;
          const rotate = offset * arc;
          const lift = Math.abs(offset) * 2.2;

          return (
            <motion.button
              key={card.id}
              type="button"
              className="uno-hand-card"
              layout
              initial={{ opacity: 0, y: 60, scale: 0.8 }}
              animate={{
                opacity: 1,
                x: offset * spread,
                y: lift,
                rotate,
                scale: 1,
              }}
              exit={{ opacity: 0, y: -80, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              whileHover={enabled ? { y: lift - 26, scale: 1.06, zIndex: 60 } : undefined}
              whileTap={enabled ? { y: lift - 18, scale: 1.02 } : undefined}
              style={{ zIndex: i }}
              onClick={() => enabled && onPlay(card)}
              disabled={!enabled}
              title={cardLabel(card)}
              aria-label={cardLabel(card)}
            >
              <UnoCardFace card={card} className="uno-card-svg" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
