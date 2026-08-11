import { motion } from 'framer-motion';

interface DeckPileProps {
  count: number;
}

/** Visual pioche (draw pile) sitting on the table, purely decorative. */
export function DeckPile({ count }: DeckPileProps) {
  if (count <= 0) return null;

  const layers = Math.min(4, Math.ceil(count / 10));

  return (
    <div className="scopa-deck" title={`${count} cartes restantes dans la pioche`}>
      {Array.from({ length: layers }).map((_, i) => (
        <motion.div
          key={i}
          className="scopa-deck-card"
          style={{ top: -i * 2, left: -i * 2 }}
          initial={false}
          animate={{ top: -i * 2, left: -i * 2 }}
        />
      ))}
      <span className="scopa-deck-count">{count}</span>
    </div>
  );
}
