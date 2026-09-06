import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Copy, Music2, Volume2, VolumeX, Zap } from 'lucide-react';
import { useFlip7Game, type SessionOptions } from './net/useFlip7Game';
import { GameBoard } from './components/GameBoard';
import { RulesModal } from './components/RulesModal';
import { RouletteWheel } from './components/RouletteWheel';
import { ChatPanel } from './components/ChatPanel';
import { FlipCard } from './components/FlipCard';
import { FACE_MS, REVEAL_MS } from './utils/animation';
import { CasinoAudio } from './utils/sound';
import { readPreference, recordRound, savePreference } from './utils/storage';
import { numbers } from './engine/rules';
import type { PlayerAction, PublicState } from './engine/types';
import './flip7.css';

export function Flip7Room() {
  const { code = '' } = useParams();
  const nav = useLocation().state as Partial<SessionOptions> | null;
  const [name, setName] = useState(nav?.name ?? readPreference('name', ''));
  const [joined, setJoined] = useState(Boolean(nav?.name));
  if (!/^[A-Z2-9]{6}$/.test(code)) return <div className="f7-page f7-connection"><h1>Code de table invalide</h1><Link to="/flip7" className="f7-primary">Retour au salon</Link></div>;
  if (!joined) return <div className="f7-page f7-connection"><p className="f7-eyebrow">UNE PLACE T’ATTEND</p><h1>Table {code}</h1><form className="f7-setup" onSubmit={e => { e.preventDefault(); savePreference('name', name.trim() || 'Joueur'); setJoined(true); }}><label htmlFor="f7-guest" className="f7-label">Ton pseudo</label><input id="f7-guest" value={name} maxLength={18} placeholder="Joueur" onChange={e => setName(e.target.value)} /><button className="f7-primary" type="submit">Rejoindre la table</button></form><Link to="/flip7">← Retour au salon</Link></div>;
  return <GameSession key={code} code={code} name={name.trim() || 'Joueur'} isHost={Boolean(nav?.isHost)}
    mode={nav?.mode ?? 'online'} maxPlayers={nav?.maxPlayers ?? 2} difficulty={nav?.difficulty ?? 'medium'} ruleset={nav?.ruleset ?? 'official'} />;
}

