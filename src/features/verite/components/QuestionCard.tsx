import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { FLIP_MS, typeDelay } from '../engine/rules';
import { THEME_INFO } from '../engine/questions';
import type { VeriteTheme } from '../engine/types';

/**
 * La carte question, façon carte à collectionner : face cachée grise, puis
 * elle glisse et se retourne, et la question s'écrit lettre par lettre.
 *
 * `revealKey` identifie une révélation : quand il change alors que la carte
 * est face visible, elle rejoue le retournement et la frappe. Avec
 * `animate = false` (arrivée en cours de manche, mouvement réduit), la
 * question s'affiche d'un coup.
 */
export function QuestionCard({
  theme,
  text,
  faceUp,
  revealKey,
  animate = true,
  footer,
  onClick,
  size = 'md',
}: {
  theme: VeriteTheme;
  text: string;
  faceUp: boolean;
  revealKey: string | number;
  animate?: boolean;
  footer?: ReactNode;
  onClick?: () => void;
  size?: 'md' | 'sm';
}) {
  const reduce = useReducedMotion();
  const play = animate && !reduce;
  const typed = useTypewriter(text, faceUp, play, revealKey);
  const done = typed >= [...text].length;
  const info = THEME_INFO[theme];

  const body = (
    <div className="rv-card-inner" data-flip={play ? 'play' : 'still'} key={play && faceUp ? revealKey : 'still'}>
      <div className="rv-card-face rv-card-back" aria-hidden>
        <span className="rv-card-back-mark">?</span>
        <span className="rv-card-back-label">ROULETTE DE VÉRITÉ</span>
      </div>
      <div className="rv-card-face rv-card-front">
        <span className="rv-card-badge">
          {info.label}
          <small>{info.badge}</small>
        </span>
        <p className="rv-card-question">
          <span className="rv-sr">{text}</span>
          <span aria-hidden>
            {[...text].slice(0, typed).join('')}
            {!done && <span className="rv-caret">▌</span>}
          </span>
        </p>
        {footer && <div className="rv-card-footer">{footer}</div>}
      </div>
    </div>
  );

  const props = {
    className: 'rv-card',
    'data-theme': theme,
    'data-size': size,
    'data-face': faceUp ? 'up' : 'down',
  };

  return onClick ? (
    <button type="button" {...props} onClick={onClick} aria-label={`Carte ${info.label} : ${text}. Retourner à nouveau.`}>
      {body}
    </button>
  ) : (
    <div {...props}>{body}</div>
  );
}

/** Nombre de lettres affichées : 0 pendant le retournement, puis +1 toutes les ~100 ms. */
function useTypewriter(text: string, faceUp: boolean, play: boolean, revealKey: string | number): number {
  const total = [...text].length;
  const [count, setCount] = useState(play ? 0 : total);

  useEffect(() => {
    if (!faceUp) {
      setCount(0);
      return;
    }
    if (!play) {
      setCount(total);
      return;
    }
    setCount(0);
    const delay = typeDelay(text);
    let n = 0;
    let tick: ReturnType<typeof setInterval> | undefined;
    const wait = setTimeout(() => {
      tick = setInterval(() => {
        n += 1;
        setCount(n);
        if (n >= total && tick) clearInterval(tick);
      }, delay);
    }, FLIP_MS);
    return () => {
      clearTimeout(wait);
      if (tick) clearInterval(tick);
    };
  }, [text, total, faceUp, play, revealKey]);

  return faceUp ? count : 0;
}
