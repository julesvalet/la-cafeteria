import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RulesModal } from './components/RulesModal';

function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export function ScopaLobby() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
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
    navigate(`/scopa/${code}`, { state: { isHost: true, name: name.trim() } });
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Choisis un pseudo pour commencer.');
      return;
    }
    if (!joinCode.trim()) return;
    navigate(`/scopa/${joinCode.trim().toUpperCase()}`, { state: { isHost: false, name: name.trim() } });
  };

  return (
    <div className="container scopa-lobby">
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <header className="scopa-lobby-header">
        <h1>Scopa</h1>
        <p>Le jeu de cartes italien, en ligne, entre potes. 2, 3 ou 4 joueurs.</p>
        <button type="button" className="btn btn-outline scopa-rules-link" onClick={() => setRulesOpen(true)}>
          📖 Règles du jeu
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
        <form className="scopa-lobby-card" onSubmit={handleCreate}>
          <h2>Créer une partie</h2>
          <p>Un nouveau code de room sera généré. Partage-le à tes potes pour qu'ils te rejoignent.</p>
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
        </form>
      </div>
    </div>
  );
}
