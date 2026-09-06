import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Snowflake, Trophy } from 'lucide-react';
import { FlipCard } from './FlipCard';
import { hasChance, numbers, points } from '../engine/rules';
import type { PlayerAction, PublicState } from '../engine/types';

function AnimatedScore({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const from = previous.current; previous.current = value;
    if (reduced) { setDisplay(value); return; }
    let frame = 0; let start = 0;
      const animate = (now: number) => {
        start ||= now; const t = Math.min(1, (now - start) / 300);
        setDisplay(Math.round(from + (value - from) * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <span>{display}</span>;
}
export function GameBoard({ state, selfId, busy, sendAction }: { state: PublicState; selfId: string; busy: boolean; sendAction: (a: PlayerAction) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const turnPlayer = state.players[state.turn];
  const me = state.players.find(p => p.id === selfId)!;
  const viewed = state.players.find(p => p.id === selected) ?? (state.phase === 'playing' ? state.players[state.pending?.by ?? state.turn] : me);
  const target = state.pending?.by === state.players.findIndex(p => p.id === selfId);
  const myTurn = turnPlayer?.id === selfId && state.phase === 'playing' && !state.automatic && !state.pending;
  const actionable = myTurn && !busy;
  const ended = state.phase === 'roundOver' || state.phase === 'finished';
  const score = points(viewed, state.options.ruleset);
  const ns = numbers(viewed);
  const canStay = state.options.ruleset === 'cafeteria' || Boolean(me?.cards.length);
  useEffect(() => setSelected(null), [state.turn, state.pending?.by, state.phase]);
  return <div className="f7-game-area">
    <div className="f7-table-caption"><span><i className="f7-live-dot" /> {state.options.mode === 'solo' ? 'ENTRAÎNEMENT' : state.options.mode === 'bots' ? 'FACE AUX BOTS' : 'ENTRE AMIS'}</span><span>{state.options.ruleset === 'official' ? 'OBJECTIF 200 POINTS' : 'VARIANTE CAFÉTÉRIA'}</span></div>
    <div className={`f7-table-wrap players-${state.players.length}`}>
      <div className="f7-seats">
        {state.players.map((p, i) => <button type="button" key={p.id} className={`f7-seat seat-${i} ${state.phase === 'playing' && p.id === turnPlayer.id ? 'is-current' : ''} ${p.status === 'busted' ? 'is-busted' : ''} ${p.status === 'frozen' || p.skip ? 'is-frozen' : ''}`} onClick={() => setSelected(p.id)} aria-label={`Voir les cartes de ${p.name}`} style={{ '--seat-color': ['#d6b456', '#79b9ad', '#a99ace', '#e29b86', '#9eb775'][i] } as CSSProperties}>
          <span className="f7-avatar">{p.bot ? '✦' : p.name.charAt(0).toUpperCase()}{hasChance(p) && <ShieldCheck className="f7-avatar-badge" size={18} />}{(p.status === 'frozen' || p.skip) && <Snowflake className="f7-avatar-badge" size={18} />}</span>
          <span className="f7-seat-info"><b>{p.name}{p.id === selfId ? ' · toi' : ''}</b><span>{!p.connected ? 'Déconnecté·e' : p.status === 'busted' ? 'Doublon · 0 pt' : p.status === 'frozen' ? 'Gelé·e · points assurés' : p.status === 'stayed' ? 'Points assurés' : p.chanceUsed ? 'Seconde chance utilisée' : `${points(p, state.options.ruleset)} points en jeu`}</span></span>
          <strong>{p.total}<small>PTS</small></strong>
        </button>)}
      </div>
      <div className={`f7-table ${state.lastEvent.kind === 'bust' ? 'has-bust' : ''}`}>
        <div className="f7-table-ornament" aria-hidden="true">♠ <span>LA CAFÉTÉRIA</span> ♠</div>
        <div className="f7-table-body">
          <div className="f7-deck"><FlipCard back /><span>{state.deckCount} cartes</span></div>
          <div className="f7-hand-area">
            <p className="f7-hand-label">{viewed.id === selfId ? 'TES CARTES' : `LES CARTES DE ${viewed.name.toUpperCase()}`}</p>
            <div className="f7-hand" aria-label={`Cartes de ${viewed.name}`}>
              {viewed.cards.length ? viewed.cards.map((c, i) => <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }} style={{ '--card-angle': `${(i % 3 - 1) * 3}deg` } as CSSProperties}><FlipCard card={c} /></motion.div>) : <div className="f7-empty-hand"><span>✦</span><p>Tout commence<br />par une carte.</p></div>}
            </div>
            {state.options.ruleset === 'official' && <div className="f7-seven-progress" aria-label={`${ns.length} numéros différents sur 7`}>
              {Array.from({ length: 7 }, (_, i) => <i className={i < ns.length ? 'is-filled' : ''} key={i}>{i < ns.length ? '◆' : '◇'}</i>)}<span>{ns.length}/7 <b>+15 pts</b></span>
            </div>}
          </div>
          <div className={`f7-score ${viewed.status === 'busted' ? 'is-bust' : ''}`}><AnimatedScore value={score} /><p>POINTS<br />CETTE MANCHE</p><span className="f7-score-rule" /></div>
        </div>
        <div className="f7-table-signature">FLIP <b>7</b><span>LA CHANCE SOURIT AUX AUDACIEUX</span></div>
      </div>
    </div>
    <p className={`f7-event ${state.lastEvent.kind === 'bust' ? 'is-bust' : ''}`} role="status">{busy ? 'La chance tourne…' : state.lastEvent.text}</p>
    {!ended && <div className="f7-decision">
      {state.pending ? <>
        <h2>{target ? 'À qui jouer cette carte ?' : `${state.players[state.pending.by].name} choisit un joueur…`}</h2>
        {target && <div className="f7-targets">{state.players.filter(p => p.connected && p.status === 'active' && (state.pending!.card.kind !== 'chance' || !hasChance(p))).map(p => <button className="f7-secondary" key={p.id} disabled={busy} onClick={() => sendAction({ type: 'TARGET', targetId: p.id })}>{p.name}{p.id === selfId ? ' (toi)' : ''}</button>)}</div>}
      </> : <>
        <h2>{busy || state.automatic ? 'Un instant de suspense…' : myTurn ? 'Encore une carte ?' : `Au tour de ${turnPlayer.name}…`}</h2>
        <div className="f7-yes-no"><span className="f7-coin coin-left" aria-hidden="true">✦</span>
          <button className="f7-yes" disabled={!actionable} onClick={() => sendAction({ type: 'HIT' })}><b>OUI</b><span>Je tente ma chance</span></button>
          <button className="f7-no" disabled={!actionable || !canStay} onClick={() => sendAction({ type: 'STAY' })}><b>NON</b><span>J’assure mes points</span></button>
          <span className="f7-coin coin-right" aria-hidden="true">✦</span>
        </div>
        <p className="f7-decision-hint">{myTurn ? `Un doublon et les points de cette manche s’envolent.${hasChance(me) ? ' Ta seconde chance te protège.' : ''}` : 'Garde un œil sur les cartes. Ton tour arrive.'}</p>
      </>}
    </div>}
    {ended && <section className="f7-results"><Trophy size={30} /><p className="f7-eyebrow">{state.phase === 'finished' ? 'LA PARTIE EST TERMINÉE' : `FIN DE LA MANCHE ${state.round}`}</p><h2>{state.winnerId ? `${state.players.find(p => p.id === state.winnerId)?.name} remporte la partie !` : state.lastEvent.kind === 'flip7' ? 'Sept cartes. Un joli coup.' : 'Les jeux sont faits.'}</h2>
      <div className="f7-result-rows">{[...state.players].sort((a, b) => b.total - a.total).map((p, i) => <div key={p.id}><span>{i + 1 < 10 ? '0' : ''}{i + 1}</span><b>{p.name}{p.id === selfId ? ' · toi' : ''}</b><span>+{p.roundPoints}</span><strong>{p.total} pts</strong></div>)}</div>
      {selfId === state.hostId ? <button className="f7-primary" disabled={busy || (state.options.mode !== 'solo' && state.players.filter(p => p.connected).length < 2)} onClick={() => sendAction({ type: state.phase === 'finished' ? 'REMATCH' : 'NEXT_ROUND' })}>{state.phase === 'finished' ? 'Rejouer' : 'Manche suivante'} →</button> : <p>L’hôte prépare la prochaine manche.</p>}
      {state.options.mode !== 'solo' && state.players.filter(p => p.connected).length < 2 && <p>Il faut au moins deux joueurs. Reviens au salon pour ouvrir une nouvelle table.</p>}
    </section>}
    <details className="f7-scoreboard"><summary>Le classement et les cartes de la table</summary><div>{state.players.map(p => <div key={p.id}><b>{p.name} <span>{p.total} pts</span></b><p>{p.cards.length ? p.cards.map(c => c.kind === 'number' ? c.value : c.kind === 'bonus' ? `+${c.value}` : c.kind === 'double' ? '×2' : '♡').join(' · ') : 'Aucune carte'}</p></div>)}</div></details>
  </div>;
}
