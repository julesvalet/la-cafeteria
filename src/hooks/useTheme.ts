import { useSyncExternalStore } from 'react';

/*
 * Le fond du site : or, marron casino, ou la Terre.
 *
 * Deux attributs sur <html>, pour deux usages :
 *   - `data-backdrop` choisit le fond et la palette (gold | dark | earth) ;
 *   - `data-theme` reste `light` ou `dark`, parce que tous les jeux et les
 *     pages existantes accrochent déjà leurs couleurs à ce couple. Le fond or
 *     est un thème clair, les deux autres sont sombres.
 *
 * Le choix est appliqué avant le premier rendu par le script d'index.html :
 * sans ça, la page s'afficherait une fraction de seconde dans le mauvais fond.
 */

export type Backdrop = 'gold' | 'dark' | 'earth';
export type Theme = 'light' | 'dark';

const KEY = 'userTheme';
/** L'ancien réglage clair / sombre, repris une fois pour ne pas perdre le choix déjà fait. */
const LEGACY_KEY = 'cafeteria-theme';

export const BACKDROPS: { id: Backdrop; label: string; hint: string }[] = [
  { id: 'gold', label: 'Or luxe', hint: 'Beige et or, lumineux.' },
  { id: 'dark', label: 'Marron casino', hint: 'Sombre et feutré, comme une salle de jeu.' },
  { id: 'earth', label: 'Terre', hint: 'La Terre vue de l’espace, voilée pour rester lisible.' },
];

function read(): Backdrop {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'gold' || v === 'dark' || v === 'earth') return v;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'light') return 'gold';
    if (legacy === 'dark') return 'dark';
  } catch {
    // Stockage indisponible : le fond par défaut.
  }
  return 'earth';
}

export const themeOf = (b: Backdrop): Theme => (b === 'gold' ? 'light' : 'dark');

let current: Backdrop = read();
const listeners = new Set<() => void>();

function apply(b: Backdrop) {
  const root = document.documentElement;
  root.setAttribute('data-backdrop', b);
  root.setAttribute('data-theme', themeOf(b));
}

/**
 * Change de fond. Fondu enchaîné quand le navigateur sait le faire (View
 * Transitions) et que l'utilisateur n'a pas demandé moins d'animations ;
 * changement sec sinon — jamais de rechargement.
 */
export function setBackdrop(b: Backdrop) {
  if (b === current) return;
  current = b;
  try {
    localStorage.setItem(KEY, b);
  } catch {
    // Le choix vaudra pour cette visite.
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => apply(b));
  else apply(b);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBackdrop() {
  const backdrop = useSyncExternalStore(subscribe, () => current);
  return { backdrop, theme: themeOf(backdrop), setBackdrop };
}

/** Compatibilité : ce que les composants existants lisaient. */
export function useTheme() {
  const { theme } = useBackdrop();
  return { theme };
}
