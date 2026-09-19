import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, Layers } from 'lucide-react';
import { GameTitle } from '../../components/GameTitle';
import { UnoRulesModal } from './components/UnoRulesModal';
import { usePlayerName, savePseudo } from '../rooms/playerName';
import { SessionVisibility, type Visibility } from '../rooms/SessionVisibility';
import { SessionsLink } from '../rooms/SessionsLink';

function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

const PLAYER_COUNTS = [2, 3, 4];

const COUNT_TAGLINE: Record<number, string> = {
  2: 'Duel en tête à tête. Pas de carte mystère.',
  3: 'Trois joueurs, 2 cartes mystère dans la pioche.',
  4: 'Quatre joueurs, 2 cartes mystère dans la pioche.',
};

export function UnoLobby() {
  const navigate = useNavigate();
  // Pré-rempli : le pseudo du compte, ou le dernier tapé sur ce navigateur.
  const [name, setName] = usePlayerName();
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState(2);
  const [stacking, setStacking] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const requireName = () => {
    if (name.trim()) return true;
    setNameError('Choisis un pseudo pour commencer.');
    return false;
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!requireName()) return;
    savePseudo(name);
    navigate(`/uno/${randomRoomCode()}`, {
      state: { isHost: true, visibility, name: name.trim(), maxPlayers: players, stackingEnabled: stacking },
    });
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!requireName()) return;
    if (!joinCode.trim()) return;
    savePseudo(name);
    navigate(`/uno/${joinCode.trim().toUpperCase()}`, {
      state: { isHost: false, name: name.trim() },
    });
  };

  return (
    <div className="container p4-lobby">
      <UnoRulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        stackingEnabled={stacking}
        mysteryEnabled={players > 2}
      />

      <header className="p4-lobby-header">
        <GameTitle as="h1" game="uno" size="xl" motto />
        <p>Débarrasse-toi de toutes tes cartes. Avec des cartes mystère et le duel UNO / Contre UNO.</p>
        <button type="button" className="btn btn-outline p4-rules-link" onClick={() => setRulesOpen(true)}>
          <BookOpen size={15} /> Règles du jeu
        </button>
      </header>

      <div className="p4-lobby-name">
        <label htmlFor="uno-pseudo">Ton pseudo</label>
        <input
          id="uno-pseudo"
          type="text"
          maxLength={18}
          placeholder="ex: Jules"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
        />
        {nameError && <p className="p4-form-error">{nameError}</p>}
      </div>

      <section className="p4-mode-picker">
        <h2>Nombre de joueurs</h2>
        <div className="p4-mode-grid" role="radiogroup" aria-label="Nombre de joueurs">
          {PLAYER_COUNTS.map((count) => {
            const active = players === count;
            return (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={active}
                className={`p4-mode-card${active ? ' is-active' : ''}`}
                onClick={() => setPlayers(count)}
              >
                <span className="p4-mode-top">
                  <span className="p4-mode-label">{count} joueurs</span>
                  {active && (
                    <span className="p4-mode-check">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="uno-mode-seats">
                  {Array.from({ length: count }, (_, i) => (
                    <span key={i} className="uno-mode-seat" />
                  ))}
                </span>
                <span className="p4-mode-tagline">{COUNT_TAGLINE[count]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="uno-option">
        <button
          type="button"
          role="switch"
          aria-checked={stacking}
          className={`uno-toggle${stacking ? ' is-on' : ''}`}
          onClick={() => setStacking((v) => !v)}
        >
          <span className="uno-toggle-track">
            <span className="uno-toggle-thumb" />
          </span>
          <span className="uno-toggle-text">
            <span className="uno-toggle-label">
              <Layers size={15} /> Autoriser la surenchère des +
            </span>
            <span className="uno-toggle-sub">
              {stacking
                ? 'Un +2 peut être relancé par un +2 ou un +4 : la pile grossit jusqu’à ce que quelqu’un encaisse.'
                : 'Règles standard : un +2 ou un +4 se pioche immédiatement, sans cumul possible.'}
            </span>
          </span>
        </button>
      </section>

      <div className="p4-lobby-grid">
        <form className="p4-lobby-card" onSubmit={handleCreate}>
          <h2>Créer une partie</h2>
          <p>
            Un code de room sera généré. Partage-le à tes potes : il faut être <strong>{players}</strong> pour lancer
            la partie.
          </p>
          <SessionVisibility value={visibility} onChange={setVisibility} />
          <button type="submit" className="btn btn-primary">
            Créer la room
          </button>
        </form>

        <form className="p4-lobby-card" onSubmit={handleJoin}>
          <h2>Rejoindre une partie</h2>
          <p>Entre le code de room que ton pote t'a envoyé. C'est l'hôte qui choisit les options.</p>
          <input
            type="text"
            placeholder="Code de room"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="p4-code-input"
          />
          <button type="submit" className="btn btn-outline" disabled={!joinCode.trim()}>
            Rejoindre
          </button>
          <SessionsLink />
        </form>
      </div>
    </div>
  );
}
