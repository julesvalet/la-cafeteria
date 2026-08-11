import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { ArrowUp, Lock } from 'lucide-react';
import { discColor } from '../engine/modes';
import { canDrop, cellIndex, isBlocked, isInverted, landingRow, teamMembers } from '../engine/rules';
import { POWERS } from '../engine/powers';
import { POWER_ICONS } from './powerIcons';
import type { P4State, PowerId } from '../engine/types';
import { ImpactFx, type Impact } from './ImpactFx';
import { PowerFx, type FxShot } from './PowerFx';

export type TargetMode = 'none' | 'column' | 'disc';

function GhostBadge({ power }: { power: PowerId }) {
  const Icon = POWER_ICONS[power];
  return (
    <span className="p4-ghost-badge" style={{ color: POWERS[power].color }}>
      <Icon size={15} strokeWidth={2.6} />
    </span>
  );
}

interface BoardProps {
  state: P4State;
  /** Seat index of the local player, or null when spectating. */
  seat: number | null;
  myTurn: boolean;
  /** Set while a landed power is waiting for this player to aim it. */
  targeting: { power: PowerId; mode: TargetMode } | null;
  /** Power on this player's next disc, previewed on the landing ghost. */
  nextCharge: PowerId | null;
  onColumn: (col: number) => void;
  onCell: (cell: number) => void;
  /** Cells that just won, so they can outshine everything else. */
  highlight: number[];
  shakeKey: number;
  /* Effects live inside the grid so their geometry lines up with the cells;
     the room only decides *when* they fire. */
  impact: Impact | null;
  fxShot: FxShot | null;
}

/** Cell size in px, measured so discs can be placed with pure transforms. */
function useCellSize(ref: React.RefObject<HTMLElement | null>, cols: number, rows: number) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth / cols, h: el.clientHeight / rows });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, cols, rows]);

  return size;
}

