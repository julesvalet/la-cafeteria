import { useState } from 'react';
import { Check, Settings } from 'lucide-react';
import { BACKDROPS, useDisplay } from '../hooks/useTheme';
import { Modal } from '../features/social/components/Modal';

/**
 * Les réglages d'affichage, derrière l'engrenage de l'en-tête : le fond de la
 * salle, l'effet cathodique et les animations néon.
 *
 * Tout s'applique au clic (on voit le résultat derrière la fenêtre) ; « OK »
 * referme. Pas de rechargement : seuls les attributs de <html> changent.
 */
export function ThemeToggle() {
  const { backdrop, crt, fx, setBackdrop, setCrt, setFx } = useDisplay();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setOpen(true)}
        aria-label="Réglages d'affichage"
        title="Réglages d'affichage"
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Affichage">
        <p className="thm-intro">Le décor de la salle. Il s'applique à tout le site, jeux compris.</p>
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
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </span>
              <strong>{b.label}</strong>
              <small>{b.hint}</small>
            </button>
          ))}
        </div>

        <div className="thm-switches">
          <Switch label="Effet cathodique" hint="Lignes de balayage et léger vignettage, comme sur un vieil écran." checked={crt} onChange={setCrt} />
          <Switch label="Animations néon" hint="Pulsations, clignotements et balayage permanents." checked={fx} onChange={setFx} />
        </div>

        <div className="thm-actions">
          <button type="button" className="neon-btn" data-variant="solid" onClick={() => setOpen(false)}>
            OK
          </button>
        </div>
      </Modal>
    </>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="thm-switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="thm-switch-track" aria-hidden>
        <span className="thm-switch-thumb" />
      </span>
      <span className="thm-switch-text">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );
}
