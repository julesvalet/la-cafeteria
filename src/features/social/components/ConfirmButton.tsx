import { useEffect, useState, type ReactNode } from 'react';

/**
 * Un bouton destructeur en deux temps : le premier clic arme, le second agit.
 *
 * Moins lourd qu'une boîte de dialogue pour « retirer un ami », et plus sûr
 * qu'un clic unique à côté du bouton « Défier ». L'armement retombe seul au
 * bout de quelques secondes, pour ne pas laisser un piège actif sur la page.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel,
  icon,
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className="soc-pill"
      data-tone={armed ? 'danger' : undefined}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {icon}
      {armed ? confirmLabel : children}
    </button>
  );
}