export function Board({
  state,
  seat,
  myTurn,
  targeting,
  nextCharge,
  onColumn,
  onCell,
  highlight,
  shakeKey,
  impact,
  fxShot,
}: BoardProps) {
  const { cols, rows } = state;
  const gridRef = useRef<HTMLDivElement>(null);
  const cell = useCellSize(gridRef, cols, rows);
  const highlightSet = useMemo(() => new Set(highlight), [highlight]);
  const shake = useAnimationControls();
  // Only the column under the cursor previews its landing slot. Showing every
  // column at once fills the bottom row with what look like real discs.
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // Fired imperatively: a declarative `animate` variant would only replay when
  // its *value* changed, so a second landing in a row would sit there silently.
  useEffect(() => {
    if (shakeKey <= 0) return;
    shake.start({
      x: [0, -4, 4, -3, 2, 0],
      y: [0, 3, -2, 1, 0, 0],
      transition: { duration: 0.36, ease: 'easeOut' },
    });
  }, [shakeKey, shake]);

  const myTeam = seat === null ? null : (state.players[seat]?.team ?? null);

  // Rows render top-down; the model stores them bottom-up.
  const rowOrder = useMemo(() => Array.from({ length: rows }, (_, i) => rows - 1 - i), [rows]);
  const colOrder = useMemo(() => Array.from({ length: cols }, (_, i) => i), [cols]);

  const interactive = myTurn && state.phase === 'playing';
  const pickingDisc = interactive && targeting?.mode === 'disc';
  const pickingColumn = interactive && targeting?.mode === 'column';

  const columnPlayable = (col: number) => {
    if (!interactive) return false;
    if (pickingDisc) return false;
    if (targeting?.power === 'block') return !isBlocked(state, col);
    if (targeting?.power === 'invert') return !isInverted(state, col);
    return canDrop(state, col);
  };

  const discTargetable = (owner: number) =>
    pickingDisc && myTeam !== null && state.players[owner]?.team !== myTeam;

  /*
   * Discs live in one flat layer rather than inside their cells. Nesting them
   * would turn every gravity shift into an unmount-plus-remount across two
   * different AnimatePresence boundaries; here a disc that moves simply gets a
   * new x/y and slides there, and it all stays on the compositor.
   */
  const discs = useMemo(
    () =>
      state.cells
        .map((disc, index) => (disc ? { disc, index } : null))
        .filter((entry): entry is { disc: Exclude<(typeof state.cells)[number], null>; index: number } =>
          Boolean(entry),
        ),
    [state.cells],
  );

  const dimOthers = highlight.length > 0;

  /*
   * Only a disc that was not on the board last render falls in from off-screen.
   * Without this, anything that remounts the layer — the first measured frame,
   * a resize — replays every disc's entry, and the board rains discs.
   */
  const seenIds = useRef<Set<string>>(new Set());
  const wasSeen = (id: string) => seenIds.current.has(id);
  useEffect(() => {
    seenIds.current = new Set(discs.map((d) => d.disc.id));
  }, [discs]);

  return (
    // The grid vars live here so the rail, the frame and the board all inherit
    // them — the wrapper needs them to cap its own width against the viewport.
    <div className="p4-board-wrap" style={{ '--p4-cols': cols, '--p4-rows': rows } as React.CSSProperties}>
      <div className="p4-col-rail">
        {colOrder.map((col) => (
          <div key={col} className="p4-col-flag">
            {isBlocked(state, col) && (
              <motion.span
                className="p4-flag p4-flag-block"
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                title={`Colonne ${col + 1} bloquée`}
              >
                <Lock size={13} />
              </motion.span>
            )}
            {isInverted(state, col) && (
              <motion.span
                className="p4-flag p4-flag-invert"
                initial={{ scale: 0, y: 6 }}
                animate={{ scale: 1, y: 0 }}
                title={`Gravité inversée colonne ${col + 1}`}
              >
                <ArrowUp size={13} />
              </motion.span>
            )}
          </div>
        ))}
      </div>

      <motion.div className="p4-board-frame" animate={shake}>
        <div
          ref={gridRef}
          className={`p4-board${targeting ? ' is-targeting' : ''}`}
          onPointerLeave={() => setHoverCol(null)}
        >
          {rowOrder.map((row) =>
            colOrder.map((col) => {
              const index = cellIndex(cols, row, col);
              const disc = state.cells[index] ?? null;
              const playable = columnPlayable(col);
              const targetable = disc ? discTargetable(disc.owner) : false;
              const isGhost =
                playable && !targeting && hoverCol === col && landingRow(state, col) === row;

              return (
                <button
                  type="button"
                  key={index}
                  className={[
                    'p4-cell',
                    playable ? 'is-playable' : '',
                    targetable ? 'is-targetable' : '',
                    isBlocked(state, col) ? 'is-blocked' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!playable && !targetable}
                  aria-label={
                    disc
                      ? `Colonne ${col + 1}, ligne ${row + 1}, jeton de ${state.players[disc.owner]?.name ?? '?'}`
                      : `Colonne ${col + 1}, ligne ${row + 1}, vide`
                  }
                  onPointerEnter={() => setHoverCol(col)}
                  onFocus={() => setHoverCol(col)}
                  onClick={() => {
                    if (targetable) onCell(index);
                    else if (playable) onColumn(col);
                  }}
                >
                  <span className="p4-hole" />
                  {isGhost && (
                    <span
                      className={`p4-ghost${nextCharge ? ' is-charged' : ''}`}
                      style={{ background: seat === null ? 'transparent' : discColor(state.mode, seat) }}
                    >
                      {/* Reminds you what this drop is about to unleash. */}
                      {nextCharge && <GhostBadge power={nextCharge} />}
                    </span>
                  )}
                </button>
              );
            }),
          )}

          {/*
            No AnimatePresence around the discs. With this many keyed children
            churning at once — a destroy resettles a whole column — exiting
            children could get stranded mid-teardown and stay on the board
            forever, showing a disc the state had already removed. A destroyed
            disc now simply goes, and the shockwave effect sells the removal.
          */}
          <div className="p4-disc-layer" aria-hidden="true">
            {cell.w > 0 &&
              discs.map(({ disc, index }) => {
                  const row = Math.floor(index / cols);
                  const col = index % cols;
                  const won = highlightSet.has(index);
                  // New discs enter from just off the board, on whichever side
                  // gravity is pulling them from.
                  const entryY = state.lastEvent.inverted ? rows * cell.h : -cell.h * 1.5;

                  return (
                    <motion.span
                      key={disc.id}
                      className={`p4-disc${won ? ' is-won' : ''}${dimOthers && !won ? ' is-dimmed' : ''}`}
                      style={{
                        width: cell.w,
                        height: cell.h,
                        background: discColor(state.mode, disc.owner),
                      }}
                      initial={
                        wasSeen(disc.id)
                          ? false
                          : { x: col * cell.w, y: entryY, scaleY: 1.3, scaleX: 0.82 }
                      }
                      animate={{ x: col * cell.w, y: (rows - 1 - row) * cell.h, scaleY: 1, scaleX: 1 }}
                      transition={{
                        y: { type: 'spring', stiffness: 520, damping: 26, mass: 0.85 },
                        x: { type: 'spring', stiffness: 420, damping: 30 },
                        scaleY: { duration: 0.32, ease: 'easeOut' },
                        scaleX: { duration: 0.32, ease: 'easeOut' },
                        default: { duration: 0.24, ease: 'easeOut' },
                      }}
                    >
                      <span className="p4-disc-face">
                        <span className="p4-disc-gloss" />
                      </span>
                    </motion.span>
                  );
                })}
          </div>

          <div className="p4-fx-layer" aria-hidden="true">
            <ImpactFx impact={impact} />
            <PowerFx shot={fxShot} />
          </div>
        </div>
      </motion.div>

      {targeting && (pickingColumn || pickingDisc) && (
        <p className="p4-target-hint" style={{ '--p4-power-color': POWERS[targeting.power].color } as React.CSSProperties}>
          <strong>{POWERS[targeting.power].name}</strong>
          {pickingDisc
            ? ` — désigne un jeton adverse${myTeam !== null && teamMembers(state, myTeam).length > 1 ? ' (pas ceux de ton équipe)' : ''}`
            : ' — désigne une colonne'}
        </p>
      )}
    </div>
  );
}
