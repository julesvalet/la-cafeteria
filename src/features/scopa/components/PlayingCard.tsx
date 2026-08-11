import { useEffect, useRef, useState } from 'react';
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
  /** Receives the pan info plus the card's on-screen rect at the moment it was released. */
  onDragRelease?: (info: PanInfo, rect: DOMRect | null) => void;
  onClick?: () => void;
}

/** How long the snap-back animation needs before the card may drop back down a layer. */
const SNAP_BACK_MS = 320;

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
  }, []);

  const isDeal = dealDelay !== undefined;
  const restState = { opacity: 1, x: restX, y: restY, rotate: restRotate };
  const initialState = isDeal
    ? { opacity: 0, x: restX - 50, y: restY - 90, rotate: restRotate - 14, scale: 0.75 }
    : false;
  const transition = isDeal
    ? { type: 'spring' as const, stiffness: 260, damping: 20, delay: dealDelay }
    : { type: 'spring' as const, stiffness: 320, damping: 24 };

  // z-index is deliberately kept out of the animated properties: Framer would
  // interpolate it numerically and the card would cross its neighbours' layers
  // mid-tween, which reads as erratic flickering. Driving it from state instead
  // makes it a discrete, predictable switch — lifted only while this card is the
  // one being pointed at or dragged, back to its stable slot right after.
  const isLifted = hovered || dragging;

  // The outer element owns placement (fan/scatter offset) and dragging; the inner
  // one owns the hover lift. They have to be separate elements: both effects are
  // a translate on the y axis, and if they share an element the hover animation
  // pins y and the card stops following the pointer vertically while dragged.
  return (
    <motion.div
      ref={wrapperRef}
      layout
      layoutId={faceDown ? undefined : card.id}
      className={`scopa-card-holder ${small ? 'scopa-card-holder-sm' : ''}`}
      initial={initialState}
      animate={restState}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={transition}
      style={{ zIndex: isLifted ? 90 : zIndex, touchAction: draggable ? 'none' : undefined }}
      drag={draggable}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.08 }}
      onDragStart={() => {
        if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
        setDragging(true);
      }}
      onDragEnd={(_e, info) => {
        onDragRelease?.(info, wrapperRef.current?.getBoundingClientRect() ?? null);
        // Stay on top until the snap-back has played out, so the card never
        // slides underneath a neighbour on its way home.
        releaseTimerRef.current = setTimeout(() => setDragging(false), SNAP_BACK_MS);
      }}
    >
      {faceDown ? (
        <div className="scopa-card scopa-card-back" aria-hidden="true" />
      ) : (
        <motion.button
          type="button"
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          whileHover={selectable && !dragging ? { y: -14, scale: 1.07 } : undefined}
          whileTap={selectable && !dragging ? { y: -14, scale: 1.07 } : undefined}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className={`scopa-card scopa-suit-${card.suit} ${selected ? 'is-selected' : ''} ${
            selectable ? 'is-selectable' : ''
          } ${draggable ? 'is-draggable' : ''}`}
          onTap={onClick}
          disabled={!onClick && !draggable}
          title={`${RANK_LABEL[card.rank]} de ${SUIT_LABEL[card.suit]}`}
        >
          <img src={cardImageUrl(card)} alt="" draggable={false} className="scopa-card-img" />
        </motion.button>
      )}
    </motion.div>
  );
}
