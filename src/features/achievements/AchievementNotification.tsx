import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useNotificationEvents } from '../social/useSocial';
import { achievementIcon } from './icons';
import type { Tier } from './api';

interface Shot {
  key: number;
  id: string;
  title: string;
  icon: string;
  tier: Tier;
}

const SHOW_MS = 5000;

/**
 * Une petite fanfare : un arpège majeur montant, synthétisé à la volée. Aucun
 * fichier son à charger pour quatre notes. Muet si le navigateur refuse le
 * son (pas encore d'interaction avec la page) : le trophée s'affiche quand même.
 */
function playJingle() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (i === 3 ? 0.7 : 0.25));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    });
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Pas de son : tant pis, l'animation suffit.
  }
}

/**
 * « Trophée débloqué » : le pop-up doré, en bas à droite.
 *
 * Il écoute les notifications `achievement` que la base émet au déblocage —
 * qu'il vienne d'une partie, d'un groupe rejoint ou du classement de la
 * semaine — et n'a donc besoin d'aucun branchement dans les jeux.
 */
export function AchievementNotification() {
  const [queue, setQueue] = useState<Shot[]>([]);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const shot = queue[0];

  useNotificationEvents((event) => {
    if (event.kind !== 'achievement') return;
    const p = event.payload as unknown as { achievement_id?: string; title?: string; icon?: string; tier?: Tier };
    if (!p.title) return;
    setQueue((q) => [...q, { key: event.id, id: p.achievement_id ?? '', title: p.title!, icon: p.icon ?? 'Trophy', tier: p.tier ?? 'bronze' }]);
  });

  const next = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    if (!shot) return;
    playJingle();
    const timer = window.setTimeout(next, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [shot, next]);

  const Icon = shot ? achievementIcon(shot.icon) : null;

  return (
    <div className="ach-toast-zone" aria-live="polite">
      <AnimatePresence>
        {shot && Icon && (
          <motion.div
            key={shot.key}
            className="ach-toast"
            data-tier={shot.tier}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            <button
              type="button"
              className="ach-toast-body"
              onClick={() => {
                next();
                navigate('/compte#trophees');
              }}
            >
              <motion.span
                className="ach-toast-icon"
                aria-hidden
                initial={reduce ? false : { rotate: -200, scale: 0.4 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.1 }}
              >
                <Icon size={26} />
              </motion.span>
              <span className="ach-toast-text">
                <small>Trophée débloqué</small>
                <strong>{shot.title}</strong>
              </span>
            </button>
            <button type="button" className="ach-toast-close" aria-label="Fermer" onClick={next}>
              <X size={15} aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
