import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check, Copy, Crown, Dices, Flag, LogOut, Plus, RefreshCw, RotateCw, Trash2, X } from 'lucide-react';
import { GameTitle } from '../../components/GameTitle';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../account/useAuth';
import { useRoomIdentity } from '../rooms/playerName';
import { useRoomSession } from '../rooms/useRoomSession';
import { InviteFriendsButton } from '../social/components/InviteFriendsButton';
import { useRecordGame, type RecordState } from '../account/useRecordGame';
import { veriteOutcome } from '../account/gameOutcomes';
import { GameRecordBadge } from '../account/components/GameRecordBadge';
import { Bottle } from './components/Bottle';
import { QuestionCard } from './components/QuestionCard';
import { CustomQuestionDialog } from './components/CustomQuestionDialog';
import { publicQuestionUuid, reportQuestion } from './api';
import { THEME_INFO } from './engine/questions';
import {
  ANSWER_MAX,
  MAX_PARTICIPANTS,
  MIN_PLAYERS,
  ROUND_OPTIONS,
  canReferee,
  chefPresent,
  eligiblePlayers,
  findPlayer,
  isLastRound,
  standings,
} from './engine/rules';
import { THEMES, type RoundStage, type VeriteAction, type VeriteState } from './engine/types';
import { useVeriteRoom, type RoomSetup } from './net/useVeriteRoom';
import type { VeriteNavState } from './VeriteLobby';
import './verite.css';

export function VeriteRoom() {
  const { code = '' } = useParams();
  const location = useLocation();
  const nav = (location.state as VeriteNavState | null) ?? null;
  // Connecté, on entre sous le pseudo du compte sans formulaire.
  const identity = useRoomIdentity(nav?.name);

  if (identity.pending) {
    return (
      <div className="rv">
        <div className="rv-wrap rv-center">
          <p role="status" className="rv-blink">
            Connexion à ton compte…
          </p>
        </div>
      </div>
    );
  }

  if (!identity.joined) {
    return (
      <div className="rv">
        <div className="rv-wrap rv-narrow">
          <GameTitle as="h1" game="verite" size="lg" suffix={`room ${code}`} className="gt-room" />
          <form
            className="rv-panel"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              identity.confirm();
            }}
          >
            <label className="rv-field">
              <span>Ton pseudo</span>
              <input
                type="text"
                maxLength={18}
                value={identity.typed}
                onChange={(e) => identity.setTyped(e.target.value)}
                placeholder="Ex : Jules"
                autoFocus
              />
            </label>
            <button type="submit" className="rv-btn" disabled={!identity.typed.trim()}>
              Rejoindre la partie
            </button>
          </form>
          <Link to="/verite" className="rv-back">
            ← Retour à la Roulette de Vérité
          </Link>
        </div>
      </div>
    );
  }

  return (
    <VeriteGameView
      code={code.toUpperCase()}
      name={identity.name}
      isHost={Boolean(nav?.isHost)}
      isPublic={nav?.visibility === 'public'}
      setup={nav?.setup ?? null}
    />
  );
}

