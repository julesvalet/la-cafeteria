import { useSyncExternalStore } from 'react';

/*
 * Les réglages d'affichage de PLAFEE : le fond, l'effet cathodique et les
 * animations néon.
 *
 * Trois attributs sur <html>, lus par le CSS :
 *   - `data-backdrop` : le décor (grid | void | phosphor) ;
 *   - `data-crt` : les lignes de balayage (on | off) ;
 *   - `data-fx` : les animations néon permanentes (on | calm).
 * `data-theme` reste à `dark` : PLAFEE est une salle d'arcade, toujours dans
 * le noir, et les feuilles des jeux s'accrochent encore à cet attribut.
 *
 * Les choix sont appliqués avant le premier rendu par le script d'index.html :
 * sans ça, la page s'afficherait une fraction de seconde avec le mauvais fond.
 */

export type Backdrop = 'grid' | 'void' | 'phosphor';

const KEY = 'userTheme';
const CRT_KEY = 'plafee-crt';
const FX_KEY = 'plafee-fx';

export const BACKDROPS: { id: Backdrop; label: string; hint: string }[] = [
  { id: 'grid', label: 'Grille néon', hint: 'Le noir PLAFEE, une grille verte et les arcs de la bannière.' },
  { id: 'void', label: 'Noir total', hint: 'Noir pur, sans décor. Idéal sur les écrans OLED.' },
  { id: 'phosphor', label: 'Phosphore', hint: 'La lueur verte d’un vieux moniteur cathodique.' },
];

interface Display {
  backdrop: Backdrop;
  /** Lignes de balayage à l'écran. */
  crt: boolean;
  /** Pulsations, clignotements et balayages permanents. */
  fx: boolean;
}

function read(): Display {
  const d: Display = { backdrop: 'grid', crt: true, fx: true };
  try {
    const v = localStorage.getItem(KEY);
    // Les anciens fonds (or, marron, Terre) n'existent plus : grille par défaut.
    if (v === 'grid' || v === 'void' || v === 'phosphor') d.backdrop = v;
    d.crt = localStorage.getItem(CRT_KEY) !== 'off';
    d.fx = localStorage.getItem(FX_KEY) !== 'calm';
  } catch {
    // Stockage indisponible : les réglages par défaut.
  }
  return d;
}

let current: Display = read();
const listeners = new Set<() => void>();

function apply(d: Display) {
  const root = document.documentElement;
  root.setAttribute('data-backdrop', d.backdrop);
  root.setAttribute('data-theme', 'dark');
  root.setAttribute('data-crt', d.crt ? 'on' : 'off');
  root.setAttribute('data-fx', d.fx ? 'on' : 'calm');
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
  if (next.backdrop === current.backdrop && next.crt === current.crt && next.fx === current.fx) return;
  current = next;
  save(KEY, next.backdrop);
  save(CRT_KEY, next.crt ? 'on' : 'off');
  save(FX_KEY, next.fx ? 'on' : 'calm');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => apply(next));
  else apply(next);
  listeners.forEach((l) => l());
}

export const setBackdrop = (backdrop: Backdrop) => update({ backdrop });
export const setCrt = (crt: boolean) => update({ crt });
export const setFx = (fx: boolean) => update({ fx });

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDisplay() {
  const display = useSyncExternalStore(subscribe, () => current);
  return { ...display, setBackdrop, setCrt, setFx };
}
