import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useSocial } from '../useSocial';

// Le panneau n'intéresse que celui qui l'ouvre : son contenu (et la création
// de session qu'il embarque) ne pèse pas sur le chargement de chaque page.
const DockContent = lazy(() => import('./FriendsDockContent').then((m) => ({ default: m.DockContent })));

const MOBILE = '(max-width: 640px)';

function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(MOBILE);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(MOBILE).matches,
  );
}

/**
 * Le panneau d'amis, à la Fortnite : une colonne compacte à droite (un tiroir
 * par le bas au téléphone), ouverte depuis l'en-tête, qui reste là pendant
 * qu'on navigue ou qu'on joue.
 *
 * Il n'est pas modal : on continue de jouer, panneau ouvert. Échap le ferme,
 * et le focus revient au bouton qui l'a ouvert.
 */
export function FriendsDock() {
  const { active, panelOpen, setPanelOpen } = useSocial();
  const reduce = useReducedMotion();
  const mobile = useIsMobile();

  // Sur grand écran, la page se décale pour laisser la place au panneau
  // plutôt que de passer dessous (voir casino.css).
  useEffect(() => {
    const root = document.documentElement;
    if (panelOpen && active) root.dataset.dock = 'open';
    else delete root.dataset.dock;
    return () => {
      delete root.dataset.dock;
    };
  }, [panelOpen, active]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Un menu ouvert dans le panneau (statut) se ferme d'abord, seul.
      if (e.key !== 'Escape' || document.querySelector('.dock :popover-open')) return;
      setPanelOpen(false);
      document.querySelector<HTMLElement>('.dock-toggle')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, setPanelOpen]);

  if (!active) return null;

  const offscreen = mobile ? { y: '100%' } : { x: '100%' };

  return (
    <AnimatePresence>
      {panelOpen && (
        <motion.aside
          key="dock"
          className="dock"
          aria-label="Amis"
          initial={reduce ? { opacity: 0 } : offscreen}
          animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : { ...offscreen, transition: { duration: 0.2, ease: 'easeIn' } }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Suspense fallback={<p className="dock-empty">Chargement…</p>}>
            <DockContent onClose={() => setPanelOpen(false)} />
          </Suspense>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

