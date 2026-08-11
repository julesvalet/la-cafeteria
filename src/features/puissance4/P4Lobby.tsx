import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check } from 'lucide-react';
import { MODES, MODE_ORDER, discColor } from './engine/modes';
import { P4RulesModal } from './components/P4RulesModal';
import type { P4Mode } from './engine/types';

function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export function P4Lobby() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<P4Mode>('duel');
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
    navigate(`/puissance4/${randomRoomCode()}`, {
      state: { isHost: true, name: name.trim(), mode },
    });
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!requireName()) return;
    if (!joinCode.trim()) return;
    navigate(`/puissance4/${joinCode.trim().toUpperCase()}`, {
      state: { isHost: false, name: name.trim() },
    });
  };

  return (
    <div className="container p4-lobby">
      <P4RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} mode={mode} />

      <header className="p4-lobby-header">
        <h1>Puissance 4</h1>
        <p>Aligne quatre jetons. Avec des pouvoirs, et jusqu'à quatre joueurs.</p>
        <button type="button" className="btn btn-outline p4-rules-link" onClick={() => setRulesOpen(true)}>
          <BookOpen size={15} /> Règles du jeu
        </button>
      </header>

      <div className="p4-lobby-name">
        <label htmlFor="p4-pseudo">Ton pseudo</label>
        <input
          id="p4-pseudo"
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
        <h2>Mode de jeu</h2>
        <div className="p4-mode-grid" role="radiogroup" aria-label="Mode de jeu">
          {MODE_ORDER.map((id) => {
            const config = MODES[id];
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`p4-mode-card${active ? ' is-active' : ''}`}
                onClick={() => setMode(id)}
              >
                <span className="p4-mode-top">
                  <span className="p4-mode-label">{config.label}</span>
                  {active && (
                    <span className="p4-mode-check">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="p4-mode-discs">
                  {Array.from({ length: config.players }, (_, i) => (
                    <span
                      key={i}
                      className="p4-mode-disc"
                      style={{ background: discColor(id, i) }}
                      // In 2v2 the two teams stand slightly apart.
                      data-gap={id === 'teams' && i === 2 ? 'true' : undefined}
                    />
                  ))}
                </span>
                <span className="p4-mode-tagline">{config.tagline}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="p4-lobby-grid">
        <form className="p4-lobby-card" onSubmit={handleCreate}>
          <h2>Créer une partie</h2>
          <p>
            Un code de room sera généré. Partage-le à tes potes : il faut être{' '}
            <strong>{MODES[mode].players}</strong> pour lancer ce mode.
          </p>
          <button type="submit" className="btn btn-primary">
            Créer la room
          </button>
        </form>

        <form className="p4-lobby-card" onSubmit={handleJoin}>
          <h2>Rejoindre une partie</h2>
          <p>Entre le code de room que ton pote t'a envoyé. C'est l'hôte qui choisit le mode.</p>
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
        </form>
      </div>
    </div>
  );
}
