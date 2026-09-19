import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Une boîte de dialogue sur l'élément <dialog> natif.
 *
 * Le navigateur fournit ce qu'on réécrit sinon à la main, et souvent mal : le
 * piège du focus, la fermeture à Échap, le retour du focus sur le bouton
 * d'ouverture, et la couche supérieure — qui passe au-dessus de l'en-tête
 * collant sans guerre de z-index.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  variant,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** « casino » : le tapis sombre de Flip 7, pour ce qui touche aux tables de jeu. */
  variant?: 'casino';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="soc-modal acc-scope"
      data-variant={variant}
      aria-labelledby={titleId}
      // Échap déclenche « cancel » : on laisse le parent décider, pour que
      // l'état React et le dialogue ne divergent pas.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Un clic sur le voile (hors du contenu) ferme, comme les modales de règles.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="soc-modal-inner">
        <header className="soc-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="soc-icon-btn" aria-label="Fermer" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </header>
        {open && children}
      </div>
    </dialog>
  );
}
