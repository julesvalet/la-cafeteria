import { AnimatePresence, motion } from 'framer-motion';

interface ScopaFlashProps {
  playerName: string | null;
}

const PARTICLES = Array.from({ length: 14 }, (_, i) => i);

export function ScopaFlash({ playerName }: ScopaFlashProps) {
  return (
    <AnimatePresence>
      {playerName && (
        <motion.div
          className="scopa-flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="scopa-flash-banner"
            initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            <span className="scopa-flash-title">SCOPA !</span>
            <span className="scopa-flash-name">{playerName}</span>
          </motion.div>
          {PARTICLES.map((i) => {
            const angle = (i / PARTICLES.length) * Math.PI * 2;
            const distance = 120 + (i % 3) * 40;
            return (
              <motion.span
                key={i}
                className="scopa-flash-particle"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  opacity: 0,
                  scale: 0.4,
                }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
