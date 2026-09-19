import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BookOpen, Check, Copy, LogOut, Repeat2, TriangleAlert } from 'lucide-react';
import { useP4Room } from './net/useP4Room';
import { MODES, MODE_ORDER, discColor } from './engine/modes';
import { POWERS } from './engine/powers';
import { teamLabel } from './engine/rules';
import { Board } from './components/Board';
import { P4RulesModal } from './components/P4RulesModal';
import { NextDisc } from './components/NextDisc';
import { VictoryOverlay } from './components/VictoryOverlay';
import { useRecordGame } from '../account/useRecordGame';
import { p4Outcome } from '../account/gameOutcomes';
import { GameRecordBadge } from '../account/components/GameRecordBadge';
import { InviteFriendsButton } from '../social/components/InviteFriendsButton';
import { ObserverBar } from '../rooms/ObserverBar';
import { useRoomSession } from '../rooms/useRoomSession';
import { vacatedSeats } from '../rooms/spectators';
import type { Impact } from './components/ImpactFx';
import type { FxShot } from './components/PowerFx';
import type { P4Mode } from './engine/types';
import { useRoomIdentity } from '../rooms/playerName';

interface LocationState {
  isHost?: boolean;
  name?: string;
  mode?: P4Mode;
  /** Choisi à la création : une table publique est annoncée aux amis. */
  visibility?: 'public' | 'private';
}

/** Roughly how long a disc takes to fall, so the dust lands with it. */
const FALL_MS = 300;

export function P4Room() {
  const { code = '' } = useParams();
  const location = useLocation();
  const navState = (location.state as LocationState | null) ?? null;

  // Connecté, on entre sous le pseudo du compte sans formulaire.
  const identity = useRoomIdentity(navState?.name);
  const isPublic = navState?.visibility === 'public';
  const isHost = Boolean(navState?.isHost);
  const mode = navState?.mode ?? 'duel';

  if (identity.pending) {
    return (
      <div className="container p4-lobby">
        <p role="status">Connexion à ton compte…</p>
      </div>
    );
  }

  if (!identity.joined) {
    return (
      <div className="container p4-lobby">
        <h1>Rejoindre la room {code}</h1>
        <form
          className="p4-lobby-card"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            identity.confirm();
          }}
        >
          <label htmlFor="p4-pseudo2">Ton pseudo</label>
          <input
            id="p4-pseudo2"
            type="text"
            maxLength={18}
            value={identity.typed}
            onChange={(e) => identity.setTyped(e.target.value)}
            placeholder="ex: Jules"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!identity.typed.trim()}>
            Rejoindre la partie
          </button>
        </form>
        <Link to="/puissance4" className="p4-back-link">
          ← Retour au menu Puissance 4
        </Link>
      </div>
    );
  }

  return <P4GameView code={code} name={identity.name} isHost={isHost} mode={mode} isPublic={isPublic} />;
}

