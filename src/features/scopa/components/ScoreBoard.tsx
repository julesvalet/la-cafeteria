import type { GameState } from '../engine/types';

interface ScoreBoardProps {
  state: GameState;
  selfId: string | null;
}

export function ScoreBoard({ state, selfId }: ScoreBoardProps) {
  return (
    <aside className="scopa-scoreboard">
      <h3>Score de la manche</h3>
      <ul>
        {state.players.map((p, i) => (
          <li key={p.id} className={i === state.turn && state.phase === 'playing' ? 'is-active' : ''}>
            <span className="scopa-player-dot" style={{ opacity: p.connected ? 1 : 0.35 }} />
            <span className="scopa-player-name">
              {p.name}
              {p.id === selfId ? ' (toi)' : ''}
              {!p.connected ? ' — déconnecté' : ''}
            </span>
            <span className="scopa-player-stats">
              🃏 {p.captured.length} · ⚡ {p.scope} · pts {state.matchScores[i] ?? 0}
            </span>
          </li>
        ))}
      </ul>
      <p className="scopa-target">Objectif : {state.targetScore} points</p>
    </aside>
  );
}
