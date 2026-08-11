import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useScopaRoom } from './net/useScopaRoom';
import { findCaptureOptions } from './engine/rules';
import { RANK_LABEL, SUIT_LABEL } from './engine/deck';
import { PlayingCard } from './components/PlayingCard';
import { ScoreBoard } from './components/ScoreBoard';
import type { CardT } from './engine/types';

interface LocationState {
  isHost?: boolean;
  name?: string;
}

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
  const [pendingCard, setPendingCard] = useState<CardT | null>(null);
  const [pendingOptions, setPendingOptions] = useState<CardT[][]>([]);

  const myIndex = useMemo(() => state?.players.findIndex((p) => p.id === selfId) ?? -1, [state, selfId]);
  const me = myIndex >= 0 ? state?.players[myIndex] : undefined;
  const isMyTurn = state?.phase === 'playing' && state.turn === myIndex;

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

  const handlePlayCard = (card: CardT) => {
    if (!isMyTurn || !me) return;
    const options = findCaptureOptions(state.table, card.rank);
    if (options.length <= 1) {
      sendAction({
        type: 'PLAY_CARD',
        playerId: selfId!,
        cardId: card.id,
        captureCardIds: options[0]?.map((c) => c.id) ?? [],
      });
    } else {
      setPendingCard(card);
      setPendingOptions(options);
    }
  };

  const confirmCapture = (option: CardT[]) => {
    if (!pendingCard || !selfId) return;
    sendAction({
      type: 'PLAY_CARD',
      playerId: selfId,
      cardId: pendingCard.id,
      captureCardIds: option.map((c) => c.id),
    });
    setPendingCard(null);
    setPendingOptions([]);
  };

  return (
    <div className="container scopa-room">
      <div className="scopa-room-topbar">
        <div>
          <h1>Scopa — room {code}</h1>
          <button
            type="button"
            className="btn btn-outline scopa-invite-btn"
            onClick={() => navigator.clipboard?.writeText(inviteLink)}
          >
            📋 Copier le lien d'invitation
          </button>
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
              <li key={p.id}>{p.name}{p.id === selfId ? ' (toi)' : ''}</li>
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
                        <PlayingCard key={idx} card={{ id: String(idx), suit: 'denari', rank: 1 }} faceDown small />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="scopa-table">
              <h3>Table</h3>
              <div className="scopa-table-cards">
                {state.table.length === 0 && <p className="scopa-empty">Table vide</p>}
                {state.table.map((c) => (
                  <PlayingCard key={c.id} card={c} />
                ))}
              </div>
            </div>

            {state.phase === 'playing' && (
              <p className="scopa-turn-indicator">
                {isMyTurn ? "C'est ton tour, joue une carte." : `Au tour de ${state.players[state.turn]?.name}...`}
              </p>
            )}

            {me && (
              <div className="scopa-hand">
                <h3>Ta main</h3>
                <div className="scopa-hand-cards">
                  {me.hand.map((c) => (
                    <PlayingCard
                      key={c.id}
                      card={c}
                      selectable={isMyTurn}
                      onClick={isMyTurn ? () => handlePlayCard(c) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {pendingCard && (
              <div className="scopa-capture-modal">
                <div className="scopa-capture-modal-inner">
                  <h3>
                    Choisis les cartes à capturer avec {RANK_LABEL[pendingCard.rank]} de {SUIT_LABEL[pendingCard.suit]}
                  </h3>
                  <div className="scopa-capture-options">
                    {pendingOptions.map((option, idx) => (
                      <button key={idx} type="button" className="scopa-capture-option" onClick={() => confirmCapture(option)}>
                        {option.map((c) => (
                          <PlayingCard key={c.id} card={c} small />
                        ))}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn btn-outline" onClick={() => setPendingCard(null)}>
                    Annuler
                  </button>
                </div>
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
                          <td>{detail.carte}</td>
                          <td>{detail.denari}</td>
                          <td>{detail.settebello}</td>
                          <td>{detail.primiera}</td>
                          <td>{detail.scope}</td>
                          <td>
                            <strong>{detail.total}</strong>
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
