import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { PanInfo } from 'framer-motion';
import { Copy, Check, BookOpen, LogOut, TriangleAlert, Trophy, Sparkles } from 'lucide-react';
import { useScopaRoom } from './net/useScopaRoom';
import { PlayingCard } from './components/PlayingCard';
import { Avatar } from './components/Avatar';
import { CapturedPile } from './components/CapturedPile';
import { DeckPile } from './components/DeckPile';
import { ScopaFlash } from './components/ScopaFlash';
import { RulesModal } from './components/RulesModal';
import { AnimatedNumber } from './components/AnimatedNumber';
import { fanTransform, handCardScale, scatterTransform, tableCardScale } from './utils/layout';
import type { CardT } from './engine/types';

interface LocationState {
  isHost?: boolean;
  name?: string;
}

const DEAL_STEP = 0.06;

const SEAT_CLASSES: Record<number, string[]> = {
  1: ['scopa-seat-top'],
  2: ['scopa-seat-top-left', 'scopa-seat-top-right'],
  3: ['scopa-seat-left', 'scopa-seat-top', 'scopa-seat-right'],
};

export function ScopaRoom() {
  const { code = '' } = useParams();
  const location = useLocation();
  const navState = (location.state as LocationState | null) ?? null;

  const [name, setName] = useState(navState?.name ?? '');
  const [joined, setJoined] = useState(Boolean(navState?.name));
  const isHost = Boolean(navState?.isHost);

  if (!joined) {
    return (
      <div className="container scopa-lobby">
        <h1>Rejoindre la room {code}</h1>
        <form
          className="scopa-lobby-card"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (name.trim()) setJoined(true);
          }}
        >
          <label htmlFor="pseudo2">Ton pseudo</label>
          <input
            id="pseudo2"
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
        <Link to="/scopa" className="scopa-back-link">
          ← Retour au menu Scopa
        </Link>
      </div>
    );
  }

  return <ScopaGameView code={code} name={name} isHost={isHost} />;
}

