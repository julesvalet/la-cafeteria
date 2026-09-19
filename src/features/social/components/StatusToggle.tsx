import { useId, useRef } from 'react';
import { Check, ChevronDown, Circle, EyeOff, Moon } from 'lucide-react';
import { useSocial } from '../useSocial';
import type { PresenceStatus } from '../socialContext';
import { STATUS_HINTS, STATUS_LABELS } from '../presence';

const ICONS = { online: Circle, away: Moon, offline: EyeOff } as const;

/** « Statut : En ligne ▾ » — le choix de ce que ses amis voient de soi. */
export function StatusToggle() {
  const { myStatus, setMyStatus } = useSocial();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const Icon = ICONS[myStatus];

  return (
    <>
      <button type="button" className="dock-status" data-status={myStatus} popoverTarget={menuId}>
        <span className="dock-status-label">Statut :</span>
        <Icon size={14} aria-hidden className="dock-status-icon" />
        <strong>{STATUS_LABELS[myStatus]}</strong>
        <ChevronDown size={14} aria-hidden />
      </button>
      <div id={menuId} ref={menuRef} popover="auto" className="dock-status-menu" role="menu" aria-label="Changer de statut">
        {(Object.keys(STATUS_LABELS) as PresenceStatus[]).map((s) => {
          const ItemIcon = ICONS[s];
          return (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={myStatus === s}
              data-status={s}
              onClick={() => {
                setMyStatus(s);
                menuRef.current?.hidePopover();
              }}
            >
              <ItemIcon size={15} aria-hidden className="dock-status-icon" />
              <span>
                <strong>{STATUS_LABELS[s]}</strong>
                <small>{STATUS_HINTS[s]}</small>
              </span>
              {myStatus === s && <Check size={15} aria-hidden />}
            </button>
          );
        })}
      </div>
    </>
  );
}
