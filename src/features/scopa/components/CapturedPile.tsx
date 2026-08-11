import { PlayingCard } from './PlayingCard';
import type { CardT } from '../engine/types';

interface CapturedPileProps {
  cards: CardT[];
}

/** Compact fanned stack of a player's captured cards, with a live count. */
export function CapturedPile({ cards }: CapturedPileProps) {
  const visible = cards.slice(-6);

  return (
    <div className="scopa-pile">
      {visible.map((card, i) => (
        <div
          key={card.id}
          className="scopa-pile-card-slot"
          style={{
            transform: `translate(${i * 7}px, ${-i * 2}px) rotate(${(i - visible.length / 2) * 4}deg)`,
            zIndex: i,
          }}
        >
          <PlayingCard card={card} small />
        </div>
      ))}
      {cards.length > 0 && <span className="scopa-pile-count">{cards.length}</span>}
    </div>
  );
}
