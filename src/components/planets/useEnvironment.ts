import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return initial;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Reads the theme off the `data-theme` attribute that `useTheme` writes to
 * `<html>`. Observing instead of calling `useTheme` avoids creating a second,
 * competing source of truth — the toggle in the header stays the only writer.
 */
export function useDocumentTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'),
  );

  useEffect(() => {
    const read = () => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Touch-first devices: no hover intent, so "coming soon" needs a tap instead. */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(hover: none), (pointer: coarse)');
}

export interface Quality {
  /** Sphere subdivisions. */
  segments: number;
  starCount: number;
  antialias: boolean;
  dpr: [number, number];
  /** Octaves of noise on a playable planet's surface. */
  octaves: number;
}

/**
 * One conservative step down on small/low-core devices. The scene is cheap
 * either way, but the fragment shader is the hot path and octaves are the
 * knob that actually costs something.
 */
export function useQuality(): Quality {
  const coarse = useCoarsePointer();
  const small = useMediaQuery('(max-width: 820px)');
  const [weak] = useState(() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    return cores <= 4 || memory <= 4;
  });

  const lite = coarse || small || weak;

  return lite
    ? { segments: 32, starCount: 320, antialias: false, dpr: [1, 1.5], octaves: 4 }
    : { segments: 52, starCount: 900, antialias: true, dpr: [1, 2], octaves: 5 };
}

let webglSupport: boolean | null = null;

export function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webglSupport = Boolean(gl);
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** Aspect ratio of an element, tracked with ResizeObserver. */
export function useAspect(ref: React.RefObject<HTMLElement | null>): number {
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setAspect(width / height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return aspect;
}
