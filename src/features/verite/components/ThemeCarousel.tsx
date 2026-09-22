import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { QuestionCard } from './QuestionCard';
import { SAMPLE_QUESTIONS, THEME_INFO } from '../engine/questions';
import { THEMES, type VeriteTheme } from '../engine/types';

const AUTO_MS = 6500;
const SWIPE_PX = 40;

/**
 * Le carrousel de l'accueil : une carte d'exemple par thème.
 *
 * Défile tout seul (pause au survol, au focus et après une interaction), se
 * pilote aux flèches, aux points ou au doigt. Chaque carte qui arrive se
 * retourne ; toucher la carte la retourne à nouveau, avec un autre exemple.
 */
export function ThemeCarousel({ focus }: { focus: VeriteTheme }) {
  const [index, setIndex] = useState(() => THEMES.indexOf(focus));
  const [reveal, setReveal] = useState(0);
  const [sample, setSample] = useState(0);
  const [paused, setPaused] = useState(false);
  const idleUntil = useRef(0);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  // Un glissement se termine souvent par un « clic » sur la carte : on l'ignore.
  const swiped = useRef(false);

  const go = useCallback((next: number, byUser = true) => {
    setIndex((next + THEMES.length) % THEMES.length);
    setReveal((r) => r + 1);
    if (byUser) idleUntil.current = Date.now() + AUTO_MS * 2;
  }, []);

  // L'onglet choisi dans le formulaire amène sa carte.
  useEffect(() => {
    go(THEMES.indexOf(focus));
  }, [focus, go]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      if (Date.now() < idleUntil.current) return;
      setSample((s) => s + 1);
      go(index + 1, false);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [paused, index, go]);

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      swiped.current = true;
      setTimeout(() => (swiped.current = false), 0);
      go(index + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <section
      className="rv-carousel"
      aria-roledescription="carrousel"
      aria-label="Exemples de questions par thème"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="rv-carousel-stage">
        <button type="button" className="rv-carousel-nav" onClick={() => go(index - 1)} aria-label="Thème précédent">
          <ChevronLeft size={22} />
        </button>

        <div
          className="rv-carousel-viewport"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
        >
          <div className="rv-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {THEMES.map((t, i) => {
              const samples = SAMPLE_QUESTIONS[t];
              const active = i === index;
              return (
                <div
                  key={t}
                  className="rv-carousel-slide"
                  role="group"
                  aria-roledescription="diapositive"
                  aria-label={`${i + 1} sur ${THEMES.length} : ${THEME_INFO[t].label}`}
                  aria-hidden={!active}
                  inert={!active}
                >
                  <QuestionCard
                    theme={t}
                    text={samples[sample % samples.length]}
                    faceUp={active}
                    revealKey={`${t}-${reveal}`}
                    onClick={() => {
                      if (swiped.current) return;
                      setSample((s) => s + 1);
                      setReveal((r) => r + 1);
                      idleUntil.current = Date.now() + AUTO_MS * 2;
                    }}
                    footer={<span className="rv-card-hint">{THEME_INFO[t].tagline}</span>}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <button type="button" className="rv-carousel-nav" onClick={() => go(index + 1)} aria-label="Thème suivant">
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="rv-carousel-dots">
        {THEMES.map((t, i) => (
          <button
            key={t}
            type="button"
            className="rv-carousel-dot"
            data-theme={t}
            aria-current={i === index || undefined}
            aria-label={`Voir la carte ${THEME_INFO[t].label}`}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  );
}
