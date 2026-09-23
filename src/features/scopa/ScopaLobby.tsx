import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BotPlayCard } from '../bots/BotPlayCard';
import { botRoomCode, type BotSetup } from '../bots/bots';
import { BookOpen } from 'lucide-react';
import { GameTitle } from '../../components/GameTitle';
import { RulesModal } from './components/RulesModal';
import { usePlayerName, savePseudo } from '../rooms/playerName';
import { SessionVisibility, type Visibility } from '../rooms/SessionVisibility';
import { SessionsLink } from '../rooms/SessionsLink';

function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export function ScopaLobby() {
  const navigate = useNavigate();
  // Pré-rempli : le pseudo du compte, ou le dernier tapé sur ce navigateur.
  const [name, setName] = usePlayerName();
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [joinCode, setJoinCode] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Choisis un pseudo pour commencer.');
      return;
    }
    const code = randomRoomCode();
    savePseudo(name);
    navigate(`/scopa/${code}`, { state: { isHost: true, visibility, name: name.trim() } });
  };

  const handleBots = (bots: BotSetup) => {
    if (!name.trim()) {
      setNameError('Choisis un pseudo pour commencer.');
      return;
    }
    savePseudo(name);
    navigate(`/scopa/${botRoomCode()}`, { state: { isHost: true, name: name.trim(), bots } });
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Choisis un pseudo pour commencer.');
      return;
    }
    if (!joinCode.trim()) return;
    savePseudo(name);
    navigate(`/scopa/${joinCode.trim().toUpperCase()}`, { state: { isHost: false, name: name.trim() } });
  };

  return (
    <div className="container scopa-lobby">
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <header className="scopa-lobby-header">
        <GameTitle as="h1" game="scopa" size="xl" motto />
        <p>Le jeu de cartes italien, en ligne, entre potes. 2, 3 ou 4 joueurs.</p>
        <button type="button" className="btn btn-outline scopa-rules-link" onClick={() => setRulesOpen(true)}>
          <BookOpen size={15} /> Règles du jeu
        </button>
      </header>

      <div className="scopa-lobby-name">
        <label htmlFor="pseudo">Ton pseudo</label>
        <input
          id="pseudo"
          type="text"
          maxLength={18}
          placeholder="ex: Jules"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
        />
        {nameError && <p className="scopa-form-error">{nameError}</p>}
      </div>

      <div className="scopa-lobby-grid">
        <BotPlayCard className="scopa-lobby-card" counts={[1, 2, 3]} onPlay={handleBots} />

        <form className="scopa-lobby-card" onSubmit={handleCreate}>
          <h2>Créer une partie</h2>
          <p>Un nouveau code de room sera généré. Partage-le à tes potes pour qu'ils te rejoignent.</p>
          <SessionVisibility value={visibility} onChange={setVisibility} />
          <button type="submit" className="btn btn-primary">
            Créer la room
          </button>
        </form>

        <form className="scopa-lobby-card" onSubmit={handleJoin}>
          <h2>Rejoindre une partie</h2>
          <p>Entre le code de room que ton pote t'a envoyé.</p>
          <input
            type="text"
            placeholder="Code de room"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="scopa-code-input"
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
