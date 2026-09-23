import { useEffect, useRef, useState } from 'react';
import { usePlafee } from '../usePlafee';
import { FeesAmount } from './bits';
import type { VictoryAnim, VictoryDetail } from '../victory';

/*
 * L'animation de victoire, jouée par-dessus n'importe quel jeu.
 *
 * Les jeux ne la connaissent pas : l'enregistrement d'une partie gagnée
 * (useRecordGame) émet `plafee:victory`, et ce composant — monté une fois dans
 * App — joue l'animation que le joueur a équipée à la boutique.
 */

const DURATION = 2800;

export function VictoryFx() {
  const { mine } = usePlafee();
  const [shot, setShot] = useState<(VictoryDetail & { key: number; anim: VictoryAnim }) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const equipped = (mine?.victory_anim as VictoryAnim | null) ?? 'confetti';
  const equippedRef = useRef(equipped);
  equippedRef.current = equipped;

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<VictoryDetail>).detail;
      setShot({ ...d, key: Date.now(), anim: d.anim ?? equippedRef.current });
    };
    window.addEventListener('plafee:victory', on);
    return () => window.removeEventListener('plafee:victory', on);
  }, []);

  useEffect(() => {
    if (!shot) return;
    const t = window.setTimeout(() => setShot(null), DURATION + 400);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (reduce || !canvas || shot.anim === 'hologram') return () => window.clearTimeout(t);
    const stop = runParticles(canvas, shot.anim);
    return () => {
      window.clearTimeout(t);
      stop();
    };
  }, [shot]);

  if (!shot) return null;
  return (
    <div className="plf-victory" data-anim={shot.anim} key={shot.key} aria-live="polite">
      <canvas ref={canvasRef} className="plf-victory-canvas" aria-hidden />
      <div className="plf-victory-card">
        <span className="plf-victory-title">{shot.preview ? 'Aperçu' : 'Victoire !'}</span>
        {shot.fees > 0 && <FeesAmount value={shot.fees} signed size="lg" />}
        {shot.streak && shot.streak > 1 ? <span className="plf-victory-streak">Série de {shot.streak} jours</span> : null}
      </div>
    </div>
  );
}

// --- Particules ------------------------------------------------------------------

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  rot: number;
  vr: number;
}

const PALETTE = ['#50ff4d', '#00ffff', '#ff00ff', '#ffc53d', '#ffffff', '#ff4d6a'];

function runParticles(canvas: HTMLCanvasElement, anim: VictoryAnim): () => void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  ctx.scale(dpr, dpr);
  const neon = getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() || '#50ff4d';
  const colors = [neon, ...PALETTE];
  const pick = () => colors[Math.floor(Math.random() * colors.length)];
  const parts: P[] = [];

  const burst = (x: number, y: number, n: number, speed: number, color?: string) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: 2 + Math.random() * 2.5, color: color ?? pick(), life: 1, rot: 0, vr: 0 });
    }
  };

  if (anim === 'confetti') {
    for (let i = 0; i < 160; i++) {
      parts.push({
        x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
        size: 5 + Math.random() * 6, color: pick(), life: 1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      });
    }
  } else if (anim === 'pixels') {
    // L'écran part en morceaux : une grille de pixels qui s'envole du centre.
    const cell = Math.max(10, Math.round(Math.min(w, h) / 40));
    for (let x = w * 0.2; x < w * 0.8; x += cell) {
      for (let y = h * 0.25; y < h * 0.75; y += cell) {
        if (Math.random() < 0.55) continue;
        const dx = x - w / 2;
        const dy = y - h / 2;
        const d = Math.hypot(dx, dy) || 1;
        parts.push({ x, y, vx: (dx / d) * (3 + Math.random() * 6), vy: (dy / d) * (3 + Math.random() * 6) - 2, size: cell - 2, color: pick(), life: 1, rot: 0, vr: 0 });
      }
    }
  }

  let frame = 0;
  let raf = 0;
  const start = performance.now();
  const tick = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, w, h);
    if (anim === 'fireworks' && frame % 22 === 0 && elapsed < DURATION - 800) {
      burst(w * (0.15 + Math.random() * 0.7), h * (0.15 + Math.random() * 0.4), 70, 7, pick());
    }
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (anim === 'confetti') {
        p.vx += Math.sin((p.y + frame) / 30) * 0.05;
      } else if (anim === 'fireworks') {
        p.vy += 0.08;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= 0.012;
      } else {
        p.vy += 0.15;
        p.life -= 0.008;
      }
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * (elapsed > DURATION - 500 ? (DURATION - elapsed) / 500 : 1)));
      ctx.fillStyle = p.color;
      if (anim === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = anim === 'fireworks' ? 8 : 0;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    frame += 1;
    if (elapsed < DURATION) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, w, h);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
