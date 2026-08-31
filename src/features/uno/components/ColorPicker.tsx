import { motion } from 'framer-motion';
import { COLORS, COLOR_HEX, COLOR_LABEL } from '../engine/deck';
import type { UnoColor } from '../engine/types';

interface ColorPickerProps {
  open: boolean;
  onPick: (color: UnoColor) => void;
  onCancel: () => void;
}

/** Asked for after a joker is played, before the card actually leaves the hand. */
export function ColorPicker({ open, onPick, onCancel }: ColorPickerProps) {
  if (!open) return null;

  return (
    <motion.div className="p4-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onCancel}>
      <motion.div
        className="p4-modal uno-color-modal"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="uno-color-title"
      >
        <h2 id="uno-color-title">Choisis la couleur</h2>
        <div className="uno-color-grid">
          {COLORS.map((color, i) => (
            <motion.button
              key={color}
              type="button"
              className="uno-color-swatch"
              style={{ background: COLOR_HEX[color] }}
              onClick={() => onPick(color)}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="sr-only">{COLOR_LABEL[color]}</span>
            </motion.button>
          ))}
        </div>
        <button type="button" className="btn btn-outline uno-color-cancel" onClick={onCancel}>
          Annuler
        </button>
      </motion.div>
    </motion.div>
  );
}
