import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BookOpen, Check, Copy, LogOut, TriangleAlert } from 'lucide-react';
import { GameTitle } from '../../../components/GameTitle';
import { useP4Room } from '../net/useP4Room';
import { ORIGINAL_MODES, MODE_ORDER, discColor } from '../engine/modes';
import { teamLabel } from '../engine/rules';
import { Board } from '../components/Board';
import { OriginalRulesModal } from './OriginalRulesModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { useRecordGame } from '../../account/useRecordGame';
import { p4Outcome } from '../../account/gameOutcomes';
import { GameRecordBadge } from '../../account/components/GameRecordBadge';
import { InviteFriendsButton } from '../../social/components/InviteFriendsButton';
import { ObserverBar } from '../../rooms/ObserverBar';
import { useRoomSession } from '../../rooms/useRoomSession';
import { vacatedSeats } from '../../rooms/spectators';
import type { Impact } from '../components/ImpactFx';
import type { P4Mode } from '../engine/types';
import { useRoomIdentity } from '../../rooms/playerName';

interface LocationState {
  isHost?: boolean;
  name?: string;
  mode?: P4Mode;
  /** Choisi à la création : une table publique est annoncée aux amis. */
  visibility?: 'public' | 'private';
}

/** Roughly how long a disc takes to fall, so the dust lands with it. */
const FALL_MS = 300;

export function OriginalRoom() {
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
          <label htmlFor="p4o-pseudo2">Ton pseudo</label>
          <input
            id="p4o-pseudo2"
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
        <Link to="/puissance4-original" className="p4-back-link">
          ← Retour au menu P4 Classic
        </Link>
      </div>
    );
  }

  return <OriginalGameView code={code} name={identity.name} isHost={isHost} mode={mode} isPublic={isPublic} />;
}

function OriginalGameView({
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
  const { state, selfId, status, error, clearError, sendAction, spectators, requestSeat } = useP4Room(code, name, isHost, mode, 'original');

  const [rulesOpen, setRulesOpen] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const seenSeqRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendLockRef = useRef(false);
  const fxTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => fxTimersRef.current.forEach(clearTimeout), []);

  const seat = useMemo(() => state?.players.findIndex((p) => p.id === selfId) ?? -1, [state, selfId]);
  const myTurn = state?.phase === 'playing' && state.turn === seat;
  // Connected and served the board, but seatless: watching. The board already
  // renders without a seat, and gates every click on `myTurn`.
  const isSpectator = Boolean(state && selfId && seat < 0 && spectators.some((s) => s.id === selfId));

  useRoomSession({
    game: 'puissance4-original',
    code: code.toUpperCase(),
    isHost,
    isPublic,
    role: !state ? null : isSpectator ? 'spectator' : seat >= 0 ? 'player' : null,
    status: state?.phase === 'lobby' ? 'waiting' : 'playing',
    players: state?.players.filter((p) => p.connected).length ?? 0,
    maxPlayers: ORIGINAL_MODES[state?.mode ?? mode].players,
    spectators: spectators.length,
  });

  // La variante sans pouvoirs a son propre identifiant de jeu : un classement
  // « Puissance 4 » ne doit pas mélanger deux jeux aux règles différentes.
  const outcome = useMemo(
    () => p4Outcome(state, selfId, code, 'puissance4-original'),
    [state, selfId, code],
  );
  const record = useRecordGame(outcome);

  useEffect(() => {
    if (!state) return;
    const event = state.lastEvent;
    if (event.seq === seenSeqRef.current) return;
    seenSeqRef.current = event.seq;

    const timers = fxTimersRef.current;

    if (event.kind === 'drop' && event.cell !== undefined) {
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
            inverted: false,
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
  const guardedSend = useCallback((fn: () => void) => {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setTimeout(() => {
      sendLockRef.current = false;
    }, 350);
    fn();
  }, []);

  const handleColumn = useCallback(
    (col: number) => {
      if (!state || !selfId || !myTurn) return;
      guardedSend(() => sendAction({ type: 'DROP', playerId: selfId, col }));
    },
    [state, selfId, myTurn, sendAction, guardedSend],
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
        <Link to="/puissance4-original" className="btn btn-outline">
          ← Retour au menu P4 Classic
        </Link>
      </div>
    );
  }

  if (!state) return null;

  const config = ORIGINAL_MODES[state.mode];
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
      <OriginalRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <div className="p4-room-topbar">
        <div>
          <GameTitle as="h1" game="puissance4-original" suffix={`room ${code}`} className="gt-room" />
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
            <InviteFriendsButton game="puissance4-original" code={code} className="btn btn-outline p4-chip-btn" />
            <button type="button" className="btn btn-outline p4-chip-btn" onClick={() => setRulesOpen(true)}>
              <BookOpen size={14} /> Règles
            </button>
          </div>
        </div>
        <Link to="/puissance4-original" className="p4-back-link">
          <LogOut size={14} /> Quitter
        </Link>
      </div>

      <ObserverBar
        spectators={spectators}
        selfId={selfId}
        isSpectator={isSpectator}
        vacated={vacatedSeats(state.players)}
        onSeat={requestSeat}
        exitTo="/puissance4-original"
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
                      disabled={state.players.length > ORIGINAL_MODES[id].players}
                      onClick={() => sendAction({ type: 'SET_MODE', mode: id })}
                    >
                      {ORIGINAL_MODES[id].label}
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
              targeting={null}
              nextCharge={null}
              onColumn={handleColumn}
              onCell={() => undefined}
              highlight={state.winner?.cells ?? []}
              shakeKey={shakeKey}
              impact={impact}
              fxShot={null}
            />
          </div>

          {state.phase === 'playing' && (
            <p className="p4-turn-hint">{myTurn ? 'À toi de jouer' : `Au tour de ${state.players[state.turn]?.name}...`}</p>
          )}

          {actionError && (
            <p className="p4-error-banner">
              <TriangleAlert size={15} /> {actionError}
            </p>
          )}

          <VictoryOverlay state={state} canRematch={isHost} onRematch={() => sendAction({ type: 'REMATCH' })}>
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
