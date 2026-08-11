import { RANK_LABEL, SUIT_LABEL, SUIT_SYMBOL } from '../engine/deck';
import type { CardT } from '../engine/types';

interface PlayingCardProps {
  card: CardT;
  selected?: boolean;
  selectable?: boolean;
  faceDown?: boolean;
  small?: boolean;
  onClick?: () => void;
}

export function PlayingCard({ card, selected, selectable, faceDown, small, onClick }: PlayingCardProps) {
  if (faceDown) {
    return <div className={`scopa-card scopa-card-back ${small ? 'scopa-card-sm' : ''}`} aria-hidden="true" />;
  }

  return (
    <button
      type="button"
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
    </button>
  );
}