function ScopaGameView({ code, name, isHost }: { code: string; name: string; isHost: boolean }) {
  const { state, selfId, status, error, sendAction } = useScopaRoom(code, name, isHost);

  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [scopaFlashName, setScopaFlashName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tableFeltRef = useRef<HTMLDivElement>(null);
  const lastErrorRef = useRef<string | null>(null);
  const prevScopeRef = useRef<number[]>([]);
  const lastHandNumberRef = useRef(0);
  const lastTotalHandRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playLockRef = useRef(false);

  const myIndex = useMemo(() => state?.players.findIndex((p) => p.id === selfId) ?? -1, [state, selfId]);
  const me = myIndex >= 0 ? state?.players[myIndex] : undefined;
  const isMyTurn = state?.phase === 'playing' && state.turn === myIndex;

  const orderedOpponents = useMemo(() => {
    if (!state || myIndex < 0) return [];
    const n = state.players.length;
    const result: { player: (typeof state.players)[number]; index: number }[] = [];
    for (let i = 1; i < n; i++) {
      const index = (myIndex + i) % n;
      result.push({ player: state.players[index], index });
    }
    return result;
  }, [state, myIndex]);

  const seatClasses = SEAT_CLASSES[orderedOpponents.length] ?? [];

  // Compute a stagger-delay map for cards that just got dealt, so PlayingCard
  // can play its deal-in entrance the moment it first mounts.
  const dealDelays = new Map<string, number>();
  if (state) {
    const totalHand = state.players.reduce((sum, p) => sum + p.hand.length, 0);
    const isNewHand = state.handNumber !== lastHandNumberRef.current;
    const isRedeal = !isNewHand && lastTotalHandRef.current === 0 && totalHand > 0 && state.phase === 'playing';

    if (isNewHand || isRedeal) {
      let idx = 0;
      if (isNewHand) {
        for (const card of state.table) dealDelays.set(card.id, idx++ * DEAL_STEP);
      }
      for (const p of state.players) {
        for (const card of p.hand) dealDelays.set(card.id, idx++ * DEAL_STEP);
      }
    }
    lastHandNumberRef.current = state.handNumber;
    lastTotalHandRef.current = totalHand;
  }

  // Detect a scopa (a player's scope count just went up) to trigger the celebration overlay.
  useEffect(() => {
    if (!state) return;
    const prev = prevScopeRef.current;
    if (prev.length === state.players.length) {
      const scorer = state.players.find((p, i) => p.scope > (prev[i] ?? 0));
      if (scorer) {
        setScopaFlashName(scorer.name);
        const t = setTimeout(() => setScopaFlashName(null), 1600);
        prevScopeRef.current = state.players.map((p) => p.scope);
        return () => clearTimeout(t);
      }
    }
    prevScopeRef.current = state.players.map((p) => p.scope);
  }, [state]);

  // Surface action errors (illegal captures, etc.) as a transient banner.
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      setActionError(error);
      const t = setTimeout(() => setActionError(null), 3800);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Clear any pending table-card selection whenever the turn changes.
  useEffect(() => {
    setSelectedTableIds([]);
  }, [state?.turn, state?.phase]);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  if (status === 'connecting') {
    return (
      <div className="container scopa-status">
        <p>Connexion à la room {code}...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container scopa-status">
        <p className="scopa-form-error">{error ?? 'Une erreur est survenue.'}</p>
        <Link to="/scopa" className="btn btn-outline">
          ← Retour au menu Scopa
        </Link>
      </div>
    );
  }

  if (!state) return null;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
  };

  const toggleTableCard = (cardId: string) => {
    if (!isMyTurn) return;
    setSelectedTableIds((ids) => (ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId]));
  };

  const commitPlay = (card: CardT, captureIds?: string[]) => {
    if (!isMyTurn || !selfId || playLockRef.current) return;
    // Guard against a single gesture (or an impatient double-tap) sending two plays.
    playLockRef.current = true;
    setTimeout(() => {
      playLockRef.current = false;
    }, 400);
    sendAction({
      type: 'PLAY_CARD',
      playerId: selfId,
      cardId: card.id,
      captureCardIds: captureIds ?? selectedTableIds,
    });
    setSelectedTableIds([]);
  };

  /**
   * Which table card, if any, the dropped card was released on top of. Table
   * cards render in `state.table` order inside the zone, so DOM order maps
   * straight onto the model. Requires a solid overlap so that merely landing
   * near a card doesn't get read as an intent to capture it.
   */
  const findDropTargetCardId = (rect: DOMRect | null): string | null => {
    if (!rect || !state) return null;
    const zone = tableFeltRef.current?.querySelector('.scopa-table-cards-zone');
    if (!zone) return null;

    let bestId: string | null = null;
    let bestArea = 0;
    zone.querySelectorAll('.scopa-card').forEach((node, i) => {
      const target = state.table[i];
      if (!target) return;
      const r = node.getBoundingClientRect();
      const overlapW = Math.min(rect.right, r.right) - Math.max(rect.left, r.left);
      const overlapH = Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top);
      if (overlapW <= 0 || overlapH <= 0) return;
      const area = overlapW * overlapH;
      if (area / (r.width * r.height) > 0.3 && area > bestArea) {
        bestArea = area;
        bestId = target.id;
      }
    });
    return bestId;
  };

  const handleDragRelease = (card: CardT, _info: PanInfo, rect: DOMRect | null) => {
    if (!isMyTurn) return;
    const felt = tableFeltRef.current?.getBoundingClientRect();
    if (!felt || !rect) return;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const overTable = cx >= felt.left && cx <= felt.right && cy >= felt.top && cy <= felt.bottom;
    if (!overTable) return; // released off the table: the card just snaps back

    // Cards explicitly picked out on the table win (that's how sum captures over
    // several cards are designated); otherwise dropping straight onto a card
    // designates that one, and dropping on bare felt simply lays the card down.
    if (selectedTableIds.length > 0) {
      commitPlay(card);
    } else {
      const targetId = findDropTargetCardId(rect);
      commitPlay(card, targetId ? [targetId] : []);
    }
  };

  return (
    <div className="container scopa-room">
      <ScopaFlash playerName={scopaFlashName} />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <div className="scopa-room-topbar">
        <div>
          <h1>Scopa — room {code}</h1>
          <div className="scopa-topbar-actions">
            <button
              type="button"
              className={`btn btn-outline scopa-invite-btn ${copied ? 'is-copied' : ''}`}
              onClick={handleCopyCode}
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
            <button type="button" className="btn btn-outline scopa-invite-btn" onClick={() => setRulesOpen(true)}>
              <BookOpen size={14} /> Règles
            </button>
          </div>
        </div>
        <Link to="/scopa" className="scopa-back-link">
          <LogOut size={14} /> Quitter
        </Link>
      </div>

      {state.phase === 'lobby' && (
        <div className="scopa-lobby-card">
          <h2>En attente de joueurs ({state.players.length}/4)</h2>
          <ul className="scopa-player-list">
            {state.players.map((p) => (
              <li key={p.id}>
                {p.name}
                {p.id === selfId ? ' (toi)' : ''}
              </li>
            ))}
          </ul>
          {isHost ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={state.players.length < 2}
              onClick={() => sendAction({ type: 'START' })}
            >
              {state.players.length < 2 ? 'Il faut au moins 2 joueurs' : 'Lancer la partie'}
            </button>
          ) : (
            <p>En attente que l'hôte lance la partie...</p>
          )}
        </div>
      )}

      {(state.phase === 'playing' || state.phase === 'hand-end' || state.phase === 'match-end') && me && (
        <>
          <div className="scopa-score-bar">
            {state.players.map((p, i) => (
              <div key={p.id} className={`scopa-score-row ${i === state.turn && state.phase === 'playing' ? 'is-active' : ''}`}>
                <span className="scopa-score-dot" style={{ opacity: p.connected ? 1 : 0.35 }} />
                <span className="scopa-score-name">
                  {p.name}
                  {p.id === selfId ? ' (toi)' : ''}
                </span>
                <span className="scopa-score-pts">
                  <AnimatedNumber value={state.matchScores[i] ?? 0} />
                </span>
              </div>
            ))}
            <span className="scopa-score-target">objectif {state.targetScore} pts</span>
          </div>
          <div className="scopa-scene">

          <div className="scopa-table-felt" ref={tableFeltRef}>
            <DeckPile count={state.deck.length} />
            <div
              className="scopa-table-cards-zone"
              style={{ '--card-scale': tableCardScale(state.table.length) } as CSSProperties}
            >
              {state.table.length === 0 && <p className="scopa-empty">Table vide</p>}
              {state.table.map((c, idx) => {
                const scatter = scatterTransform(c.id);
                return (
                  <PlayingCard
                    key={c.id}
                    card={c}
                    dealDelay={dealDelays.get(c.id)}
                    restX={scatter.x}
                    restY={scatter.y}
                    restRotate={scatter.rotate}
                    zIndex={idx}
                    selected={selectedTableIds.includes(c.id)}
                    selectable={isMyTurn}
                    onClick={isMyTurn ? () => toggleTableCard(c.id) : undefined}
                  />
                );
              })}
            </div>
          </div>

          {orderedOpponents.map(({ player: p, index: i }, seatIdx) => (
            <div
              key={p.id}
              className={`scopa-seat ${seatClasses[seatIdx] ?? ''} ${
                i === state.turn && state.phase === 'playing' ? 'is-active' : ''
              }`}
            >
              <div className="scopa-seat-info">
                <Avatar active={i === state.turn && state.phase === 'playing'} disconnected={!p.connected} />
                <span className="scopa-seat-name">{p.name}</span>
              </div>
              <div className="scopa-seat-hand">
                {Array.from({ length: p.handCount }).map((_, idx) => {
                  const fan = fanTransform(idx, p.handCount, 12, 5);
                  return (
                    <PlayingCard
                      key={idx}
                      card={{ id: `${p.id}-back-${idx}`, suit: 'denari', rank: 1 }}
                      faceDown
                      small
                      restX={fan.x}
                      restY={fan.y}
                      restRotate={fan.rotate}
                      zIndex={idx}
                      dealDelay={dealDelays.size > 0 ? idx * DEAL_STEP : undefined}
                    />
                  );
                })}
              </div>
              <CapturedPile cards={p.captured} />
            </div>
          ))}

          <div className="scopa-seat scopa-seat-bottom">
            <div className="scopa-seat-info">
              <Avatar active={Boolean(isMyTurn)} />
              <span className="scopa-seat-name">{me.name} (toi)</span>
            </div>
            <CapturedPile cards={me.captured} />
          </div>

          <div
            className="scopa-my-hand"
            style={{ '--hand-card-scale': handCardScale(me.hand.length) } as CSSProperties}
          >
            {me.hand.map((c, idx) => {
              const fan = fanTransform(idx, me.hand.length);
              return (
                <PlayingCard
                  key={c.id}
                  card={c}
                  dealDelay={dealDelays.get(c.id)}
                  restX={fan.x}
                  restY={fan.y}
                  restRotate={fan.rotate}
                  zIndex={idx}
                  draggable={isMyTurn}
                  selectable={isMyTurn}
                  onDragRelease={(info, rect) => handleDragRelease(c, info, rect)}
                  onClick={isMyTurn ? () => commitPlay(c) : undefined}
                />
              );
            })}
          </div>

          {state.phase === 'playing' && !isMyTurn && (
            <p className="scopa-turn-hint">Au tour de {state.players[state.turn]?.name}...</p>
          )}

          {actionError && (
            <p className="scopa-error-banner">
              <TriangleAlert size={15} /> {actionError}
            </p>
          )}

          {state.phase === 'hand-end' && state.lastHandScore && (
            <div className="scopa-modal-overlay">
              <div className="scopa-modal scopa-handend-modal">
                <div className="scopa-modal-header">
                  <h2>Résultats de la manche</h2>
                </div>
                <div className="scopa-modal-body">
                  <table className="scopa-score-table">
                    <thead>
                      <tr>
                        <th>Joueur</th>
                        <th>Cartes</th>
                        <th>Denari</th>
                        <th>7 bello</th>
                        <th>Primiera</th>
                        <th>Scope</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.players.map((p, i) => {
                        const detail = state.lastHandScore![i];
                        return (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>
                              <AnimatedNumber value={detail.carte} />
                            </td>
                            <td>
                              <AnimatedNumber value={detail.denari} />
                            </td>
                            <td>
                              <AnimatedNumber value={detail.settebello} />
                            </td>
                            <td>
                              <AnimatedNumber value={detail.primiera} />
                            </td>
                            <td>
                              <AnimatedNumber value={detail.scope} />
                            </td>
                            <td>
                              <strong>
                                <AnimatedNumber value={detail.total} duration={1.1} />
                              </strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {isHost ? (
                    <button type="button" className="btn btn-primary" onClick={() => sendAction({ type: 'NEXT_HAND' })}>
                      Manche suivante
                    </button>
                  ) : (
                    <p>En attente que l'hôte lance la manche suivante...</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {state.phase === 'match-end' && (
            <div className="scopa-modal-overlay">
              <div className="scopa-modal scopa-handend-modal">
                <div className="scopa-modal-header">
                  <h2>
                    <Trophy size={20} className="scopa-rule-icon" /> Partie terminée !
                  </h2>
                </div>
                <div className="scopa-modal-body">
                  <p>
                    {(() => {
                      const maxScore = Math.max(...state.matchScores);
                      const winners = state.players.filter((_, i) => state.matchScores[i] === maxScore);
                      return winners.length === 1
                        ? `${winners[0].name} remporte la partie avec ${maxScore} points !`
                        : `Égalité entre ${winners.map((w) => w.name).join(', ')} à ${maxScore} points !`;
                    })()}
                  </p>
                  <Link to="/scopa" className="btn btn-primary">
                    <Sparkles size={15} /> Rejouer
                  </Link>
                </div>
              </div>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}
