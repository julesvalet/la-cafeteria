import { motion } from 'framer-motion';
import { RANK_LABEL, SUIT_LABEL, SUIT_SYMBOL } from '../engine/deck';
import type { CardT } from '../engine/types';

interface PlayingCardProps {
  card: CardT;
  selected?: boolean;
  selectable?: boolean;
  faceDown?: boolean;
  small?: boolean;
  /** Delay (in seconds) used for the staggered deal-in entrance animation. */
  dealDelay?: number;
  onClick?: () => void;
}

const dealTransition = (delay: number) => ({
  type: 'spring' as const,
  stiffness: 260,
  damping: 20,
  delay,
});

export function PlayingCard({ card, selected, selectable, faceDown, small, dealDelay, onClick }: PlayingCardProps) {
  if (faceDown) {
    return (
      <motion.div
        layout
        initial={dealDelay !== undefined ? { opacity: 0, y: -50, x: -30, rotate: -10, scale: 0.8 } : false}
        animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
        transition={dealTransition(dealDelay ?? 0)}
        className={`scopa-card scopa-card-back ${small ? 'scopa-card-sm' : ''}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <motion.button
      layout
      layoutId={card.id}
      type="button"
      initial={dealDelay !== undefined ? { opacity: 0, y: -50, x: -30, rotate: -10, scale: 0.8 } : false}
      animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={dealDelay !== undefined ? dealTransition(dealDelay) : { type: 'spring', stiffness: 320, damping: 22 }}
      whileHover={selectable ? { y: -6 } : undefined}
      className={`scopa-card scopa-suit-${card.suit} ${selected ? 'is-selected' : ''} ${
        selectable ? 'is-selectable' : ''
      } ${small ? 'scopa-card-sm' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      title={`${RANK_LABEL[card.rank]} de ${SUIT_LABEL[card.suit]}`}
    >
      <span className="scopa-card-corner scopa-card-corner-top">{RANK_LABEL[card.rank]}</span>
      <span className="scopa-card-symbol">{SUIT_SYMBOL[card.suit]}</span>
      <span className="scopa-card-corner scopa-card-corner-bottom">{RANK_LABEL[card.rank]}</span>
    </motion.button>
  );
}
