import { motion, type PanInfo } from 'framer-motion';
import { RANK_LABEL, SUIT_LABEL, cardImageUrl } from '../engine/deck';
import type { CardT } from '../engine/types';

interface PlayingCardProps {
  card: CardT;
  selected?: boolean;
  selectable?: boolean;
  faceDown?: boolean;
  small?: boolean;
  /** Delay (in seconds) used for the staggered deal-in entrance animation. */
  dealDelay?: number;
  /** Resting position offset (fan spread, table scatter, ...). */
  restX?: number;
  restY?: number;
  restRotate?: number;
  zIndex?: number;
  draggable?: boolean;
  onDragRelease?: (info: PanInfo) => void;
  onClick?: () => void;
}

export function PlayingCard({
  card,
  selected,
  selectable,
  faceDown,
  small,
  dealDelay,
  restX = 0,
  restY = 0,
  restRotate = 0,
  zIndex,
  draggable,
  onDragRelease,
  onClick,
}: PlayingCardProps) {
  const isDeal = dealDelay !== undefined;
  const restState = { opacity: 1, x: restX, y: restY, rotate: restRotate, scale: 1 };
  const initialState = isDeal
    ? { opacity: 0, x: restX - 50, y: restY - 90, rotate: restRotate - 14, scale: 0.75 }
    : false;
  const transition = isDeal
    ? { type: 'spring' as const, stiffness: 260, damping: 20, delay: dealDelay }
    : { type: 'spring' as const, stiffness: 320, damping: 24 };

  if (faceDown) {
    return (
      <motion.div
        layout
        initial={initialState}
        animate={restState}
        transition={transition}
        style={{ zIndex }}
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
      initial={initialState}
      animate={restState}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={transition}
      style={{ zIndex, touchAction: draggable ? 'none' : undefined }}
      drag={draggable}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.1, zIndex: 80, boxShadow: '0 24px 40px rgba(0,0,0,0.35)' }}
      onDragEnd={(_e, info) => onDragRelease?.(info)}
      whileHover={selectable ? { y: restY - 8 } : undefined}
      className={`scopa-card scopa-suit-${card.suit} ${selected ? 'is-selected' : ''} ${
        selectable ? 'is-selectable' : ''
      } ${draggable ? 'is-draggable' : ''} ${small ? 'scopa-card-sm' : ''}`}
      onTap={onClick}
      disabled={!onClick && !draggable}
      title={`${RANK_LABEL[card.rank]} de ${SUIT_LABEL[card.suit]}`}
    >
      <img src={cardImageUrl(card)} alt="" draggable={false} className="scopa-card-img" />
    </motion.button>
  );
}
