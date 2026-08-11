import { motion } from 'framer-motion';
import { POWERS, POWER_ORDER } from '../engine/powers';
import { POWER_ICONS } from './powerIcons';
import type { P4Player, PowerId } from '../engine/types';

interface PowerBarProps {
  player: P4Player;
  enabled: boolean;
  /** Power currently armed and waiting for a target. */
  armed: PowerId | null;
  pendingDouble: boolean;
  onPick: (power: PowerId) => void;
  onCancel: () => void;
}

export function PowerBar({ player, enabled, armed, pendingDouble, onPick, onCancel }: PowerBarProps) {
  return (
    <div className="p4-powers">
      <div className="p4-powers-head">
        <h3>Pouvoirs</h3>
        {armed && (
          <button type="button" className="p4-powers-cancel" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>

      <div className="p4-power-list">
        {POWER_ORDER.map((id) => {
          const def = POWERS[id];
          const Icon = POWER_ICONS[id];
          const left = player.powers[id];
          const spent = left <= 0;
          const isArmed = armed === id;
          const banked = id === 'double' && pendingDouble;
          const disabled = !enabled || spent || banked;

          return (
            <div key={id} className="p4-power-slot">
              <motion.button
                type="button"
                className={[
                  'p4-power',
                  isArmed ? 'is-armed' : '',
                  spent ? 'is-spent' : '',
                  banked ? 'is-banked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--p4-power-color': def.color } as React.CSSProperties}
                disabled={disabled}
                onClick={() => onPick(id)}
                whileTap={disabled ? undefined : { scale: 0.94 }}
                aria-describedby={`p4-tip-${id}`}
              >
                <span className="p4-power-icon">
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                <span className="p4-power-name">{def.name}</span>
                <span className="p4-power-uses" aria-label={`${left} utilisation${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`}>
                  {Array.from({ length: def.uses }, (_, i) => (
                    <span key={i} className={`p4-pip${i < left ? ' is-left' : ''}`} />
                  ))}
                </span>
              </motion.button>

              <span role="tooltip" id={`p4-tip-${id}`} className="p4-power-tip">
                <strong>{def.name}</strong>
                {def.short}
                {banked && <em>Déjà activé pour ce tour.</em>}
                {spent && !banked && <em>Plus aucune utilisation.</em>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
