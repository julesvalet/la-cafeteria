import { useState } from 'react';
import { Check, Settings } from 'lucide-react';
import { BACKDROPS, useBackdrop } from '../hooks/useTheme';
import { Modal } from '../features/social/components/Modal';

/**
 * Le choix du fond, derrière l'engrenage de l'en-tête.
 *
 * Un clic sur une vignette applique le fond tout de suite (on voit le résultat
 * derrière la fenêtre) ; « Appliquer » referme. Pas de rechargement : les deux
 * attributs de <html> changent, et les couleurs suivent.
 */
export function ThemeToggle() {
  const { backdrop, setBackdrop } = useBackdrop();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setOpen(true)}
        aria-label="Thème du site"
        title="Thème du site"
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Thème du site">
        <p className="thm-intro">Choisis ton fond. Il s'applique à tout le site, jeux compris.</p>
        <div className="thm-options" role="radiogroup" aria-label="Fond du site">
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={backdrop === b.id}
              className="thm-option"
              onClick={() => setBackdrop(b.id)}
            >
              <span className="thm-preview" data-preview={b.id} aria-hidden>
                {backdrop === b.id && (
                  <span className="thm-check">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
              </span>
              <strong>{b.label}</strong>
              <small>{b.hint}</small>
            </button>
          ))}
        </div>
        <div className="thm-actions">
          <button type="button" className="neon-btn" data-variant="solid" onClick={() => setOpen(false)}>
            Appliquer
          </button>
        </div>
      </Modal>
    </>
  );
}
