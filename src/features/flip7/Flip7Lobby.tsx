import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Bot, Sparkles, Users, Trophy } from 'lucide-react';
import { GameTitle } from '../../components/GameTitle';
import { FlipCard } from './components/FlipCard';
import { RulesModal } from './components/RulesModal';
import { readStats } from './utils/storage';
import { usePlayerName, savePseudo } from '../rooms/playerName';
import { SessionVisibility, type Visibility } from '../rooms/SessionVisibility';
import { SessionsLink } from '../rooms/SessionsLink';
import type { Difficulty, GameMode, Ruleset } from './engine/types';
import './flip7.css';

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % alphabet.length]).join('');
}
export function Flip7Lobby() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<GameMode>('bots');
  const [name, setName] = usePlayerName();
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [count, setCount] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [ruleset, setRuleset] = useState<Ruleset>('official');
  const [code, setCode] = useState('');
  const [rules, setRules] = useState(false);
  const stats = readStats();
  const start = (e: FormEvent, join = false) => {
    e.preventDefault();
    const playerName = name.trim() || 'Joueur'; savePseudo(playerName);
    const nextCode = join ? code.trim().toUpperCase() : roomCode();
    navigate(`/flip7/${nextCode}`, { state: { name: playerName, isHost: !join, visibility, mode: join ? 'online' : mode,
      maxPlayers: mode === 'solo' ? 1 : count, difficulty, ruleset } });
  };
  return <div className="f7-page f7-lobby">
    <RulesModal open={rules} onClose={() => setRules(false)} ruleset={ruleset} />
    <div className="f7-shell">
      <nav className="f7-nav"><Link to="/"><ArrowLeft size={16} /> Les jeux</Link><button onClick={() => setRules(true)}><BookOpen size={16} /> Comment jouer</button></nav>
      <div className="f7-lobby-grid">
        <section className="f7-hero">
          <p className="f7-eyebrow"><span className="f7-live-dot" /> LA CAFÉTÉRIA PRÉSENTE</p>
          <GameTitle as="h1" game="flip7" size="xl" motto className="f7-title" />
          <h2>La prochaine carte<br />peut tout changer.</h2>
          <p className="f7-hero-copy">Un peu d’audace. Beaucoup de suspense.<br />Accumule les points, évite le doublon…<br />et sache quand t’arrêter.</p>
          <div className="f7-hero-cards" aria-label="Cartes de Flip 7">
            <FlipCard card={{ id: 'demo1', kind: 'number', value: 3 }} />
            <FlipCard card={{ id: 'demo2', kind: 'number', value: 7 }} />
            <FlipCard card={{ id: 'demo3', kind: 'double', value: 2 }} />
            <span className="f7-hero-chip">7</span>
          </div>
          <div className="f7-hero-meta"><span>01–05 joueurs</span><i>✦</i><span>100 % pour le plaisir</span></div>
        </section>
        <section className="f7-setup">
          <div className="f7-setup-title"><span className="f7-eyebrow">INSTALLE-TOI À LA TABLE</span><span>♠</span></div>
          <h2>On joue comment ?</h2>
          <div className="f7-mode-tabs" role="group" aria-label="Mode de jeu">
            {([{ id: 'bots', label: 'Face aux bots', icon: Bot }, { id: 'online', label: 'Entre amis', icon: Users }, { id: 'solo', label: 'En solo', icon: Sparkles }] as const).map(m =>
              <button key={m.id} aria-pressed={mode === m.id} className={mode === m.id ? 'is-selected' : ''} onClick={() => { setMode(m.id); setCount(2); }}><m.icon size={19} />{m.label}</button>)}
          </div>
          <form onSubmit={e => start(e)}>
            <label className="f7-label" htmlFor="f7-name">Ton pseudo <span>facultatif</span></label>
            <input id="f7-name" maxLength={18} value={name} placeholder="Comment t’appelle-t-on ?" onChange={e => setName(e.target.value)} />
            {mode !== 'solo' && <><span className="f7-label">{mode === 'bots' ? 'Tes adversaires' : 'Nombre de joueurs'}</span>
              <div className="f7-counts" role="group" aria-label="Nombre de joueurs">
                {(mode === 'bots' ? [2, 3, 4] : [2, 3, 4, 5]).map(n => <button type="button" aria-pressed={count === n} className={count === n ? 'is-selected' : ''} key={n} onClick={() => setCount(n)}>{mode === 'bots' ? `${n - 1} bot${n > 2 ? 's' : ''}` : `${n} joueurs`}</button>)}
              </div></>}
            {mode === 'bots' && <><label className="f7-label" htmlFor="f7-level">Leur petit caractère</label>
              <select id="f7-level" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
                <option value="easy">Facile · À pile ou face</option><option value="medium">Moyen · Un risque mesuré</option><option value="hard">Difficile · Les probabilités en tête</option>
              </select></>}
            <label className="f7-label" htmlFor="f7-ruleset">Les règles de la table</label>
            <select id="f7-ruleset" value={ruleset} onChange={e => setRuleset(e.target.value as Ruleset)}><option value="official">Flip 7 · 94 cartes, de 0 à 12</option><option value="cafeteria">Variante Cafétéria · 62 cartes, de 0 à 7</option></select>
            {mode === 'online' && <SessionVisibility value={visibility} onChange={setVisibility} />}
            <p className="f7-setup-note">{mode === 'solo' ? 'Pas d’adversaire, pas de limite. Bats ton record de manche.' : mode === 'bots' ? 'La table est prête. Tes adversaires aussi.' : 'Crée la table, puis partage son code à tes amis.'}</p>
            <button className="f7-primary f7-start" type="submit">{mode === 'online' ? 'Créer une table' : 'Entrer dans la partie'}<ArrowRight size={19} /></button>
          </form>
          {mode === 'online' && <form className="f7-join" onSubmit={e => start(e, true)}><label htmlFor="f7-code">Déjà une invitation ?</label><div><input id="f7-code" placeholder="CODE" maxLength={6} pattern="[A-Za-z2-9]{6}" required value={code} onChange={e => setCode(e.target.value.toUpperCase())} /><button className="f7-secondary" type="submit" disabled={code.trim().length !== 6}>Rejoindre</button></div><SessionsLink /></form>}
        </section>
      </div>
      <footer className="f7-lobby-footer"><span><Trophy size={17} /> Ton carnet de jeu</span><span><b>{stats.rounds}</b> manches</span><span><b>{stats.best}</b> record</span><span><b>{stats.flip7s}</b> Flip 7</span></footer>
    </div>
  </div>;
}
