import { motion } from 'framer-motion';
import { POWERS } from '../engine/powers';
import { POWER_ICONS } from './powerIcons';
import type { PowerId } from '../engine/types';

interface ConfirmPowerModalProps {
  power: PowerId | null;
  /** Uses left *before* spending this one. */
  usesLeft: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const NEXT_STEP: Record<PowerId, string> = {
  pierce: 'Tu choisiras ensuite la colonne à traverser.',
  destroy: 'Tu choisiras ensuite le jeton adverse à détruire.',
  invert: 'Tu choisiras ensuite la colonne à inverser.',
  block: 'Tu choisiras ensuite la colonne à bloquer.',
  double: "L'effet est immédiat : tu rejoues juste après ton prochain jeton.",
};

export function ConfirmPowerModal({ power, usesLeft, onConfirm, onCancel }: ConfirmPowerModalProps) {
  const def = power ? POWERS[power] : null;
  const Icon = power ? POWER_ICONS[power] : null;
  const remaining = usesLeft - 1;

  if (!def || !Icon) return null;

  /*
   * No exit animation, and so no AnimatePresence. This overlay is full-screen:
   * while it animates out it still swallows clicks, and the click right after
   * confirming a power is precisely the one that aims it — the player picks a
   * column and nothing happens. Closing instantly is the correct trade.
   */
  return (
    <>
        <motion.div
          className="p4-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16 }}
          onClick={onCancel}
        >
          <motion.div
            className="p4-modal p4-confirm"
            style={{ '--p4-power-color': def.color } as React.CSSProperties}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="p4-confirm-title"
          >
            <motion.span
              className="p4-confirm-icon"
              initial={{ rotate: -18, scale: 0.7 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 14 }}
            >
              <Icon size={30} strokeWidth={1.9} />
            </motion.span>

            <h2 id="p4-confirm-title">{def.name}</h2>
            <p className="p4-confirm-desc">{def.long}</p>
            <p className="p4-confirm-next">{NEXT_STEP[def.id]}</p>

            <p className="p4-confirm-cost">
              {remaining > 0
                ? `Il te restera ${remaining} utilisation${remaining > 1 ? 's' : ''}.`
                : 'C’est ta dernière utilisation.'}
            </p>

            <div className="p4-confirm-actions">
              <button type="button" className="btn btn-outline" onClick={onCancel}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary p4-confirm-go" onClick={onConfirm}>
                Activer
              </button>
            </div>
          </motion.div>
        </motion.div>
    </>
  );
}
