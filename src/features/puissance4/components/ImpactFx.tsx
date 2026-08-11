import { motion } from 'framer-motion';

export interface Impact {
  key: number;
  row: number;
  col: number;
  cols: number;
  rows: number;
  color: string;
  /** Landed against inverted gravity, so the debris sprays the other way. */
  inverted: boolean;
}

interface ImpactFxProps {
  impact: Impact | null;
}

const SPARKS = 10;

/**
 * Dust and sparks kicked up where a disc lands.
 *
 * Like `PowerFx`, deliberately without AnimatePresence: a stalled exit left one
 * of these behind for every disc ever played. The room clears `impact` on a
 * timer instead.
 */
export function ImpactFx({ impact }: ImpactFxProps) {
  if (!impact) return null;

  return (
        <motion.span
          key={impact.key}
          className="p4-impact"
          style={{
            left: `calc(${impact.col + 0.5} * (100% / ${impact.cols}))`,
            top: `calc(${impact.rows - 1 - impact.row + 0.5} * (100% / ${impact.rows}))`,
          }}
          initial={{ opacity: 1 }}
        >
          <motion.span
            className="p4-impact-ring"
            style={{ borderColor: impact.color }}
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
          {Array.from({ length: SPARKS }, (_, i) => {
            // Spray sideways and away from the surface it slammed into.
            const spread = (i / (SPARKS - 1)) * Math.PI - Math.PI / 2;
            const dir = impact.inverted ? 1 : -1;
            return (
              <motion.span
                key={i}
                className="p4-impact-spark"
                style={{ background: impact.color }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.sin(spread) * (26 + Math.random() * 20),
                  y: dir * Math.abs(Math.cos(spread)) * (18 + Math.random() * 22),
                  opacity: 0,
                  scale: 0.3,
                }}
                transition={{ duration: 0.42 + Math.random() * 0.2, ease: 'easeOut' }}
              />
            );
          })}
        </motion.span>
  );
}
