import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AccountMenu } from '../features/account/components/AccountMenu';
import { NotificationBell } from '../features/social/components/NotificationBell';
import { SocialNav } from '../features/social/components/SocialNav';
import { accountsEnabled } from '../lib/supabase';
import { useAuth } from '../features/account/useAuth';

const BRAND = `${import.meta.env.BASE_URL}brand/`;

export function Header() {
  const { status } = useAuth();
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="site-brand" aria-label="PLAFEE, accueil">
          <img src={`${BRAND}plafee-mark.svg`} alt="" className="site-brand-mark" width={23} height={40} />
          <img src={`${BRAND}plafee-wordmark.svg`} alt="" className="site-brand-word" width={116} height={20} />
        </Link>
        {/* Grand écran : les onglets montent dans l'en-tête (voir arcade.css). */}
        <SocialNav variant="header" />
        <div className="site-header-actions">
          {/* Les classements sont publics : le raccourci reste visible sans compte. */}
          {accountsEnabled && (
            <Link
              to="/classements"
              // Connecté, les classements restent à un onglet de là : au
              // téléphone, le raccourci cède sa place au bouton d'amis.
              className={`account-chip account-chip-icon${status === 'signed-in' ? ' hdr-hide-mobile' : ''}`}
              aria-label="Classements"
              title="Classements"
            >
              <Trophy size={17} aria-hidden />
            </Link>
          )}
          <NotificationBell />
          <AccountMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