function GameSession(options: SessionOptions) {
  const { state, selfId, status, error, clearError, sendAction } = useFlip7Game(options);
  const [visible, setVisible] = useState<PublicState | null>(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);
  const [sound, setSound] = useState(false);
  const [music, setMusic] = useState(false);
  const [lite, setLite] = useState(() => readPreference('lite', '') === 'true' || window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)').matches || (navigator.hardwareConcurrency || 8) <= 4);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const audio = useRef<CasinoAudio | null>(null);
  const soundRef = useRef(sound); soundRef.current = sound;
  const latest = useRef(state); latest.current = state;
  const busyRef = useRef(false);
  const seen = useRef(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [shot, setShot] = useState<PublicState['lastEvent'] | null>(null);
  useEffect(() => {
    audio.current = new CasinoAudio();
    return () => { audio.current?.dispose(); timers.current.forEach(clearTimeout); };
  }, []);
  useEffect(() => {
    if (!state) return;
    const ev = state.lastEvent;
    if (ev.seq !== seen.current) {
      seen.current = ev.seq;
      if (ev.card) {
        busyRef.current = true; setBusy(true); setShot(ev);
        if (soundRef.current) audio.current?.play('spin');
        timers.current.push(setTimeout(() => {
          setVisible(latest.current);
          if (soundRef.current) audio.current?.play(ev.kind === 'draw' ? ev.card!.kind : ev.kind);
        }, FACE_MS));
        timers.current.push(setTimeout(() => { busyRef.current = false; setBusy(false); setShot(null); setVisible(latest.current); }, REVEAL_MS));
      } else if (!busyRef.current) setVisible(state);
    } else if (!busyRef.current) setVisible(state);
  }, [state]);
  useEffect(() => {
    if (state && (state.phase === 'roundOver' || state.phase === 'finished')) {
      const me = state.players.find(p => p.id === selfId);
      if (me) recordRound(`${state.id}:${state.round}:${selfId}`, me.roundPoints, numbers(me).length === 7 && state.options.ruleset === 'official');
    }
  }, [state?.phase, state?.round, state?.id, selfId]);
  const act = useCallback((action: PlayerAction) => {
    if (action.type !== 'CHAT') {
      if (busyRef.current) return;
      // Lock the first click while waiting for the host's response.
      busyRef.current = true; setBusy(true);
      const sentAtSeq = latest.current?.lastEvent.seq;
      timers.current.push(setTimeout(() => { if (sentAtSeq === latest.current?.lastEvent.seq || !latest.current?.lastEvent.card) { busyRef.current = false; setBusy(false); setVisible(latest.current); } }, 350));
    }
    sendAction(action);
  }, [sendAction]);
  const toggleSound = async () => {
    await audio.current?.unlock(); setSound(v => !v);
    if (sound) { setMusic(false); audio.current?.music(false); }
    else audio.current?.play('draw');
  };
  const toggleMusic = async () => { await audio.current?.unlock(); setSound(true); setMusic(v => !v); audio.current?.music(!music); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(options.code); setCopied(true); setCopyError(false); timers.current.push(setTimeout(() => setCopied(false), 1800)); }
    catch { setCopyError(true); }
  };
  if (status !== 'connected' || !state) return <div className="f7-page f7-connection"><FlipCard back /><h1>{status === 'error' ? 'La table est inaccessible' : 'On prépare ta place…'}</h1><p role="status">{error ?? `Connexion à la table ${options.code}`}</p><Link to="/flip7" className="f7-secondary">← Retour au salon</Link></div>;
  const view = visible ?? state;
  return <div className="f7-page f7-room">
    <RulesModal open={rules} onClose={() => setRules(false)} ruleset={state.options.ruleset} />
    <div className="f7-shell f7-room-shell">
      <header className="f7-room-header"><Link to="/flip7" className="f7-room-brand"><ArrowLeft size={18} /><span>FLIP <b>7</b></span></Link>
        <div className="f7-round-pill">MANCHE <b>{state.round || '—'}</b></div>
        <div className="f7-tools">
          {options.mode === 'online' && <button className="f7-code-button" onClick={copy} title="Copier le code">{copied ? <Check size={15} /> : <Copy size={15} />}{options.code}</button>}
          <button className="f7-icon" aria-label={sound ? 'Couper les sons' : 'Activer les sons'} aria-pressed={sound} onClick={toggleSound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="f7-icon" aria-label={music ? 'Couper la musique' : 'Activer la musique'} aria-pressed={music} onClick={toggleMusic}><Music2 size={18} /></button>
          <button className="f7-icon" aria-label="Animations légères" aria-pressed={lite} onClick={() => { setLite(v => !v); savePreference('lite', String(!lite)); }}><Zap size={18} /></button>
          <button className="f7-icon" aria-label="Règles du jeu" onClick={() => setRules(true)}><BookOpen size={18} /></button>
        </div>
      </header>
      {copyError && <p className="f7-notice">Copie ce code pour inviter tes amis : <strong>{options.code}</strong></p>}
      {error && <div className="f7-notice" role="alert">{error}<button onClick={clearError} aria-label="Fermer le message">×</button></div>}
      <div className={`f7-room-layout ${options.mode === 'online' ? 'has-chat' : ''}`}>
        {state.phase === 'lobby' ? <section className="f7-waiting"><div className="f7-waiting-cards"><FlipCard back /><FlipCard card={{ id: 'wait7', kind: 'number', value: 7 }} /></div><p className="f7-eyebrow">LES AMIS FONT LES BONNES TABLES</p><h1>On attend la bande.</h1><p>Partage le code, les autres n’ont plus qu’à s’installer.</p><button className="f7-invite-code" onClick={copy}>{options.code} {copied ? <Check size={21} /> : <Copy size={21} />}</button><p>{state.players.length} / {state.options.maxPlayers} joueurs</p><div className="f7-waiting-players">{state.players.map(p => <span key={p.id}><i className="f7-live-dot" />{p.name}{p.id === state.hostId ? ' · hôte' : ''}</span>)}</div>{selfId === state.hostId ? <button className="f7-primary" disabled={state.players.length !== state.options.maxPlayers} onClick={() => act({ type: 'START' })}>Lancer la partie →</button> : <p>L’hôte lancera la partie quand tout le monde sera là.</p>}</section>
          : view.players.some(p => p.id === selfId) && <GameBoard state={view} selfId={selfId} busy={busy} sendAction={act} />}
        {options.mode === 'online' && <ChatPanel messages={state.chat} onSend={text => act({ type: 'CHAT', text })} selfId={selfId} />}
      </div>
      <footer className="f7-room-footer"><span>♠ UNE CARTE. UN CHOIX. UN FRISSON.</span><span>La Cafétéria · Flip 7</span></footer>
    </div>
    {shot && <RouletteWheel key={shot.seq} event={shot} lite={lite} />}
  </div>;
}
