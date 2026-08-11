import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BookOpen, Check, Copy, LogOut, Repeat2, TriangleAlert } from 'lucide-react';
import { useP4Room } from './net/useP4Room';
import { MODES, MODE_ORDER, discColor } from './engine/modes';
import { POWERS } from './engine/powers';
import { teamLabel } from './engine/rules';
import { Board } from './components/Board';
import { ConfirmPowerModal } from './components/ConfirmPowerModal';
import { P4RulesModal } from './components/P4RulesModal';
import { PowerBar } from './components/PowerBar';
import { VictoryOverlay } from './components/VictoryOverlay';
import type { Impact } from './components/ImpactFx';
import type { FxShot } from './components/PowerFx';
import type { P4Mode, PowerId } from './engine/types';

interface LocationState {
  isHost?: boolean;
  name?: string;
  mode?: P4Mode;
}

/** Roughly how long a disc takes to fall, so the dust lands with it. */
const FALL_MS = 300;

export function P4Room() {
  const { code = '' } = useParams();
  const location = useLocation();
  const navState = (location.state as LocationState | null) ?? null;

  const [name, setName] = useState(navState?.name ?? '');
  const [joined, setJoined] = useState(Boolean(navState?.name));
  const isHost = Boolean(navState?.isHost);
  const mode = navState?.mode ?? 'duel';

  if (!joined) {
    return (
      <div className="container p4-lobby">
        <h1>Rejoindre la room {code}</h1>
        <form
          className="p4-lobby-card"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (name.trim()) setJoined(true);
          }}
        >
          <label htmlFor="p4-pseudo2">Ton pseudo</label>
          <input
            id="p4-pseudo2"
            type="text"
            maxLength={18}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Jules"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Rejoindre la partie
          </button>
        </form>
        <Link to="/puissance4" className="p4-back-link">
          ← Retour au menu Puissance 4
        </Link>
      </div>
    );
  }

  return <P4GameView code={code} name={name} isHost={isHost} mode={mode} />;
}

