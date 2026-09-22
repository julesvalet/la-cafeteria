import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Plus, Trash2 } from 'lucide-react';
import { GameTitle } from '../../components/GameTitle';
import { usePlayerName, savePseudo } from '../rooms/playerName';
import { SessionVisibility, type Visibility } from '../rooms/SessionVisibility';
import { SessionsLink } from '../rooms/SessionsLink';
import { newRoomCode } from '../social/gameRooms';
import { ThemeCarousel } from './components/ThemeCarousel';
import { CustomQuestionDialog, type NewCustom } from './components/CustomQuestionDialog';
import { THEME_INFO } from './engine/questions';
import { MAX_CUSTOMS_PER_PLAYER, ROUND_OPTIONS } from './engine/rules';
import { THEMES, type VeriteTheme } from './engine/types';
import type { RoomSetup } from './net/useVeriteRoom';
import './verite.css';

export interface VeriteNavState {
  isHost?: boolean;
  name?: string;
  visibility?: Visibility;
  setup?: RoomSetup;
}

/**
 * L'accueil de la Roulette de Vérité : les cartes d'exemple, le thème, le
 * pseudo et les questions perso — puis créer une table ou en rejoindre une.
 */
export function VeriteLobby() {
  const navigate = useNavigate();
  const [name, setName] = usePlayerName();
  const [theme, setTheme] = useState<VeriteTheme>('clean');
  const [rounds, setRounds] = useState<number>(10);
  const [hostIsChef, setHostIsChef] = useState(false);
  const [adult, setAdult] = useState(false);
  const [customs, setCustoms] = useState<NewCustom[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const requireName = () => {
    if (name.trim()) return true;
    setError('Choisis un pseudo pour commencer.');
    document.getElementById('rv-pseudo')?.focus();
    return false;
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!requireName()) return;
    if (theme === 'hard' && !adult) {
      setError('Confirme que tout le monde est majeur et partant pour le thème HARD.');
      return;
    }
    savePseudo(name);
    const state: VeriteNavState = {
      isHost: true,
      name: name.trim(),
      visibility,
      setup: { theme, rounds, hostIsChef, customs },
    };
    navigate(`/verite/${newRoomCode('verite')}`, { state });
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (!requireName() || !joinCode.trim()) return;
    savePseudo(name);
    const state: VeriteNavState = {
      isHost: false,
      name: name.trim(),
      setup: { theme, rounds, hostIsChef: false, customs },
    };
    navigate(`/verite/${joinCode.trim().toUpperCase()}`, { state });
  };

  return (
    <div className="rv">
      <div className="rv-wrap">
        <header className="rv-hero">
          <GameTitle as="h1" game="verite" size="xl" motto />
          <p className="rv-lead">
            La bouteille tourne, une carte se retourne, le joueur désigné répond. Le chef du jeu tranche :{' '}
            <span className="rv-ok">✓ valide</span> ou <span className="rv-ko">✗ invalide</span>.
          </p>
        </header>

        <ThemeCarousel focus={theme} />

        <section className="rv-panel" aria-labelledby="rv-theme-title">
          <h2 id="rv-theme-title" className="rv-h2">
            Thème de la partie
          </h2>
          <div className="rv-tabs rv-tabs-lg" role="radiogroup" aria-labelledby="rv-theme-title">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                className="rv-tab"
                data-theme={t}
                onClick={() => {
                  setTheme(t);
                  setError(null);
                }}
              >
                {THEME_INFO[t].label}
              </button>
            ))}
          </div>
          <p className="rv-muted">{THEME_INFO[theme].tagline}</p>
          {theme === 'hard' && (
            <label className="rv-check rv-check-hard">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span>Tout le monde à la table est majeur et d’accord pour des questions intimes.</span>
            </label>
          )}
        </section>

        <div className="rv-grid">
          <form className="rv-panel" onSubmit={create} noValidate>
            <h2 className="rv-h2">Créer une partie</h2>

            <label className="rv-field">
              <span>Pseudo</span>
              <input
                id="rv-pseudo"
                type="text"
                maxLength={18}
                placeholder="Ex : Jules"
                value={name}
                autoComplete="nickname"
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
            </label>

            <fieldset className="rv-field">
              <legend>Manches</legend>
              <div className="rv-tabs" role="radiogroup" aria-label="Nombre de manches">
                {ROUND_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rounds === n}
                    className="rv-tab"
                    onClick={() => setRounds(n)}
                  >
                    {n === 0 ? 'Libre' : n}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="rv-check">
              <input type="checkbox" checked={hostIsChef} onChange={(e) => setHostIsChef(e.target.checked)} />
              <span>
                <Crown size={14} aria-hidden /> Je serai le chef du jeu (j’arbitre, je ne réponds pas)
              </span>
            </label>

            <div className="rv-field">
              <span>Questions perso (optionnel)</span>
              {customs.length > 0 && (
                <ul className="rv-custom-list">
                  {customs.map((q, i) => (
                    <li key={i} data-theme={q.theme}>
                      <span className="rv-custom-tag">{THEME_INFO[q.theme].label}</span>
                      <span className="rv-custom-text">{q.text}</span>
                      {q.publicId && <span className="rv-custom-pub">publique</span>}
                      <button
                        type="button"
                        className="rv-icon-btn"
                        aria-label={`Retirer « ${q.text} »`}
                        onClick={() => setCustoms((list) => list.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="rv-btn rv-btn-ghost rv-btn-sm"
                disabled={customs.length >= MAX_CUSTOMS_PER_PLAYER}
                onClick={() => setDialogOpen(true)}
              >
                <Plus size={15} /> Ajouter une question
              </button>
            </div>

            <SessionVisibility value={visibility} onChange={setVisibility} />

            {error && (
              <p className="rv-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="rv-btn rv-btn-lg">
              Créer la partie
            </button>
          </form>

          <form className="rv-panel" onSubmit={join}>
            <h2 className="rv-h2">Rejoindre</h2>
            <p className="rv-muted">
              Entre le code de la room. Tes questions perso partent avec toi ; c’est l’hôte qui choisit le thème.
            </p>
            <label className="rv-field">
              <span>Code de room</span>
              <input
                type="text"
                className="rv-code-input"
                placeholder="ABC123"
                maxLength={8}
                value={joinCode}
                autoComplete="off"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </label>
            <button type="submit" className="rv-btn rv-btn-ghost" disabled={!joinCode.trim()}>
              Rejoindre
            </button>
            <SessionsLink />

            <div className="rv-howto">
              <h3>Comment on joue</h3>
              <ol>
                <li>2 à 6 joueurs + 1 chef du jeu, qui arbitre.</li>
                <li>La bouteille désigne un joueur, la carte se retourne.</li>
                <li>Il répond, le chef valide : +1 point par réponse validée.</li>
              </ol>
            </div>
          </form>
        </div>
      </div>

      <CustomQuestionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        gameTheme={theme}
        onAdd={(q) => setCustoms((list) => [...list, q])}
      />
    </div>
  );
}
