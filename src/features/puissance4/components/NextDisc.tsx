import { motion } from 'framer-motion';
import { discColor } from '../engine/modes';
import { POWERS } from '../engine/powers';
import { POWER_ICONS } from './powerIcons';
import type { P4Mode, PowerId } from '../engine/types';

interface NextDiscProps {
  mode: P4Mode;
  seat: number;
  /** Power on the very next disc, or null for an ordinary one. */
  charge: PowerId | null;
  discsLeft: number;
  /** Dimmed while it is somebody else's move. */
  active: boolean;
}

/**
 * The player's own next disc, face up.
 *
 * Deliberately not a surprise. You never choose *which* power you get, but you
 * do choose where and when to spend it — and Traversée in particular changes
 * where the disc comes to rest, so springing it after the fact would turn your
 * own move against you. Knowing costs nothing and buys the whole tactical
 * layer; opponents' charges stay hidden (see the mask in `useP4Room`).
 */
export function NextDisc({ mode, seat, charge, discsLeft, active }: NextDiscProps) {
  const def = charge ? POWERS[charge] : null;
  const Icon = charge ? POWER_ICONS[charge] : null;
  const color = discColor(mode, seat);

  return (
    <div
      className={`p4-next${active ? ' is-active' : ''}${def ? ' is-charged' : ''}`}
      style={{ '--p4-next-color': def?.color ?? color } as React.CSSProperties}
    >
      <motion.span
        className="p4-next-disc"
        style={{ background: color }}
        // A charged disc has a pulse; a plain one sits still.
        animate={def && active ? { scale: [1, 1.07, 1] } : { scale: 1 }}
        transition={def && active ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <span className="p4-next-gloss" />
        {Icon && (
          <motion.span
            className="p4-next-badge"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          >
            <Icon size={14} strokeWidth={2.4} />
          </motion.span>
        )}
      </motion.span>

      <span className="p4-next-text">
        <span className="p4-next-label">
          {def ? (
            <>
              Prochain jeton : <strong>{def.name}</strong>
            </>
          ) : (
            'Prochain jeton : ordinaire'
          )}
        </span>
        <span className="p4-next-sub">
          {def ? def.short : `${discsLeft} jeton${discsLeft > 1 ? 's' : ''} restant${discsLeft > 1 ? 's' : ''}`}
        </span>
        {def && (
          <span className="p4-next-count">
            {discsLeft} jeton{discsLeft > 1 ? 's' : ''} restant{discsLeft > 1 ? 's' : ''}
          </span>
        )}
      </span>
    </div>
  );
}
