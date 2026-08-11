import { PlayingCard } from './PlayingCard';
import type { CardT } from '../engine/types';

interface CapturedPileProps {
  cards: CardT[];
  label: string;
}

/** Compact overlapping stack of a player's captured cards, with a live count. */
export function CapturedPile({ cards, label }: CapturedPileProps) {
  const visible = cards.slice(-10);

  return (
    <div className="scopa-pile">
      <div className="scopa-pile-stack" style={{ width: `${28 + visible.length * 10}px` }}>
        {visible.map((card, i) => (
          <div key={card.id} className="scopa-pile-card-slot" style={{ left: `${i * 10}px`, zIndex: i }}>
            <PlayingCard card={card} small />
          </div>
        ))}
        {visible.length === 0 && <div className="scopa-pile-empty" />}
      </div>
      <span className="scopa-pile-label">
        {label} · {cards.length}
      </span>
    </div>
  );
}