function VeriteGameView({
  code,
  name,
  isHost,
  isPublic,
  setup,
}: {
  code: string;
  name: string;
  isHost: boolean;
  isPublic: boolean;
  setup: RoomSetup | null;
}) {
  const { state, selfId, status, error, clearError, sendAction, starting } = useVeriteRoom(code, name, isHost, setup);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lockRef = useRef(false);

  const me = state?.players.find((p) => p.id === selfId);
  // Parties, trophées et FEES : chacun enregistre sa ligne à la fin (le chef
  // compris, pour sa partie menée au bout).
  const record = useRecordGame(veriteOutcome(state, selfId, code));
  useRoomSession({
    game: 'verite',
    code,
    isHost,
    isPublic,
    role: state && me ? 'player' : null,
    status: state?.phase === 'lobby' ? 'waiting' : 'playing',
    players: state?.players.filter((p) => p.connected).length ?? 0,
    maxPlayers: state?.maxPlayers ?? MAX_PARTICIPANTS,
    spectators: 0,
  });

  useEffect(() => {
    if (!error) return;
    setToast(error);
    const t = setTimeout(() => {
      setToast(null);
      clearError();
    }, 3800);
    return () => clearTimeout(t);
  }, [error, clearError]);

  /** Un double-tap impatient n'envoie pas deux fois la même action. */
  const act = useCallback(
    (action: VeriteAction) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setTimeout(() => (lockRef.current = false), 300);
      sendAction(action);
    },
    [sendAction],
  );

  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (status === 'connecting' || (status === 'connected' && !state)) {
    return (
      <div className="rv">
        <div className="rv-wrap rv-center">
          <p role="status" className="rv-blink">
            Connexion à la room {code}…
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !state || !selfId) {
    return (
      <div className="rv">
        <div className="rv-wrap rv-center">
          <p className="rv-error">{error ?? 'Une erreur est survenue.'}</p>
          <Link to="/verite" className="rv-btn rv-btn-ghost">
            ← Retour
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rv">
      <div className="rv-wrap">
        <div className="rv-topbar">
          <GameTitle as="h1" game="verite" suffix={`room ${code}`} className="gt-room" />
          <div className="rv-topbar-actions">
            <button type="button" className="rv-chip-btn" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copié !' : code}
            </button>
            <InviteFriendsButton game="verite" code={code} className="rv-chip-btn" />
            <Link to="/verite" className="rv-chip-btn">
              <LogOut size={14} /> Quitter
            </Link>
          </div>
        </div>

        {state.phase === 'lobby' && (
          <WaitingRoom state={state} selfId={selfId} isHost={isHost} act={act} starting={starting} setup={setup} />
        )}
        {state.phase === 'playing' && <PlayView state={state} selfId={selfId} isHost={isHost} act={act} />}
        {state.phase === 'ended' && <Results state={state} isHost={isHost} selfId={selfId} act={act} record={record} />}

        {toast && (
          <p className="rv-toast" role="alert">
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}

type Act = (action: VeriteAction) => void;

// --- Salle d'attente ----------------------------------------------------------

function WaitingRoom({
  state,
  selfId,
  isHost,
  act,
  starting,
  setup,
}: {
  state: VeriteState;
  selfId: string;
  isHost: boolean;
  act: Act;
  starting: boolean;
  setup: RoomSetup | null;
}) {
  const [dialog, setDialog] = useState(false);
  // Le thème HARD a été confirmé à la création ; s'il est choisi ici, on redemande.
  const [adult, setAdult] = useState(setup?.theme === 'hard');
  const chefId = state.chefId;
  const vacant = !chefPresent(state);
  const players = eligiblePlayers(state).length;
  const blocker = vacant
    ? 'Désignez le chef du jeu'
    : players < MIN_PLAYERS
      ? `Il faut ${MIN_PLAYERS} joueurs en plus du chef`
      : state.theme === 'hard' && !adult
        ? 'Confirmez le thème HARD'
        : null;

  return (
    <div className="rv-waiting">
      <section className="rv-panel">
        <h2 className="rv-h2">
          À la table ({state.players.length}/{state.maxPlayers})
        </h2>
        <ul className="rv-people">
          {state.players.map((p) => {
            const isChef = p.id === chefId;
            return (
              <li key={p.id} data-chef={isChef || undefined} data-away={!p.connected || undefined}>
                <span className="rv-people-name">
                  {isChef && <Crown size={14} aria-label="Chef du jeu" />}
                  {p.name}
                  {p.id === selfId && <small> (toi)</small>}
                  {p.id === state.hostId && <small> · hôte</small>}
                </span>
                {isChef ? (
                  <span className="rv-role">Chef du jeu</span>
                ) : (
                  (isHost || selfId === chefId || (vacant && p.id === selfId)) && (
                    <button
                      type="button"
                      className="rv-chip-btn"
                      onClick={() => act({ type: 'SET_CHEF', playerId: selfId, chefId: p.id })}
                    >
                      <Crown size={13} /> {p.id === selfId ? 'Je suis le chef' : 'Nommer chef'}
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
        {isHost && (
          <button type="button" className="rv-btn rv-btn-ghost rv-btn-sm" onClick={() => act({ type: 'RANDOM_CHEF', playerId: selfId })}>
            <Dices size={15} /> Chef au hasard
          </button>
        )}
        <p className="rv-muted">
          Le chef ne répond pas : il lance la bouteille et valide les réponses. Partage le code {state.roomCode} — on
          peut aussi rejoindre en cours de partie.
        </p>
      </section>

      <section className="rv-panel">
        <h2 className="rv-h2">Réglages</h2>
        <div className="rv-field">
          <span>Thème</span>
          <div className="rv-tabs" role="radiogroup" aria-label="Thème de la partie">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={state.theme === t}
                className="rv-tab"
                data-theme={t}
                disabled={!isHost}
                onClick={() => act({ type: 'SET_OPTIONS', playerId: selfId, theme: t, rounds: state.rounds })}
              >
                {THEME_INFO[t].label}
              </button>
            ))}
          </div>
          <small className="rv-muted">{THEME_INFO[state.theme].tagline}</small>
        </div>
        <div className="rv-field">
          <span>Manches</span>
          <div className="rv-tabs" role="radiogroup" aria-label="Nombre de manches">
            {ROUND_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={state.rounds === n}
                className="rv-tab"
                disabled={!isHost}
                onClick={() => act({ type: 'SET_OPTIONS', playerId: selfId, theme: state.theme, rounds: n })}
              >
                {n === 0 ? 'Libre' : n}
              </button>
            ))}
          </div>
        </div>
        {isHost && state.theme === 'hard' && (
          <label className="rv-check rv-check-hard">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>Tout le monde est majeur et d’accord pour des questions intimes.</span>
          </label>
        )}

        <div className="rv-field">
          <span>Questions perso ({state.customs.length})</span>
          {state.customs.length > 0 && (
            <ul className="rv-custom-list">
              {state.customs.map((q) => {
                const mine = q.byId === selfId;
                return (
                  <li key={q.id} data-theme={q.theme}>
                    <span className="rv-custom-tag">{THEME_INFO[q.theme].label}</span>
                    <span className="rv-custom-text">
                      {mine ? q.text : <em>Question secrète de {q.byName}</em>}
                    </span>
                    {q.source === 'public' && <span className="rv-custom-pub">publique</span>}
                    {(mine || isHost) && (
                      <button
                        type="button"
                        className="rv-icon-btn"
                        aria-label="Retirer la question"
                        onClick={() => act({ type: 'REMOVE_CUSTOM', playerId: selfId, questionId: q.id })}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="rv-btn rv-btn-ghost rv-btn-sm" onClick={() => setDialog(true)}>
            <Plus size={15} /> Ajouter une question
          </button>
        </div>
      </section>

      <div className="rv-start">
        {isHost ? (
          <button
            type="button"
            className="rv-btn rv-btn-lg"
            disabled={Boolean(blocker) || starting}
            onClick={() => act({ type: 'START', playerId: selfId })}
          >
            {starting ? 'Mélange des cartes…' : (blocker ?? 'Lancer la partie')}
          </button>
        ) : (
          <p className="rv-blink">En attente que l’hôte lance la partie…</p>
        )}
      </div>

      <CustomQuestionDialog
        open={dialog}
        onClose={() => setDialog(false)}
        gameTheme={state.theme}
        onAdd={(q) => act({ type: 'ADD_CUSTOM', playerId: selfId, ...q })}
      />
    </div>
  );
}

// --- La partie ---------------------------------------------------------------

function PlayView({ state, selfId, isHost, act }: { state: VeriteState; selfId: string; isHost: boolean; act: Act }) {
  const round = state.round;
  const { status: authStatus } = useAuth();
  const [draft, setDraft] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [reported, setReported] = useState<Record<string, 'sent' | 'error'>>({});
  const [dialog, setDialog] = useState(false);
  // Le premier stade où l'on a vu chaque carte : vue en direct, elle s'anime ;
  // découverte en cours de route (arrivée tardive), elle s'affiche d'un coup.
  const seenAt = useRef(new Map<string, RoundStage>());

  const cardKey = round ? `${round.seq}-${round.draw}` : '';
  useEffect(() => setDraft(''), [cardKey]);
  useEffect(() => setConfirmEnd(false), [round?.stage]);
  // Le focus arrive quand la saisie s'ouvre, pas avant.
  const answerOpen = round?.stage === 'answering' && round.targetId === selfId;
  useEffect(() => {
    if (answerOpen) document.getElementById('rv-answer')?.focus();
  }, [answerOpen, cardKey]);

  if (!round) return null;
  if (!seenAt.current.has(cardKey)) seenAt.current.set(cardKey, round.stage);
  const firstSeen = seenAt.current.get(cardKey);
  const animate = firstSeen === 'spinning' || firstSeen === 'reveal';

  const target = findPlayer(state, round.targetId);
  const isTarget = round.targetId === selfId;
  const referee = canReferee(state, selfId);
  const chef = findPlayer(state, state.chefId);
  const chefAway = !chefPresent(state);
  const stage = round.stage;
  const spinning = stage === 'spinning';
  const pubId = publicQuestionUuid(round.question);
  const canReport = Boolean(pubId) && accountsEnabled && authStatus === 'signed-in';

  const seats = round.ring
    .map((id) => findPlayer(state, id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    act({ type: 'ANSWER', playerId: selfId, text: draft });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const report = async () => {
    if (!pubId) return;
    try {
      await reportQuestion(pubId);
      setReported((r) => ({ ...r, [pubId]: 'sent' }));
    } catch {
      setReported((r) => ({ ...r, [pubId]: 'error' }));
    }
  };

  const author =
    round.question.source === 'base' ? null : round.question.source === 'public'
      ? `Question publique${round.question.byName ? ` de ${round.question.byName}` : ''}`
      : `Question perso de ${round.question.byName ?? '?'}`;

  return (
    <div className="rv-play" data-theme={round.question.theme}>
      <div className="rv-scores" aria-label="Scores">
        <span className="rv-round-count">
          Manche {round.seq}
          {state.rounds > 0 && `/${state.rounds}`}
        </span>
        <ul>
          {state.players
            .filter((p) => p.id !== state.chefId)
            .map((p) => (
              <li
                key={p.id}
                data-away={!p.connected || undefined}
                data-self={p.id === selfId || undefined}
                data-target={!spinning && p.id === round.targetId ? true : undefined}
              >
                <span>{p.name}</span>
                <b>{p.score}</b>
              </li>
            ))}
          {chef && (
            <li data-chef data-away={!chef.connected || undefined}>
              <Crown size={13} aria-label="Chef du jeu" />
              <span>{chef.name}</span>
            </li>
          )}
        </ul>
      </div>

      {chefAway && (
        <div className="rv-banner">
          <span>Le chef du jeu a quitté la table{isHost ? ' — tu arbitres en attendant.' : '.'}</span>
          {!isTarget && (
            <button type="button" className="rv-chip-btn" onClick={() => act({ type: 'SET_CHEF', playerId: selfId, chefId: selfId })}>
              <Crown size={13} /> Prendre le rôle
            </button>
          )}
        </div>
      )}

      <div className="rv-table">
        <div className="rv-table-bottle">
          <Bottle
            seats={seats}
            angle={round.angle}
            spinning={spinning}
            targetId={round.targetId}
            spinKey={round.seq}
          />
          <p className="rv-who" aria-live="polite">
            {spinning ? (
              <span className="rv-blink">La bouteille tourne…</span>
            ) : isTarget ? (
              <>
                À toi de répondre, <strong>{target?.name}</strong> !
              </>
            ) : (
              <>
                Joueur à répondre : <strong>{target?.name}</strong>
              </>
            )}
          </p>
        </div>

        <div className="rv-table-card">
          <QuestionCard
            theme={round.question.theme}
            text={round.question.text}
            faceUp={!spinning}
            revealKey={cardKey}
            animate={animate}
            footer={
              (author || canReport) && (
                <>
                  {author && <span className="rv-card-author">{author}</span>}
                  {canReport && pubId && (
                    <button
                      type="button"
                      className="rv-report"
                      disabled={Boolean(reported[pubId])}
                      onClick={report}
                      title="Signaler une question offensante"
                    >
                      <Flag size={12} />{' '}
                      {reported[pubId] === 'sent' ? 'Signalée' : reported[pubId] === 'error' ? 'Échec' : 'Signaler'}
                    </button>
                  )}
                </>
              )
            }
          />

          <div className="rv-answer" aria-live="polite">
            {isTarget && (stage === 'spinning' || stage === 'reveal' || stage === 'answering') && (
              <form className="rv-answer-form" onSubmit={submit}>
                <label htmlFor="rv-answer" className="rv-sr">
                  Ta réponse
                </label>
                <textarea
                  id="rv-answer"
                  className="rv-answer-input"
                  rows={2}
                  maxLength={ANSWER_MAX}
                  placeholder={stage === 'answering' ? 'Tape ta réponse…' : 'Attends la question…'}
                  disabled={stage !== 'answering'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKey}
                />
                <div className="rv-answer-actions">
                  <button type="submit" className="rv-btn" disabled={stage !== 'answering' || !draft.trim()}>
                    Envoyer
                  </button>
                  <button
                    type="button"
                    className="rv-btn rv-btn-ghost"
                    disabled={stage !== 'answering'}
                    title="Esquiver la question : réponse comptée invalide"
                    onClick={() => act({ type: 'SKIP', playerId: selfId })}
                  >
                    Passer
                  </button>
                </div>
              </form>
            )}

            {!isTarget && stage === 'answering' && (
              <p className="rv-muted rv-blink">{target?.name} réfléchit…</p>
            )}

            {(stage === 'judging' || stage === 'verdict') && round.answer !== null && (
              <div className="rv-reply" data-verdict={round.verdict === null ? undefined : String(round.verdict)}>
                <span className="rv-reply-label">Réponse de {target?.name} :</span>
                <q>{round.answer}</q>
                {stage === 'verdict' && (
                  <span className="rv-stamp" data-ok={round.verdict || undefined}>
                    {round.verdict ? '✓ Validé' : '✗ Invalide'}
                  </span>
                )}
              </div>
            )}

            {stage === 'judging' && !referee && <p className="rv-muted rv-blink">Le chef délibère…</p>}

            {stage === 'verdict' && round.voided && (
              <p className="rv-muted">{target?.name} a quitté la table : manche annulée.</p>
            )}
          </div>

          {referee && (
            <section className="rv-chef" aria-label="Chef du jeu">
              <h2>
                <Crown size={15} aria-hidden /> Chef du jeu
              </h2>

              {stage === 'judging' && (
                <>
                  <p className="rv-chef-q">C’est cohérent ?</p>
                  <div className="rv-verdict">
                    <button type="button" className="rv-btn rv-btn-ok" onClick={() => act({ type: 'VERDICT', playerId: selfId, valid: true })}>
                      <Check size={18} /> Valide
                    </button>
                    <button type="button" className="rv-btn rv-btn-ko" onClick={() => act({ type: 'VERDICT', playerId: selfId, valid: false })}>
                      <X size={18} /> Invalide
                    </button>
                  </div>
                </>
              )}

              {stage === 'verdict' && (
                <button type="button" className="rv-btn rv-btn-lg" onClick={() => act({ type: 'SPIN', playerId: selfId })}>
                  <RotateCw size={18} /> {isLastRound(state) ? 'Voir les résultats' : 'Tourner la bouteille'}
                </button>
              )}

              {(stage === 'spinning' || stage === 'reveal' || stage === 'answering') && (
                <p className="rv-muted">
                  {stage === 'answering' ? `${target?.name} répond…` : 'La question arrive…'}
                </p>
              )}

              <div className="rv-chef-tools">
                <button
                  type="button"
                  className="rv-chip-btn"
                  disabled={stage !== 'reveal' && stage !== 'answering'}
                  onClick={() => act({ type: 'REDRAW', playerId: selfId })}
                >
                  <RefreshCw size={13} /> Changer de question
                </button>
                <button type="button" className="rv-chip-btn" onClick={() => setDialog(true)}>
                  <Plus size={13} /> Question perso
                </button>
                <button
                  type="button"
                  className="rv-chip-btn rv-chip-danger"
                  onClick={() => (confirmEnd ? act({ type: 'END', playerId: selfId }) : setConfirmEnd(true))}
                >
                  <Flag size={13} /> {confirmEnd ? 'Confirmer l’arrêt' : 'Terminer la partie'}
                </button>
              </div>
            </section>
          )}

          {!referee && (
            <button type="button" className="rv-chip-btn rv-add-inline" onClick={() => setDialog(true)}>
              <Plus size={13} /> Glisser une question perso
            </button>
          )}
        </div>
      </div>

      <CustomQuestionDialog
        open={dialog}
        onClose={() => setDialog(false)}
        gameTheme={state.theme}
        onAdd={(q) => act({ type: 'ADD_CUSTOM', playerId: selfId, ...q })}
      />
    </div>
  );
}

// --- Fin de partie -----------------------------------------------------------

function Results({
  state,
  isHost,
  selfId,
  act,
  record,
}: {
  state: VeriteState;
  isHost: boolean;
  selfId: string;
  act: Act;
  record: RecordState;
}) {
  const ranking = standings(state);
  const best = ranking[0]?.score ?? 0;

  return (
    <div className="rv-results">
      <section className="rv-panel rv-podium">
        <h2 className="rv-h2">Partie terminée</h2>
        <ol>
          {ranking.map((p, i) => (
            <li key={p.id} data-top={(p.score === best && best > 0) || undefined} data-away={!p.connected || undefined}>
              <span className="rv-rank">{i + 1}</span>
              <span className="rv-podium-name">
                {p.name}
                {p.id === selfId && <small> (toi)</small>}
              </span>
              <b>
                {p.score} pt{p.score > 1 ? 's' : ''}
              </b>
            </li>
          ))}
        </ol>
        {isHost ? (
          <button type="button" className="rv-btn rv-btn-lg" onClick={() => act({ type: 'REMATCH', playerId: selfId })}>
            <RotateCw size={18} /> Rejouer
          </button>
        ) : (
          <p className="rv-blink">En attente de l’hôte pour une nouvelle partie…</p>
        )}
        <GameRecordBadge state={record} />
      </section>

      {state.history.length > 0 && (
        <section className="rv-panel">
          <h2 className="rv-h2">Le récap</h2>
          <ol className="rv-recap">
            {state.history.map((h) => (
              <li key={h.seq} data-theme={h.theme}>
                <span className="rv-recap-head">
                  M{h.seq} · {h.targetName}
                  <span className="rv-recap-verdict" data-ok={h.verdict || undefined}>
                    {h.skipped ? 'esquivée' : h.verdict === null ? '—' : h.verdict ? '✓' : '✗'}
                  </span>
                </span>
                <span className="rv-recap-q">{h.question}</span>
                {h.answer && <q className="rv-recap-a">{h.answer}</q>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
