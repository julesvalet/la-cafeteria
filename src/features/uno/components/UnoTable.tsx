import { motion } from 'framer-motion';
import { RotateCw, RotateCcw } from 'lucide-react';
import { COLOR_HEX, COLOR_LABEL, isWild } from '../engine/deck';
import { UnoCardBack, UnoCardFace } from './UnoCardFace';
import type { UnoState } from '../engine/types';

interface UnoTableProps {
  state: UnoState;
  /** Seat of the local player, so opponents can be laid out around them. */
  seat: number;
  canDraw: boolean;
  onDraw: () => void;
}

/** Opponents' hands: a count and a fan of backs, never any contents. */
function Opponent({
  name,
  count,
  active,
  gone,
  declaredUno,
}: {
  name: string;
  count: number;
  active: boolean;
  gone: boolean;
  declaredUno: boolean;
}) {
  const shown = Math.min(count, 7);

  return (
    <div className={`uno-opponent${active ? ' is-active' : ''}${gone ? ' is-gone' : ''}`}>
      <div className="uno-opponent-cards">
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className="uno-opponent-card"
            style={{ transform: `translateX(${(i - (shown - 1) / 2) * 13}px) rotate(${(i - (shown - 1) / 2) * 4}deg)` }}
          >
            <UnoCardBack className="uno-card-svg" />
          </span>
        ))}
      </div>
      <div className="uno-opponent-meta">
        <span className="uno-opponent-name">{name}</span>
        <span className="uno-opponent-count">{count}</span>
        {declaredUno && <span className="uno-opponent-uno">UNO</span>}
      </div>
    </div>
  );
}

export function UnoTable({ state, seat, canDraw, onDraw }: UnoTableProps) {
  const top = state.discard[state.discard.length - 1] ?? null;
  // Everyone but you, in turn order starting from your left.
  const opponents = state.players
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i !== seat)
    .sort((a, b) => ((a.i - seat + state.players.length) % state.players.length)
      - ((b.i - seat + state.players.length) % state.players.length));

  const Direction = state.direction === 1 ? RotateCw : RotateCcw;

  return (
    <div className="uno-table">
      <div className="uno-opponents">
        {opponents.map(({ p, i }) => (
          <Opponent
            key={p.id}
            name={p.name}
            count={p.handCount}
            active={state.turn === i && state.phase === 'playing'}
            gone={!p.connected}
            declaredUno={p.hasDeclaredUno}
          />
        ))}
      </div>

      <div className="uno-center">
        <button
          type="button"
          className={`uno-pile uno-draw-pile${canDraw ? ' is-active' : ''}`}
          onClick={onDraw}
          disabled={!canDraw}
          aria-label={`Piocher une carte (${state.deck.length} restantes)`}
        >
          <UnoCardBack className="uno-card-svg" />
          <span className="uno-pile-count">{state.deck.length}</span>
        </button>

        <div className="uno-center-info">
          <span
            className="uno-active-color"
            style={{ background: COLOR_HEX[state.activeColor] }}
            title={`Couleur active : ${COLOR_LABEL[state.activeColor]}`}
          >
            <span className="sr-only">Couleur active : {COLOR_LABEL[state.activeColor]}</span>
          </span>
          <span className="uno-direction" title={state.direction === 1 ? 'Sens horaire' : 'Sens anti-horaire'}>
            <Direction size={18} />
          </span>
          {state.pendingDraw > 0 && (
            <motion.span
              className="uno-pending"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            >
              +{state.pendingDraw}
            </motion.span>
          )}
        </div>

        <div className="uno-pile uno-discard-pile">
          {top && (
            <motion.span
              key={top.id}
              className="uno-discard-card"
              initial={{ scale: 0.6, y: -40, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            >
              <UnoCardFace card={top} tint={isWild(top) ? state.activeColor : undefined} className="uno-card-svg" />
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
