import { Suspense, lazy, useEffect, useState } from 'react';
import { FlipCard } from './FlipCard';
import type { GameEvent } from '../engine/types';
import { FACE_MS, REVEAL_MS } from '../utils/animation';

const ThreeRoulette = lazy(() => import('./ThreeRoulette'));
export function RouletteWheel({ event, lite }: { event: GameEvent; lite: boolean }) {
  const [phase, setPhase] = useState<'spin' | 'face' | 'done'>('spin');
  const [gpuFailed, setGpuFailed] = useState(false);
  useEffect(() => {
    setPhase('spin');
    const face = setTimeout(() => setPhase('face'), FACE_MS);
    const done = setTimeout(() => setPhase('done'), REVEAL_MS);
    return () => { clearTimeout(face); clearTimeout(done); };
  }, [event.seq]);
  if (!event.card || phase === 'done') return null;
  return <div className={`f7-reveal ${phase === 'face' ? 'is-face' : ''} ${event.kind === 'bust' ? 'is-bust' : ''} ${lite ? 'is-lite' : ''}`} aria-hidden="true">
    <div className="f7-reveal-glow" />
    {phase === 'spin' && !lite && !gpuFailed && <Suspense fallback={null}><ThreeRoulette onFailure={() => setGpuFailed(true)} /></Suspense>}
    <div className="f7-css-orbit"><i /><i /><i /></div>
    <div className="f7-reveal-card"><FlipCard card={event.card} back={phase === 'spin'} /></div>
    <div className="f7-reveal-label">{phase === 'spin' ? 'LA CHANCE TOURNE…' : event.kind === 'bust' ? 'DOUBLON !' : event.kind === 'saved' ? 'SAUVÉ !' : event.kind === 'flip7' ? 'FLIP 7 ! +15' : event.card.kind === 'double' ? 'ON DOUBLE !' : event.card.kind === 'freeze' ? 'FREEZE !' : 'À VOUS DE JOUER'}</div>
  </div>;
}
