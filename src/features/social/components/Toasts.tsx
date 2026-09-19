import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, Gamepad2, UserPlus, Users, X } from 'lucide-react';
import { describeNotification } from '../notificationText';
import { useOpenNotification } from '../useOpenNotification';
import type { AppNotification } from '../types';

export interface Toast {
  id: number;
  notification: AppNotification;
}

const TOAST_MS = 7000;

function iconFor(kind: AppNotification['kind']) {
  if (kind === 'game_invite') return Gamepad2;
  if (kind.startsWith('friend_')) return UserPlus;
  if (kind.startsWith('group_')) return Users;
  return Bell;
}

/**
 * Le « popup de notification » : ce qui vient d'arriver, en bas de l'écran.
 *
 * Il double la cloche sans la remplacer — la notification reste dans la
 * cloche une fois le toast parti. Une annonce polie plutôt qu'assertive : une
 * demande d'ami n'a pas à couper la parole au lecteur d'écran en pleine partie.
 */
export function Toasts({
  toasts,
  onDismiss,
  onRead,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  onRead: (id: number) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="soc-toasts" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <ToastItem toast={t} onDismiss={onDismiss} onRead={onRead} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
  onRead,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
  onRead: (id: number) => void;
}) {
  const open = useOpenNotification();
  const n = toast.notification;
  const { text, to } = describeNotification(n, n.actor?.username ?? null);
  const Icon = iconFor(n.kind);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className="soc-toast" data-kind={n.kind}>
      <span className="soc-toast-icon" aria-hidden>
        <Icon size={18} />
      </span>
      <p className="soc-toast-text">{text}</p>
      {to && (
        <button
          type="button"
          className="soc-toast-action"
          onClick={() => {
            onRead(n.id);
            onDismiss(toast.id);
            open(n);
          }}
        >
          {n.kind === 'game_invite' ? 'Rejoindre' : 'Voir'}
        </button>
      )}
      <button type="button" className="soc-icon-btn" aria-label="Fermer" onClick={() => onDismiss(toast.id)}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
