import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface RingSeat {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * La bouteille au centre, les joueurs en cercle autour.
 *
 * L'angle vient de l'hôte (cumulé d'une manche à l'autre), si bien que tous
 * les écrans font tourner la bouteille de la même façon et l'arrêtent sur le
 * même joueur. Le premier siège est en haut, puis dans le sens des aiguilles
 * d'une montre — la convention de `spinAngle` dans le moteur.
 */
export function Bottle({
  seats,
  angle,
  spinning,
  targetId,
  spinKey,
}: {
  seats: RingSeat[];
  angle: number;
  spinning: boolean;
  targetId: string | null;
  /** Change à chaque lancer : rejoue le vacillement final. */
  spinKey: string | number;
}) {
  // Arrivée pendant que la bouteille tourne (lancement de la partie) : on
  // part de sa position de repos pour qu'elle tourne vraiment à l'écran.
  const [shown, setShown] = useState(() => (spinning ? angle - (angle % 360) - 1080 : angle));
  const [animated, setAnimated] = useState(false);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      if (!spinning) return;
    }
    if (!spinning) {
      setAnimated(false);
      setShown(angle);
      return;
    }
    // Une image plus tard : le navigateur doit avoir peint l'angle de départ
    // pour que la transition parte de là.
    const raf = requestAnimationFrame(() => {
      setAnimated(true);
      setShown(angle);
    });
    return () => cancelAnimationFrame(raf);
  }, [angle, spinning]);

  const [settled, setSettled] = useState(!spinning);
  useEffect(() => {
    if (!spinning) {
      setSettled(true);
      return;
    }
    setSettled(false);
  }, [spinning, spinKey]);

  const n = seats.length;

  return (
    <div className="rv-arena" data-spinning={spinning || undefined}>
      <ol className="rv-ring" aria-label="Joueurs autour de la bouteille">
        {seats.map((s, i) => {
          const a = ((-90 + (i * 360) / Math.max(1, n)) * Math.PI) / 180;
          const chosen = settled && s.id === targetId;
          return (
            <li
              key={s.id}
              className="rv-seat"
              data-chosen={chosen || undefined}
              data-away={!s.connected || undefined}
              style={{ '--cx': Math.cos(a).toFixed(4), '--cy': Math.sin(a).toFixed(4) } as CSSProperties}
            >
              <span>{s.name}</span>
            </li>
          );
        })}
      </ol>

      <div
        className="rv-bottle"
        data-animated={animated || undefined}
        style={{ transform: `translate(-50%, -50%) rotate(${shown}deg)` }}
        onTransitionEnd={() => setSettled(true)}
      >
        <div className="rv-bottle-wobble" key={spinKey} data-wobble={spinning || undefined}>
          <BottleSvg />
        </div>
      </div>
    </div>
  );
}

/** Une bouteille stylisée, goulot vers le haut : c'est lui qui désigne. */
function BottleSvg() {
  return (
    <svg viewBox="0 0 60 200" className="rv-bottle-svg" aria-hidden focusable="false">
      <defs>
        <linearGradient id="rv-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#50ff4d" stopOpacity="0.14" />
          <stop offset="0.35" stopColor="#50ff4d" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#baffba" stopOpacity="0.55" />
          <stop offset="1" stopColor="#50ff4d" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {/* Pointe lumineuse au bout du goulot */}
      <path d="M30 0 L38 12 L22 12 Z" className="rv-bottle-tip" />
      <rect x="24" y="14" width="12" height="10" rx="2" className="rv-bottle-cap" />
      <path
        d="M25 24 H35 V62 C35 74 52 80 52 100 V184 C52 192 46 198 38 198 H22 C14 198 8 192 8 184 V100 C8 80 25 74 25 62 Z"
        fill="url(#rv-glass)"
        className="rv-bottle-glass"
      />
      <rect x="14" y="116" width="32" height="44" rx="3" className="rv-bottle-label" />
      <path d="M22 130 H38 M22 138 H34 M22 146 H36" className="rv-bottle-label-lines" />
      <path d="M16 104 V178" className="rv-bottle-shine" />
    </svg>
  );
}
