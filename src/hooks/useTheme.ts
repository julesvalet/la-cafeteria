import { useSyncExternalStore } from 'react';

/*
 * Les réglages d'affichage de PLAFEE : le thème, le fond, l'effet cathodique
 * et les animations néon.
 *
 * Des attributs sur <html>, lus par le CSS :
 *   - `data-look` : le thème (arcade | noir | blanc | rgb, voir styles/looks.css) ;
 *   - `data-backdrop` : le décor de l'arcade (grid | void | phosphor) ;
 *   - `data-crt` : les lignes de balayage (on | off) ;
 *   - `data-fx` : les animations néon permanentes (on | calm).
 * `data-theme` suit : `light` pour le thème Blanc, `dark` sinon — les feuilles
 * des jeux s'accrochent encore à cet attribut.
 *
 * Les choix sont appliqués avant le premier rendu par le script d'index.html :
 * sans ça, la page s'afficherait une fraction de seconde avec le mauvais fond.
 */

export type Backdrop = 'grid' | 'void' | 'phosphor';
/** Le thème : « arcade » est l'interface d'origine (« Moderne » dans les réglages). */
export type Look = 'arcade' | 'noir' | 'blanc' | 'rgb';

const KEY = 'userTheme';
const CRT_KEY = 'plafee-crt';
const FX_KEY = 'plafee-fx';
const LOOK_KEY = 'plafee-look';
const RGB_KEY = 'plafee-rgb-ms';

export const BACKDROPS: { id: Backdrop; label: string; hint: string }[] = [
  { id: 'grid', label: 'Grille néon', hint: 'Le noir PLAFEE, une grille verte et les arcs de la bannière.' },
  { id: 'void', label: 'Noir total', hint: 'Noir pur, sans décor. Idéal sur les écrans OLED.' },
  { id: 'phosphor', label: 'Phosphore', hint: 'La lueur verte d’un vieux moniteur cathodique.' },
];

export const LOOKS: { id: Look; label: string; hint: string }[] = [
  { id: 'arcade', label: 'Moderne', hint: 'La salle d’arcade PLAFEE : vert néon sur fond noir.' },
  { id: 'noir', label: 'Noir', hint: 'Une interface sobre, sans néon, sur fond noir.' },
  { id: 'blanc', label: 'Blanc', hint: 'La même, claire, sur fond blanc.' },
  { id: 'rgb', label: 'RGB', hint: 'Le néon change de couleur en continu.' },
];

/** Durée d'un tour complet de l'arc-en-ciel, en millisecondes. */
export const RGB_SPEEDS = [
  { id: 'lent', label: 'Lent', ms: 20000 },
  { id: 'normal', label: 'Normal', ms: 8000 },
  { id: 'rapide', label: 'Rapide', ms: 3000 },
];
export const RGB_MIN_MS = 500;
export const RGB_MAX_MS = 60000;

const isLook = (v: string | null): v is Look => v === 'arcade' || v === 'noir' || v === 'blanc' || v === 'rgb';

interface Display {
  backdrop: Backdrop;
  /** Lignes de balayage à l'écran. */
  crt: boolean;
  /** Pulsations, clignotements et balayages permanents. */
  fx: boolean;
  look: Look;
  /** Thème RGB : durée d'un tour de couleurs. */
  rgbMs: number;
}

function read(): Display {
  const d: Display = { backdrop: 'grid', crt: true, fx: true, look: 'arcade', rgbMs: 8000 };
  try {
    const v = localStorage.getItem(KEY);
    // Les anciens fonds (or, marron, Terre) n'existent plus : grille par défaut.
    if (v === 'grid' || v === 'void' || v === 'phosphor') d.backdrop = v;
    d.crt = localStorage.getItem(CRT_KEY) !== 'off';
    d.fx = localStorage.getItem(FX_KEY) !== 'calm';
    const look = localStorage.getItem(LOOK_KEY);
    if (isLook(look)) d.look = look;
    const ms = Number(localStorage.getItem(RGB_KEY));
    if (ms >= RGB_MIN_MS && ms <= RGB_MAX_MS) d.rgbMs = ms;
  } catch {
    // Stockage indisponible : les réglages par défaut.
  }
  return d;
}

