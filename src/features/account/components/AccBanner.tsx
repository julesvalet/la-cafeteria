import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
} as const;

export function AccBanner({ tone, children }: { tone: keyof typeof ICONS; children: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    // Une erreur doit interrompre le lecteur d'écran ; une confirmation ou une
    // consigne peuvent attendre la fin de la phrase en cours.
    <p className="acc-banner" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
