import { motion } from 'framer-motion';
import { POWERS } from '../engine/powers';
import { POWER_ICONS } from './powerIcons';
import type { PowerId } from '../engine/types';

export interface FxShot {
  /** Event sequence number, so a repeated power still replays. */
  key: number;
  power: PowerId;
  caster: string;
  /** Column the effect targets, 0-based, or null for board-wide. */
  col: number | null;
  cols: number;
}

interface PowerFxProps {
  shot: FxShot | null;
}

/**
 * The "special move" layer. Each power gets its own signature: a beam, a
 * shockwave, a rising tide, a slam. It sits over the board and ignores pointer
 * events.
 *
 * No AnimatePresence: on a guest — whose state arrives from a PeerJS callback
 * rather than a React event — the exit animation would stall and every effect
 * ever fired stayed in the DOM, stacking up over the board. Each shot already
 * fades itself out through its own keyframes, and the room clears `shot` on a
 * timer, so teardown is deterministic and unmounting is instant.
 */
export function PowerFx({ shot }: PowerFxProps) {
  if (!shot) return null;

  return (
    <motion.div key={shot.key} className="p4-fx" initial={{ opacity: 1 }} animate={{ opacity: 1 }}>
      <ShotBody shot={shot} />
      {/* Centred by flex, not by a translate: framer-motion writes its own
          `transform`, which would wipe out a CSS centring translate. */}
      <span className="p4-fx-banner-slot">
        <Banner shot={shot} />
      </span>
    </motion.div>
  );
}

function columnStyle(shot: FxShot): React.CSSProperties | undefined {
  if (shot.col === null) return undefined;
  return {
    left: `calc(${shot.col} * (100% / ${shot.cols}))`,
    width: `calc(100% / ${shot.cols})`,
  };
}

function ShotBody({ shot }: { shot: FxShot }) {
  const color = POWERS[shot.power].color;
  const col = columnStyle(shot);

  if (shot.power === 'pierce') {
    return (
      <>
        <motion.span
          className="p4-fx-beam"
          style={{ ...col, background: `linear-gradient(180deg, transparent, ${color}, transparent)` }}
          initial={{ opacity: 0, scaleY: 0.2 }}
          animate={{ opacity: [0, 1, 0.7, 0], scaleY: [0.2, 1, 1, 1] }}
          transition={{ duration: 0.75, times: [0, 0.2, 0.5, 1], ease: 'easeOut' }}
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="p4-fx-speedline"
            style={{ ...col, background: color }}
            initial={{ opacity: 0.9, y: '-40%', scaleY: 0.4 }}
            animate={{ opacity: 0, y: '110%', scaleY: 1 }}
            transition={{ duration: 0.5, delay: i * 0.045, ease: 'easeIn' }}
          />
        ))}
      </>
    );
  }

  if (shot.power === 'destroy') {
    return (
      <>
        <motion.span
          className="p4-fx-flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {[0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            className="p4-fx-ring"
            style={{ ...col, borderColor: color }}
            initial={{ opacity: 0.85, scale: 0.1 }}
            animate={{ opacity: 0, scale: 2.6 + ring * 0.5 }}
            transition={{ duration: 0.7, delay: ring * 0.08, ease: 'easeOut' }}
          />
        ))}
        {Array.from({ length: 14 }, (_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          return (
            <motion.span
              key={`d${i}`}
              className="p4-fx-shard"
              style={{ ...col, background: color }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{
                opacity: 0,
                x: Math.cos(angle) * 120,
                y: Math.sin(angle) * 120,
                scale: 0.2,
                rotate: angle * 90,
              }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            />
          );
        })}
      </>
    );
  }

  if (shot.power === 'invert') {
    return (
      <>
        <motion.span
          className="p4-fx-column-wash"
          style={{ ...col, background: `linear-gradient(0deg, ${color}00, ${color}66, ${color}00)` }}
          initial={{ opacity: 0, y: '60%' }}
          animate={{ opacity: [0, 1, 0], y: '-60%' }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        />
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="p4-fx-chevron"
            style={{ ...col, borderBottomColor: color }}
            initial={{ opacity: 0, y: '90%' }}
            animate={{ opacity: [0, 1, 0], y: '-20%' }}
            transition={{ duration: 0.7, delay: i * 0.09, ease: 'easeOut' }}
          />
        ))}
      </>
    );
  }

  if (shot.power === 'block') {
    return (
      <>
        <motion.span
          className="p4-fx-slam"
          style={{ ...col, background: `repeating-linear-gradient(135deg, ${color}, ${color} 10px, #2b241d 10px, #2b241d 20px)` }}
          initial={{ opacity: 0, scaleY: 0.1, y: '-30%' }}
          animate={{ opacity: [0, 1, 0.85, 0], scaleY: [0.1, 1, 1, 1], y: 0 }}
          transition={{ duration: 0.85, times: [0, 0.22, 0.6, 1], ease: 'easeOut' }}
        />
        <motion.span
          className="p4-fx-flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 0.35 }}
        />
      </>
    );
  }

  // double
  return (
    <>
      <motion.span
        className="p4-fx-flash"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="p4-fx-sweep"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          initial={{ opacity: 0, x: '-120%', skewX: -18 }}
          animate={{ opacity: [0, 0.9, 0], x: '120%' }}
          transition={{ duration: 0.6, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

function Banner({ shot }: { shot: FxShot }) {
  const def = POWERS[shot.power];
  const Icon = POWER_ICONS[shot.power];

  return (
    <motion.div
      className="p4-fx-banner"
      style={{ '--p4-power-color': def.color } as React.CSSProperties}
      initial={{ opacity: 0, scale: 1.35, y: 10 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [1.35, 1, 1, 1.06], y: 0 }}
      transition={{ duration: 1.25, times: [0, 0.16, 0.75, 1], ease: 'easeOut' }}
    >
      <span className="p4-fx-banner-icon">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <span className="p4-fx-banner-text">
        <em>{shot.caster}</em>
        <strong>{def.name}</strong>
      </span>
    </motion.div>
  );
}
