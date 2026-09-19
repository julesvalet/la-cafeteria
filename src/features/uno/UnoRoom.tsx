import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BookOpen, Check, Copy, Hand, LogOut, Megaphone, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useUnoRoom } from './net/useUnoRoom';
import { isWild } from './engine/deck';
import { UnoTable } from './components/UnoTable';
import { UnoHand } from './components/UnoHand';
import { UnoRulesModal } from './components/UnoRulesModal';
import { ColorPicker } from './components/ColorPicker';
import { MysteryReveal, type MysteryShot } from './components/MysteryReveal';
import { UnoFlash, type UnoShot } from './components/UnoFlash';
import { UnoVictory } from './components/UnoVictory';
import { useRecordGame } from '../account/useRecordGame';
import { unoOutcome } from '../account/gameOutcomes';
import { GameRecordBadge } from '../account/components/GameRecordBadge';
import { InviteFriendsButton } from '../social/components/InviteFriendsButton';
import { ObserverBar } from '../rooms/ObserverBar';
import { useRoomSession } from '../rooms/useRoomSession';
import { vacatedSeats } from '../rooms/spectators';
import type { UnoCard, UnoColor } from './engine/types';
import { useRoomIdentity } from '../rooms/playerName';

interface LocationState {
  isHost?: boolean;
  name?: string;
  maxPlayers?: number;
  stackingEnabled?: boolean;
  /** Choisi à la création : une table publique est annoncée aux amis. */
  visibility?: 'public' | 'private';
}

export function UnoRoom() {
  const { code = '' } = useParams();
  const location = useLocation();
  const navState = (location.state as LocationState | null) ?? null;

  // Connecté, on entre sous le pseudo du compte sans formulaire.
  const identity = useRoomIdentity(navState?.name);
  const isPublic = navState?.visibility === 'public';
  const isHost = Boolean(navState?.isHost);
  const maxPlayers = navState?.maxPlayers ?? 2;
  const stackingEnabled = navState?.stackingEnabled ?? false;

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
          <label htmlFor="uno-pseudo2">Ton pseudo</label>
          <input
            id="uno-pseudo2"
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
        <Link to="/uno" className="p4-back-link">
          ← Retour au menu UNO
        </Link>
      </div>
    );
  }

  return (
    <UnoGameView
      code={code}
      name={identity.name}
      isHost={isHost}
      isPublic={isPublic}
      maxPlayers={maxPlayers}
      stackingEnabled={stackingEnabled}
    />
  );
}