function P4GameView({
  code,
  name,
  isHost,
  mode,
}: {
  code: string;
  name: string;
  isHost: boolean;
  mode: P4Mode;
}) {
  const { state, selfId, status, error, clearError, sendAction } = useP4Room(code, name, isHost, mode);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [confirming, setConfirming] = useState<PowerId | null>(null);
  const [armed, setArmed] = useState<PowerId | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [fxShot, setFxShot] = useState<FxShot | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const seenSeqRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendLockRef = useRef(false);
  /*
   * Effect-scoped timers would be wrong here: these belong to the *event*, not
   * to the render that noticed it. Clearing them on teardown meant any later
   * state broadcast — an opponent's move, a re-send — cancelled the pending
   * dismissal and left the banner frozen on screen. They are cleared on unmount
   * only.
   */
  const fxTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => fxTimersRef.current.forEach(clearTimeout), []);

  const seat = useMemo(
    () => state?.players.findIndex((p) => p.id === selfId) ?? -1,
    [state, selfId],
  );
  const me = seat >= 0 ? state?.players[seat] : undefined;
  const myTurn = state?.phase === 'playing' && state.turn === seat;

  /*
   * Every animation is driven off `lastEvent.seq` rather than off diffing the
   * board: the same power on the same column has to replay, and a state
   * re-broadcast must not.
   */
  useEffect(() => {
    if (!state) return;
    const event = state.lastEvent;
    if (event.seq === seenSeqRef.current) return;
    seenSeqRef.current = event.seq;

    const timers = fxTimersRef.current;

    if (event.kind === 'power' && event.power) {
      setFxShot({
        key: event.seq,
        power: event.power,
        caster: state.players[event.by ?? 0]?.name ?? '',
        col: event.col ?? null,
        cols: state.cols,
      });
      timers.push(setTimeout(() => setFxShot(null), 1400));
    }

    const landed = event.kind === 'drop' || (event.kind === 'power' && event.power === 'pierce');
    if (landed && event.cell !== undefined) {
      const cell = event.cell;
      timers.push(
        setTimeout(() => {
          setImpact({
            key: event.seq,
            row: Math.floor(cell / state.cols),
            col: cell % state.cols,
            cols: state.cols,
            rows: state.rows,
            color: discColor(state.mode, event.by ?? 0),
            inverted: event.inverted === true,
          });
          setShakeKey((k) => k + 1);
        }, FALL_MS),
      );
      timers.push(setTimeout(() => setImpact(null), FALL_MS + 700));
    }
  }, [state]);

  // An armed power must never survive the turn it was armed on.
  useEffect(() => {
    setArmed(null);
    setConfirming(null);
  }, [state?.turn, state?.phase]);

  useEffect(() => {
    if (!error) return;
    setActionError(error);
    const t = setTimeout(() => {
      setActionError(null);
      clearError();
    }, 3800);
    return () => clearTimeout(t);
  }, [error, clearError]);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  /** Debounced so an impatient double-tap cannot spend two turns. */
  const guardedSend = useCallback(
    (fn: () => void) => {
      if (sendLockRef.current) return;
      sendLockRef.current = true;
      setTimeout(() => {
        sendLockRef.current = false;
      }, 350);
      fn();
    },
    [],
  );

  const handleColumn = useCallback(
    (col: number) => {
      if (!state || !selfId || !myTurn) return;
      guardedSend(() => {
        if (armed === 'pierce') {
          sendAction({ type: 'DROP', playerId: selfId, col, pierce: true });
        } else if (armed === 'invert' || armed === 'block') {
          sendAction({ type: 'USE_POWER', playerId: selfId, power: armed, col });
        } else if (!armed) {
          sendAction({ type: 'DROP', playerId: selfId, col });
        }
        setArmed(null);
      });
    },
    [state, selfId, myTurn, armed, sendAction, guardedSend],
  );

  const handleCell = useCallback(
    (cell: number) => {
      if (!selfId || armed !== 'destroy') return;
      guardedSend(() => {
        sendAction({ type: 'USE_POWER', playerId: selfId, power: 'destroy', cell });
        setArmed(null);
      });
    },
    [selfId, armed, sendAction, guardedSend],
  );

  const confirmPower = useCallback(() => {
    if (!confirming || !selfId) return;
    const def = POWERS[confirming];
    setConfirming(null);
    if (def.target === 'none') {
      sendAction({ type: 'USE_POWER', playerId: selfId, power: confirming });
    } else {
      setArmed(confirming);
    }
  }, [confirming, selfId, sendAction]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
  };

  if (status === 'connecting') {
    return (
      <div className="container p4-status">
        <p>Connexion à la room {code}...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container p4-status">
        <p className="p4-form-error">{error ?? 'Une erreur est survenue.'}</p>
        <Link to="/puissance4" className="btn btn-outline">
          ← Retour au menu Puissance 4
        </Link>
      </div>
    );
  }

  if (!state) return null;

  const config = MODES[state.mode];
  const inGame = state.phase !== 'lobby';

  // Zoom the stage onto the winning alignment.
  const focus = state.winner
    ? {
        x:
          ((state.winner.cells.reduce((s, c) => s + (c % state.cols), 0) / state.winner.cells.length + 0.5) /
            state.cols) *
          100,
        y:
          ((state.rows -
            1 -
            state.winner.cells.reduce((s, c) => s + Math.floor(c / state.cols), 0) / state.winner.cells.length +
            0.5) /
            state.rows) *
          100,
      }
    : null;

  return (
    <div className="container p4-room">
      <P4RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ConfirmPowerModal
        power={confirming}
        usesLeft={confirming && me ? me.powers[confirming] : 0}
        onConfirm={confirmPower}
        onCancel={() => setConfirming(null)}
      />

      <div className="p4-room-topbar">
        <div>
          <h1>Puissance 4 — room {code}</h1>
          <div className="p4-topbar-actions">
            <button
              type="button"
              className={`btn btn-outline p4-chip-btn${copied ? ' is-copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check size={14} /> Copié !
                </>
              ) : (
                <>
                  <Copy size={14} /> Copier le code
                </>
              )}
            </button>
            <button type="button" className="btn btn-outline p4-chip-btn" onClick={() => setRulesOpen(true)}>
              <BookOpen size={14} /> Règles
            </button>
          </div>
        </div>
        <Link to="/puissance4" className="p4-back-link">
          <LogOut size={14} /> Quitter
        </Link>
      </div>

      {state.phase === 'lobby' && (
        <div className="p4-lobby-card p4-waiting">
          <h2>
            En attente de joueurs ({state.players.length}/{config.players})
          </h2>

          <ul className="p4-player-list">
            {state.players.map((p, i) => (
              <li key={p.id}>
                <span className="p4-dot" style={{ background: discColor(state.mode, i) }} />
                {p.name}
                {p.id === selfId ? ' (toi)' : ''}
                {config.teamNames && <em> — {config.teamNames[p.team]}</em>}
              </li>
            ))}
          </ul>

          {isHost ? (
            <>
              <div className="p4-mode-switch">
                <span className="p4-mode-switch-label">Mode</span>
                <div className="p4-mode-switch-row">
                  {MODE_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`p4-mode-pill${state.mode === id ? ' is-active' : ''}`}
                      disabled={state.players.length > MODES[id].players}
                      onClick={() => sendAction({ type: 'SET_MODE', mode: id })}
                    >
                      {MODES[id].label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={state.players.length !== config.players}
                onClick={() => sendAction({ type: 'START' })}
              >
                {state.players.length !== config.players
                  ? `Il faut être ${config.players} joueurs`
                  : 'Lancer la partie'}
              </button>
            </>
          ) : (
            <p>
              Mode <strong>{config.label}</strong>. En attente que l'hôte lance la partie...
            </p>
          )}
        </div>
      )}

      {inGame && (
        <>
          <div className="p4-scorebar">
            {state.players.map((p, i) => (
              <div
                key={p.id}
                className={`p4-score-row${i === state.turn && state.phase === 'playing' ? ' is-active' : ''}${
                  p.connected ? '' : ' is-gone'
                }`}
                style={{ '--p4-player-color': discColor(state.mode, i) } as CSSProperties}
              >
                <span className="p4-dot" />
                <span className="p4-score-name">
                  {p.name}
                  {p.id === selfId ? ' (toi)' : ''}
                </span>
                {config.teamNames && <span className="p4-score-team">{config.teamNames[p.team]}</span>}
                {i === state.turn && state.pendingDouble && (
                  <span className="p4-score-double" title="Double-tour actif">
                    <Repeat2 size={13} /> ×2
                  </span>
                )}
              </div>
            ))}
          </div>

          <div
            className={`p4-stage${state.winner ? ' is-won' : ''}`}
            style={
              focus ? ({ '--p4-focus-x': `${focus.x}%`, '--p4-focus-y': `${focus.y}%` } as CSSProperties) : undefined
            }
          >
            <Board
              state={state}
              seat={seat >= 0 ? seat : null}
              myTurn={Boolean(myTurn)}
              targeting={
                armed ? { power: armed, mode: POWERS[armed].target === 'disc' ? 'disc' : 'column' } : null
              }
              onColumn={handleColumn}
              onCell={handleCell}
              highlight={state.winner?.cells ?? []}
              shakeKey={shakeKey}
              impact={impact}
              onImpactDone={() => setImpact(null)}
              fxShot={fxShot}
              onFxDone={() => setFxShot(null)}
            />
          </div>

          {state.phase === 'playing' && (
            <p className="p4-turn-hint">
              {myTurn ? (
                armed ? (
                  <>
                    <strong>{POWERS[armed].name}</strong> — {POWERS[armed].target === 'disc'
                      ? 'choisis un jeton adverse'
                      : 'choisis une colonne'}
                  </>
                ) : (
                  <>À toi de jouer{state.pendingDouble ? ' — double-tour actif !' : ''}</>
                )
              ) : (
                <>Au tour de {state.players[state.turn]?.name}...</>
              )}
            </p>
          )}

          {me && (
            <PowerBar
              player={me}
              enabled={Boolean(myTurn) && !armed}
              armed={armed}
              pendingDouble={state.pendingDouble}
              onPick={setConfirming}
              onCancel={() => setArmed(null)}
            />
          )}

          {actionError && (
            <p className="p4-error-banner">
              <TriangleAlert size={15} /> {actionError}
            </p>
          )}

          <VictoryOverlay
            state={state}
            canRematch={isHost}
            onRematch={() => sendAction({ type: 'REMATCH' })}
          />
        </>
      )}

      {state.phase === 'won' && state.winner && (
        <p className="sr-only" role="status">
          {teamLabel(state, state.winner.team)} remporte la partie.
        </p>
      )}
    </div>
  );
}
