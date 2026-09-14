import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outline' | 'solid' | 'ghost' | 'danger';
  block?: boolean;
  /** Affiche un disque qui tourne et désactive le bouton le temps de la requête. */
  loading?: boolean;
  icon?: ReactNode;
}

export function NeonButton({
  variant = 'outline',
  block = false,
  loading = false,
  icon,
  children,
  disabled,
  className,
  ...rest
}: NeonButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={className ? `neon-btn ${className}` : 'neon-btn'}
      data-variant={variant}
      data-block={block || undefined}
      disabled={disabled || loading}
      // Le lecteur d'écran doit savoir que le bouton travaille : sans ça, un
      // envoi lent ne se manifeste que par un changement visuel.
      aria-busy={loading || undefined}
    >
      {loading ? <Loader2 size={17} className="neon-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