/*
 * Le thème RGB : le néon fait le tour du cercle chromatique. Le jeton
 * `--neon-rgb` est un triplet (rgb(var(--neon-rgb) / a) partout), ce qu'une
 * animation CSS ne sait pas interpoler : une petite boucle le pousse, une
 * quinzaine de fois par seconde — assez pour un fondu, peu pour le processeur.
 */
const rgb = (() => {
  let timer: number | undefined;
  let period = 8000;
  const PROPS = ['--neon', '--neon-rgb', '--neon-soft', '--neon-deep', '--neon-shade', '--rgb-turn'];
  const hsl = (h: number, s: number, l: number) => {
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
    return [f(0), f(8), f(4)];
  };
  const hex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const tick = () => {
    const h = ((performance.now() / period) * 360) % 360;
    const style = document.documentElement.style;
    const main = hsl(h, 1, 0.6);
    style.setProperty('--neon', hex(main));
    style.setProperty('--neon-rgb', main.join(' '));
    style.setProperty('--neon-soft', hex(hsl(h, 1, 0.8)));
    style.setProperty('--neon-deep', hex(hsl(h, 0.65, 0.45)));
    style.setProperty('--neon-shade', hex(hsl(h, 0.65, 0.3)));
    // Le vert d'origine est à ~118° : le logo tourne avec.
    style.setProperty('--rgb-turn', `${Math.round(h - 118)}deg`);
  };
  return {
    set(ms: number | null) {
      window.clearInterval(timer);
      timer = undefined;
      if (ms === null) {
        PROPS.forEach((p) => document.documentElement.style.removeProperty(p));
        return;
      }
      period = ms;
      tick();
      timer = window.setInterval(tick, 66);
    },
  };
})();

let current: Display = read();
const listeners = new Set<() => void>();

function apply(d: Display) {
  const root = document.documentElement;
  root.setAttribute('data-backdrop', d.backdrop);
  root.setAttribute('data-look', d.look);
  root.setAttribute('data-theme', d.look === 'blanc' ? 'light' : 'dark');
  root.setAttribute('data-crt', d.crt ? 'on' : 'off');
  root.setAttribute('data-fx', d.fx ? 'on' : 'calm');
  rgb.set(d.look === 'rgb' ? d.rgbMs : null);
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Le choix vaudra pour cette visite.
  }
}

/**
 * Change un réglage. Fondu enchaîné quand le navigateur sait le faire (View
 * Transitions) et que l'utilisateur n'a pas demandé moins d'animations ;
 * changement sec sinon — jamais de rechargement.
 */
function update(patch: Partial<Display>) {
  const next = { ...current, ...patch };
  const same = (Object.keys(next) as (keyof Display)[]).every((k) => next[k] === current[k]);
  if (same) return;
  // La vitesse du RGB se règle en continu : pas de fondu à chaque cran.
  const instant = next.look === current.look && next.rgbMs !== current.rgbMs;
  current = next;
  save(KEY, next.backdrop);
  save(CRT_KEY, next.crt ? 'on' : 'off');
  save(FX_KEY, next.fx ? 'on' : 'calm');
  save(LOOK_KEY, next.look);
  save(RGB_KEY, String(next.rgbMs));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduce && !instant) doc.startViewTransition(() => apply(next));
  else apply(next);
  listeners.forEach((l) => l());
}

export const setBackdrop = (backdrop: Backdrop) => update({ backdrop });
export const setCrt = (crt: boolean) => update({ crt });
export const setFx = (fx: boolean) => update({ fx });
export const setLook = (look: Look) => update({ look });
export const setRgbMs = (ms: number) => update({ rgbMs: Math.round(Math.min(Math.max(ms, RGB_MIN_MS), RGB_MAX_MS)) });

// Le script d'index.html a posé les attributs ; reste à lancer la boucle RGB.
if (typeof window !== 'undefined' && current.look === 'rgb') rgb.set(current.rgbMs);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDisplay() {
  const display = useSyncExternalStore(subscribe, () => current);
  return { ...display, setBackdrop, setCrt, setFx, setLook, setRgbMs };
}
