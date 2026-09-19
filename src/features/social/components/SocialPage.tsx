import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { accountsEnabled } from '../../../lib/supabase';
import { useAuth } from '../../account/useAuth';
import { AccBanner } from '../../account/components/AccBanner';
import { SocialNav } from './SocialNav';

/**
 * Le gabarit des pages de l'espace joueur : garde d'authentification,
 * navigation, titre.
 *
 * `public` laisse passer les visiteurs anonymes — les classements et les
 * fiches de joueurs se consultent sans compte.
 */
export function SocialPage({
  title,
  subtitle,
  children,
  public: isPublic = false,
  wide = false,
}: {
  /** Absent quand la page porte son propre titre (un groupe, une fiche de joueur). */
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  public?: boolean;
  wide?: boolean;
}) {
  const { status } = useAuth();
  const location = useLocation();

  if (!accountsEnabled) {
    return (
      <div className="container acc-scope">
        <div className="acc-page">
          <AccBanner tone="info">
            Les comptes ne sont pas configurés sur cette instance. Les jeux restent accessibles sans connexion.
          </AccBanner>
        </div>
      </div>
    );
  }

  if (!isPublic && status === 'signed-out') {
    return <Navigate to="/connexion" state={{ from: location.pathname }} replace />;
  }

  return (
    <div className="container acc-scope">
      <div className="acc-page acc-page-wide soc-page" data-wide={wide || undefined}>
        <SocialNav />
        {title && (
          <header className="soc-page-head">
            <h1 className="acc-title">{title}</h1>
            {subtitle && <p className="acc-subtitle">{subtitle}</p>}
          </header>
        )}
        {!isPublic && status === 'loading' ? (
          <p role="status" className="neon-hint">
            Chargement…
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
