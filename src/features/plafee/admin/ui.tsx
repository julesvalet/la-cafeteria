import { useEffect, useId, useState, type ReactNode } from 'react';
import { ImageUp, Loader2, X } from 'lucide-react';
import { uploadAsset } from './adminApi';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="adm-field">
      <span className="adm-label">{label}</span>
      {children}
      {hint && <small className="neon-hint">{hint}</small>}
    </label>
  );
}

export function Flash({ msg }: { msg: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className="adm-flash" data-tone={msg.tone} role={msg.tone === 'error' ? 'alert' : 'status'}>
      {msg.text}
    </p>
  );
}

/** Un bouton destructeur : un premier clic arme, le second confirme. */
export function ConfirmAction({
  label,
  confirm = 'Confirmer',
  onConfirm,
  variant = 'danger',
  disabled,
}: {
  label: ReactNode;
  confirm?: string;
  onConfirm: () => void | Promise<void>;
  variant?: 'danger' | 'ghost';
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className="neon-btn adm-btn"
      data-variant={armed ? 'danger' : variant}
      disabled={disabled || busy}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
    >
      {busy ? <Loader2 size={14} className="neon-spin" aria-hidden /> : null}
      {armed ? confirm : label}
    </button>
  );
}

/** Choisir une image : envoi immédiat vers le stockage, aperçu, ou effacer. */
export function ImagePicker({
  value,
  onChange,
  folder,
  onError,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: 'trophies' | 'badges' | 'events' | 'shop';
  onError: (message: string) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  return (
    <div className="adm-image">
      {value ? <img src={value} alt="" className="adm-image-preview" /> : <span className="adm-image-empty">Aucune image</span>}
      <label htmlFor={id} className="neon-btn adm-btn" data-variant="ghost">
        {busy ? <Loader2 size={14} className="neon-spin" aria-hidden /> : <ImageUp size={14} aria-hidden />}
        {value ? 'Changer' : 'Envoyer une image'}
      </label>
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="adm-file"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            onChange(await uploadAsset(file, folder));
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Envoi impossible.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {value && (
        <button type="button" className="adm-icon-btn" onClick={() => onChange(null)} aria-label="Retirer l'image">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
