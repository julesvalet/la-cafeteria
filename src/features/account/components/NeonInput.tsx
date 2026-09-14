import { AlertCircle } from 'lucide-react';
import { useId, type InputHTMLAttributes } from 'react';

interface NeonInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Message d'erreur sous le champ. Sa présence suffit à marquer l'invalidité. */
  error?: string | null;
  hint?: string;
}

export function NeonInput({ label, error, hint, ...rest }: NeonInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="neon-field" data-invalid={error ? 'true' : undefined}>
      <label className="neon-field-label" htmlFor={id}>
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className="neon-input"
        aria-invalid={error ? true : undefined}
        // On ne pointe que vers ce qui existe : un aria-describedby vers un
        // élément absent est ignoré par certains lecteurs d'écran, qui perdent
        // alors aussi l'indication valide qui l'accompagnait.
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
      />
      {hint && !error && (
        <span className="neon-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="neon-error" id={errorId} role="alert">
          <AlertCircle size={14} aria-hidden />
          {error}
        </span>
      )}
    </div>
  );
}
