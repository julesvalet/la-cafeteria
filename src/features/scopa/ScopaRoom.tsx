import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useScopaRoom } from './net/useScopaRoom';
import { PlayingCard } from './components/PlayingCard';
import { ScoreBoard } from './components/ScoreBoard';
import { CapturedPile } from './components/CapturedPile';
import { DeckPile } from './components/DeckPile';
import { ScopaFlash } from './components/ScopaFlash';
import { RulesModal } from './components/RulesModal';
import { AnimatedNumber } from './components/AnimatedNumber';
import type { CardT } from './engine/types';

interface LocationState {
  isHost?: boolean;
  name?: string;
}

const DEAL_STEP = 0.06;

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

  const [selectedCard, setSelectedCard] = useState<CardT | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [scopaFlashName, setScopaFlashName] = useState<string | null>(null);

  const lastErrorRef = useRef<string | null>(null);
  const prevScopeRef = useRef<number[]>([]);
  const lastHandNumberRef = useRef(0);
  const lastTotalHandRef = useRef(0);

  const myIndex = useMemo(() => state?.players.findIndex((p) => p.id === selfId) ?? -1, [state, selfId]);
  const me = myIndex >= 0 ? state?.players[myIndex] : undefined;
  const isMyTurn = state?.phase === 'playing' && state.turn === myIndex;

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

  // Clear any pending selection whenever the turn changes.
  useEffect(() => {
    setSelectedCard(null);
    setSelectedTableIds([]);
  }, [state?.turn, state?.phase]);

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

  const inviteLink = `${window.location.origin}${window.location.pathname.replace(/\/scopa\/.*/, '')}/scopa/${code}`;

  const selectHandCard = (card: CardT) => {
    if (!isMyTurn) return;
    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
      setSelectedTableIds([]);
    } else {
      setSelectedCard(card);
      setSelectedTableIds([]);
    }
  };

  const toggleTableCard = (cardId: string) => {
    if (!selectedCard) return;
    setSelectedTableIds((ids) => (ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId]));
  };

  const confirmPlay = () => {
    if (!selectedCard || !selfId) return;
    sendAction({
      type: 'PLAY_CARD',
      playerId: selfId,
      cardId: selectedCard.id,
      captureCardIds: selectedTableIds,
    });
    setSelectedCard(null);
    setSelectedTableIds([]);
  };

  const cancelSelection = () => {
    setSelectedCard(null);
    setSelectedTableIds([]);
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
              className="btn btn-outline scopa-invite-btn"
              onClick={() => navigator.clipboard?.writeText(inviteLink)}
            >
              📋 Copier le lien d'invitation
            </button>
            <button type="button" className="btn btn-outline scopa-invite-btn" onClick={() => setRulesOpen(true)}>
              📖 Règles
            </button>
          </div>
        </div>
        <Link to="/scopa" className="scopa-back-link">
          Quitter
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

      {(state.phase === 'playing' || state.phase === 'hand-end' || state.phase === 'match-end') && (
        <div className="scopa-board">
          <div className="scopa-board-main">
            <div className="scopa-opponents">
              {state.players.map((p, i) =>
                p.id === selfId ? null : (
                  <div key={p.id} className={`scopa-opponent ${i === state.turn ? 'is-active' : ''}`}>
                    <p className="scopa-opponent-name">
                      {p.name} {!p.connected && '(déconnecté)'}
                    </p>
                    <div className="scopa-opponent-hand">
                      {Array.from({ length: p.handCount }).map((_, idx) => (
                        <PlayingCard
                          key={idx}
                          card={{ id: `${p.id}-back-${idx}`, suit: 'denari', rank: 1 }}
                          faceDown
                          small
                          dealDelay={dealDelays.size > 0 ? idx * DEAL_STEP : undefined}
                        />
                      ))}
                    </div>
                    <CapturedPile cards={p.captured} label="Pile" />
                  </div>
                ),
              )}
            </div>

            <div className="scopa-table">
              <div className="scopa-table-head">
                <h3>Table</h3>
                <DeckPile count={state.deck.length} />
              </div>
              <div className="scopa-table-cards">
                {state.table.length === 0 && <p className="scopa-empty">Table vide</p>}
                {state.table.map((c) => (
                  <PlayingCard
                    key={c.id}
                    card={c}
                    dealDelay={dealDelays.get(c.id)}
                    selected={selectedTableIds.includes(c.id)}
                    selectable={Boolean(selectedCard)}
                    onClick={selectedCard ? () => toggleTableCard(c.id) : undefined}
                  />
                ))}
              </div>
            </div>

            {state.phase === 'playing' && (
              <p className="scopa-turn-indicator">
                {isMyTurn ? "C'est ton tour, joue une carte." : `Au tour de ${state.players[state.turn]?.name}...`}
              </p>
            )}

            {actionError && <p className="scopa-error-banner">⚠️ {actionError}</p>}

            {me && (
              <div className="scopa-hand">
                <div className="scopa-hand-head">
                  <h3>Ta main</h3>
                  <CapturedPile cards={me.captured} label="Ta pile" />
                </div>
                <div className="scopa-hand-cards">
                  {me.hand.map((c) => (
                    <PlayingCard
                      key={c.id}
                      card={c}
                      dealDelay={dealDelays.get(c.id)}
                      selectable={isMyTurn}
                      selected={selectedCard?.id === c.id}
                      onClick={isMyTurn ? () => selectHandCard(c) : undefined}
                    />
                  ))}
                </div>

                {selectedCard && (
                  <div className="scopa-confirm-bar">
                    <span>
                      {selectedTableIds.length === 0
                        ? 'Aucune carte sélectionnée sur la table : la carte sera posée.'
                        : `${selectedTableIds.length} carte(s) sélectionnée(s) sur la table.`}
                    </span>
                    <div className="scopa-confirm-actions">
                      <button type="button" className="btn btn-outline" onClick={cancelSelection}>
                        Annuler
                      </button>
                      <button type="button" className="btn btn-primary" onClick={confirmPlay}>
                        Jouer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {state.phase === 'hand-end' && state.lastHandScore && (
              <div className="scopa-handend">
                <h3>Résultats de la manche</h3>
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
            )}

            {state.phase === 'match-end' && (
              <div className="scopa-handend">
                <h3>🏆 Partie terminée !</h3>
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
                  Rejouer
                </Link>
              </div>
            )}
          </div>

          <ScoreBoard state={state} selfId={selfId} />
        </div>
      )}
    </div>
  );
}