function UnoGameView({
  code,
  name,
  isHost,
  maxPlayers,
  stackingEnabled,
  isPublic,
}: {
  code: string;
  name: string;
  isHost: boolean;
  isPublic: boolean;
  maxPlayers: number;
  stackingEnabled: boolean;
}) {
  const { state, selfId, status, error, clearError, sendAction, spectators, requestSeat } = useUnoRoom(
    code,
    name,
    isHost,
    maxPlayers,
    stackingEnabled,
  );

  const [rulesOpen, setRulesOpen] = useState(false);
  const [pendingWild, setPendingWild] = useState<UnoCard | null>(null);
  const [mystery, setMystery] = useState<MysteryShot | null>(null);
  const [unoShot, setUnoShot] = useState<UnoShot | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const seenSeqRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendLockRef = useRef(false);
  // Belongs to the *event*, not the render that noticed it — cleared on unmount
  // only, so a later state broadcast cannot cancel a pending dismissal.
  const fxTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => fxTimersRef.current.forEach(clearTimeout), []);

  const seat = useMemo(() => state?.players.findIndex((p) => p.id === selfId) ?? -1, [state, selfId]);
  const me = seat >= 0 ? state?.players[seat] : undefined;
  const myTurn = state?.phase === 'playing' && state.turn === seat;
  // Connected, served the table, but without a seat: watching.
  const isSpectator = Boolean(state && selfId && seat < 0 && spectators.some((s) => s.id === selfId));

  useRoomSession({
    game: 'uno',
    code: code.toUpperCase(),
    isHost,
    isPublic,
    role: !state ? null : isSpectator ? 'spectator' : seat >= 0 ? 'player' : null,
    status: state?.phase === 'lobby' ? 'waiting' : 'playing',
    players: state?.players.filter((p) => p.connected).length ?? 0,
    maxPlayers: state?.maxPlayers ?? maxPlayers,
    spectators: spectators.length,
  });

  // Vaut `null` tant que personne n'a posé sa dernière carte. La revanche
  // produit une nouvelle signature, donc un nouvel enregistrement.
  const outcome = useMemo(() => unoOutcome(state, selfId, code), [state, selfId, code]);
  const record = useRecordGame(outcome);

  // Every announcement is driven off `lastEvent.seq` rather than off diffing
  // the state: the same effect can legitimately fire twice in a row.
  useEffect(() => {
    if (!state) return;
    const event = state.lastEvent;
    if (event.seq === seenSeqRef.current) return;
    seenSeqRef.current = event.seq;

    if (event.kind === 'mystery' && event.effect) {
      setMystery({
        key: event.seq,
        effect: event.effect,
        who: state.players[event.by ?? 0]?.name ?? '',
      });
      fxTimersRef.current.push(setTimeout(() => setMystery(null), 3600));
    }

    // Broadcast, so every seat sees the same announcement — including the
    // hollow ones, which are half the fun.
    if (event.kind === 'uno') {
      setUnoShot({
        key: event.seq,
        who: state.players[event.by ?? 0]?.name ?? '',
        legit: event.success !== false,
      });
      // Just past the 2.8s sequence, so the fade-out finishes on screen.
      fxTimersRef.current.push(setTimeout(() => setUnoShot(null), 3000));
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
    }, 300);
    fn();
  }, []);

  /*
   * A joker needs its colour before it can leave the hand, so it parks in
   * `pendingWild` and the picker resolves it. Everything else goes straight out.
   */
  const handlePlay = useCallback(
    (card: UnoCard) => {
      if (!selfId || !myTurn) return;
      if (isWild(card)) {
        setPendingWild(card);
        return;
      }
      guardedSend(() => sendAction({ type: 'PLAY_CARD', playerId: selfId, cardId: card.id }));
    },
    [selfId, myTurn, sendAction, guardedSend],
  );

  const handleColor = useCallback(
    (color: UnoColor) => {
      const card = pendingWild;
      setPendingWild(null);
      if (!selfId || !card) return;
      guardedSend(() => sendAction({ type: 'PLAY_CARD', playerId: selfId, cardId: card.id, chosenColor: color }));
    },
    [selfId, pendingWild, sendAction, guardedSend],
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
        <Link to="/uno" className="btn btn-outline">
          ← Retour au menu UNO
        </Link>
      </div>
    );
  }

  if (!state) return null;

  const inGame = state.phase !== 'lobby';
  const canDraw = Boolean(myTurn) && !state.hasDrawnThisTurn;
  const canPass = Boolean(myTurn) && state.hasDrawnThisTurn;

  return (
    <div className="container uno-room">
      <UnoRulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        stackingEnabled={state.stackingEnabled}
        mysteryEnabled={state.mysteryEnabled}
      />
      <ColorPicker open={pendingWild !== null} onPick={handleColor} onCancel={() => setPendingWild(null)} />
      <MysteryReveal shot={mystery} />
      <UnoFlash shot={unoShot} />

      <div className="p4-room-topbar">
        <div>
          <h1>UNO — room {code}</h1>
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
            <InviteFriendsButton game="uno" code={code} className="btn btn-outline p4-chip-btn" />
            <button type="button" className="btn btn-outline p4-chip-btn" onClick={() => setRulesOpen(true)}>
              <BookOpen size={14} /> Règles
            </button>
          </div>
        </div>
        <Link to="/uno" className="p4-back-link">
          <LogOut size={14} /> Quitter
        </Link>
      </div>

      <ObserverBar
        spectators={spectators}
        selfId={selfId}
        isSpectator={isSpectator}
        vacated={vacatedSeats(state.players)}
        onSeat={requestSeat}
        exitTo="/uno"
      />

      {state.phase === 'lobby' && (
        <div className="p4-lobby-card p4-waiting">
          <h2>
            En attente de joueurs ({state.players.length}/{state.maxPlayers})
          </h2>

          <ul className="p4-player-list">
            {state.players.map((p) => (
              <li key={p.id}>
                <span className="p4-dot" style={{ background: 'var(--color-primary)' }} />
                {p.name}
                {p.id === selfId ? ' (toi)' : ''}
              </li>
            ))}
          </ul>

          <p className="uno-lobby-options">
            Surenchère des + : <strong>{state.stackingEnabled ? 'activée' : 'désactivée'}</strong>
            {state.maxPlayers > 2 && <> — 2 cartes mystère seront mélangées dans la pioche.</>}
          </p>

          {isHost ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={state.players.length !== state.maxPlayers}
              onClick={() => sendAction({ type: 'START' })}
            >
              {state.players.length !== state.maxPlayers
                ? `Il faut être ${state.maxPlayers} joueurs`
                : 'Lancer la partie'}
            </button>
          ) : (
            <p>En attente que l'hôte lance la partie...</p>
          )}
        </div>
      )}

      {inGame && seat >= 0 && me && (
        <>
          <UnoTable
            state={state}
            seat={seat}
            canDraw={canDraw}
            onDraw={() => guardedSend(() => selfId && sendAction({ type: 'DRAW_CARD', playerId: selfId }))}
          />

          {state.phase === 'playing' && (
            <p className="p4-turn-hint">
              {myTurn ? (
                state.pendingDraw > 0 ? (
                  <>
                    <strong>+{state.pendingDraw}</strong> en attente — surenchéris ou pioche la pile
                  </>
                ) : state.hasDrawnThisTurn ? (
                  <>Tu as pioché — joue si tu peux, sinon passe</>
                ) : (
                  <>À toi de jouer</>
                )
              ) : (
                <>Au tour de {state.players[state.turn]?.name}...</>
              )}
            </p>
          )}

          <div className="uno-actions">
            <button
              type="button"
              className="btn btn-outline uno-action-btn"
              disabled={!canPass}
              onClick={() => guardedSend(() => selfId && sendAction({ type: 'PASS', playerId: selfId }))}
            >
              <Hand size={15} /> Passer
            </button>
            <button
              type="button"
              className="btn btn-primary uno-action-btn uno-btn-uno"
              disabled={state.phase !== 'playing'}
              onClick={() => guardedSend(() => selfId && sendAction({ type: 'DECLARE_UNO', playerId: selfId }))}
            >
              <Megaphone size={15} /> UNO
            </button>
            <button
              type="button"
              className="btn btn-outline uno-action-btn uno-btn-contre"
              disabled={state.phase !== 'playing'}
              onClick={() => guardedSend(() => selfId && sendAction({ type: 'CONTRE_UNO', playerId: selfId }))}
            >
              <ShieldAlert size={15} /> Contre UNO
            </button>
          </div>

          <UnoHand cards={me.hand} enabled={Boolean(myTurn)} onPlay={handlePlay} />

          {actionError && (
            <p className="p4-error-banner">
              <TriangleAlert size={15} /> {actionError}
            </p>
          )}

          <UnoVictory state={state} canRematch={isHost} onRematch={() => sendAction({ type: 'REMATCH' })}>
            <GameRecordBadge state={record} />
          </UnoVictory>
        </>
      )}

      {/* Observers see every seat as an opponent — card counts only, never
          the cards — and nothing on the table answers their clicks. */}
      {inGame && isSpectator && (
        <>
          <div className="obs-lock" inert>
            <UnoTable state={state} seat={-1} canDraw={false} onDraw={() => {}} />
            {state.phase === 'playing' && (
              <p className="p4-turn-hint">Au tour de {state.players[state.turn]?.name}...</p>
            )}
          </div>
          <UnoVictory state={state} canRematch={false} onRematch={() => {}} />
        </>
      )}
    </div>
  );
}
