import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Globe, Lock, X } from 'lucide-react';
import { accountsEnabled } from '../../../lib/supabase';
import { useAuth } from '../../account/useAuth';
import { publishQuestion } from '../api';
import { THEME_INFO } from '../engine/questions';
import { playableThemes, QUESTION_MAX, QUESTION_MIN } from '../engine/rules';
import { THEMES, type VeriteTheme } from '../engine/types';

export interface NewCustom {
  text: string;
  theme: VeriteTheme;
  publicId?: string;
}

/**
 * « Ajouter une question personnalisée ».
 *
 * Privée : elle reste dans cette partie, rien n'est écrit en base. Publique :
 * elle rejoint le pool partagé (compte requis — on doit pouvoir la rattacher
 * à quelqu'un si elle est signalée), et sort aussi dans cette partie.
 */
export function CustomQuestionDialog({
  open,
  onClose,
  gameTheme,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  gameTheme: VeriteTheme;
  onAdd: (q: NewCustom) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { status } = useAuth();
  const canPublish = accountsEnabled && status === 'signed-in';

  const [text, setText] = useState('');
  const [theme, setTheme] = useState<VeriteTheme>(gameTheme);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setText('');
      setTheme(gameTheme);
      setError(null);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, gameTheme]);

  const trimmed = text.replace(/\s+/g, ' ').trim();
  const offTheme = !playableThemes(gameTheme).includes(theme);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (trimmed.length < QUESTION_MIN) {
      setError(`Au moins ${QUESTION_MIN} caractères.`);
      return;
    }
    if (isPublic && canPublish) {
      setBusy(true);
      setError(null);
      try {
        const publicId = await publishQuestion(trimmed, theme);
        onAdd({ text: trimmed, theme, publicId });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'La question n’a pas pu être publiée.');
      } finally {
        setBusy(false);
      }
      return;
    }
    onAdd({ text: trimmed, theme });
    onClose();
  }

  return (
    <dialog
      ref={ref}
      className="rv-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="rv-panel rv-dialog-body" onSubmit={submit}>
        <div className="rv-dialog-head">
          <h2 id={titleId}>Ajouter une question perso</h2>
          <button type="button" className="rv-icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <label className="rv-field">
          <span>Question</span>
          <textarea
            value={text}
            maxLength={QUESTION_MAX}
            rows={3}
            placeholder="Ex : Qui a mangé le dernier yaourt ?"
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            autoFocus
          />
          <small className="rv-count">
            {trimmed.length}/{QUESTION_MAX}
          </small>
        </label>

        <fieldset className="rv-field">
          <legend>Thème</legend>
          <div className="rv-tabs" role="radiogroup" aria-label="Thème de la question">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                className="rv-tab"
                data-theme={t}
                onClick={() => setTheme(t)}
              >
                {THEME_INFO[t].label}
              </button>
            ))}
          </div>
          {offTheme && (
            <small className="rv-note">
              Une partie {THEME_INFO[gameTheme].label} ne tire pas de questions {THEME_INFO[theme].label} : celle-ci ne
              sortira pas ce soir.
            </small>
          )}
        </fieldset>

        <fieldset className="rv-field">
          <legend>Visibilité</legend>
          <div className="rv-choices">
            <label className="rv-choice" data-checked={!isPublic || undefined}>
              <input type="radio" name="rv-visibility" checked={!isPublic} onChange={() => setIsPublic(false)} />
              <Lock size={16} aria-hidden />
              <span>
                <strong>Privée</strong>
                <small>Cette partie uniquement. Rien n’est enregistré.</small>
              </span>
            </label>
            <label className="rv-choice" data-checked={isPublic || undefined} data-disabled={!canPublish || undefined}>
              <input
                type="radio"
                name="rv-visibility"
                checked={isPublic}
                disabled={!canPublish}
                onChange={() => setIsPublic(true)}
              />
              <Globe size={16} aria-hidden />
              <span>
                <strong>Publique</strong>
                <small>
                  {canPublish
                    ? 'Rejoint le pool : d’autres parties pourront la tirer.'
                    : 'Connecte-toi pour partager tes questions avec les autres parties.'}
                </small>
              </span>
            </label>
          </div>
        </fieldset>

        {error && (
          <p className="rv-error" role="alert">
            {error}
          </p>
        )}

        <div className="rv-actions">
          <button type="submit" className="rv-btn" disabled={busy || trimmed.length < QUESTION_MIN}>
            {busy ? 'Envoi…' : 'Ajouter'}
          </button>
          <button type="button" className="rv-btn rv-btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </dialog>
  );
}