function P4GameView({
  code,
  name,
  isHost,
  mode,
  isPublic,
}: {
  code: string;
  name: string;
  isHost: boolean;
  mode: P4Mode;
  isPublic: boolean;
}) {
  const { state, selfId, status, error, clearError, sendAction, spectators, requestSeat } = useP4Room(code, name, isHost, mode);

  const [rulesOpen, setRulesOpen] = useState(false);
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
  // Connected and served the board, but seatless: watching. The board already
  // renders without a seat, and gates every click on `myTurn`.
  const isSpectator = Boolean(state && selfId && seat < 0 && spectators.some((s) => s.id === selfId));

  useRoomSession({
    game: 'puissance4',
    code: code.toUpperCase(),
    isHost,
    isPublic,
    role: !state ? null : isSpectator ? 'spectator' : seat >= 0 ? 'player' : null,
    status: state?.phase === 'lobby' ? 'waiting' : 'playing',
    players: state?.players.filter((p) => p.connected).length ?? 0,
    maxPlayers: MODES[state?.mode ?? mode].players,
    spectators: spectators.length,
  });

  // Null until the board resolves. A draw is recorded too — nobody scores, but
  // the game still counts towards a player's total.
  const outcome = useMemo(() => p4Outcome(state, selfId, code, 'puissance4'), [state, selfId, code]);
  const record = useRecordGame(outcome);

  /* The power of a disc I just landed, waiting for me to aim it. */
  const aiming = state?.pendingPower?.by === seat ? (state.pendingPower?.power ?? null) : null;
  const nextCharge = me?.charges[0] ?? null;

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

    // A disc physically landed: a plain drop, or one of the two powers that
    // announce themselves *as* the drop. An aimed power resolves later and
    // carries its target cell, not a landing, so it gets no impact.
    const landed =
      event.kind === 'drop' || (event.kind === 'power' && (event.power === 'pierce' || event.power === 'double'));
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

  /*
   * A column click means one of two things, and the engine's `pendingPower`
   * decides which: aim the power of the disc that just landed, or simply play
   * the next disc. Nothing here needs to know what that disc carries.
   */
  const handleColumn = useCallback(
    (col: number) => {
      if (!state || !selfId || !myTurn) return;
      guardedSend(() => {
        if (aiming) sendAction({ type: 'RESOLVE_POWER', playerId: selfId, col });
        else sendAction({ type: 'DROP', playerId: selfId, col });
      });
    },
    [state, selfId, myTurn, aiming, sendAction, guardedSend],
  );

  const handleCell = useCallback(
    (cell: number) => {
      if (!selfId || !aiming) return;
      guardedSend(() => sendAction({ type: 'RESOLVE_POWER', playerId: selfId, cell }));
    },
    [selfId, aiming, sendAction, guardedSend],
  );

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
      <P4RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} mode={state.mode} />

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
            <InviteFriendsButton game="puissance4" code={code} className="btn btn-outline p4-chip-btn" />
            <button type="button" className="btn btn-outline p4-chip-btn" onClick={() => setRulesOpen(true)}>
              <BookOpen size={14} /> Règles
            </button>
          </div>
        </div>
        <Link to="/puissance4" className="p4-back-link">
          <LogOut size={14} /> Quitter
        </Link>
      </div>

      <ObserverBar
        spectators={spectators}
        selfId={selfId}
        isSpectator={isSpectator}
        vacated={vacatedSeats(state.players)}
        onSeat={requestSeat}
        exitTo="/puissance4"
      />

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
                aiming ? { power: aiming, mode: POWERS[aiming].target === 'disc' ? 'disc' : 'column' } : null
              }
              nextCharge={myTurn && !aiming ? nextCharge : null}
              onColumn={handleColumn}
              onCell={handleCell}
              highlight={state.winner?.cells ?? []}
              shakeKey={shakeKey}
              impact={impact}
              fxShot={fxShot}
            />
          </div>

          {state.phase === 'playing' && (
            <p className="p4-turn-hint">
              {myTurn ? (
                aiming ? (
                  <>
                    <strong>{POWERS[aiming].name}</strong> — {POWERS[aiming].target === 'disc'
                      ? 'désigne un jeton adverse'
                      : 'désigne une colonne'}
                  </>
                ) : (
                  <>À toi de jouer{state.pendingDouble ? ' — double-tour, tu rejoues !' : ''}</>
                )
              ) : state.pendingPower ? (
                <>
                  {state.players[state.pendingPower.by]?.name} déclenche{' '}
                  <strong>{POWERS[state.pendingPower.power].name}</strong>...
                </>
              ) : (
                <>Au tour de {state.players[state.turn]?.name}...</>
              )}
            </p>
          )}

          {me && seat >= 0 && (
            <NextDisc
              mode={state.mode}
              seat={seat}
              charge={nextCharge}
              discsLeft={me.charges.length}
              active={Boolean(myTurn) && !aiming}
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
          >
            <GameRecordBadge state={record} />
          </VictoryOverlay>
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
