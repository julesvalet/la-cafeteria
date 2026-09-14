import { Link } from 'react-router-dom';
import { LogIn, User } from 'lucide-react';
import { accountsEnabled } from '../../../lib/supabase';
import { useAuth } from '../useAuth';

/**
 * Le contrôle de compte de l'en-tête.
 *
 * Volontairement réduit à un raccourci vers le profil : ouvrir un menu
 * déroulant ici ajouterait un piège au clavier et une couche de z-index
 * au-dessus d'une scène 3D et de quatre plateaux de jeu, pour deux entrées que
 * la page Compte porte déjà.
 */
export function AccountMenu() {
  const { status, profile } = useAuth();

  // Sans configuration, aucun compte n'est possible : mieux vaut ne rien
  // afficher qu'un bouton qui mène à un formulaire inerte.
  if (!accountsEnabled) return null;

  if (status === 'loading') {
    // Une empreinte de la bonne taille, pour que l'en-tête ne sursaute pas
    // quand la session finit d'être relue.
    return <span className="account-chip" data-placeholder="true" aria-hidden />;
  }

  if (status === 'signed-out') {
    return (
      <Link to="/connexion" className="account-chip account-chip-signin">
        <LogIn size={16} aria-hidden />
        <span className="account-chip-label">Se connecter</span>
      </Link>
    );
  }

  const initial = profile?.username?.charAt(0).toUpperCase();

  return (
    <Link
      to="/compte"
      className="account-chip account-chip-avatar"
      title={profile?.username ?? 'Mon compte'}
      aria-label={profile ? `Compte de ${profile.username}` : 'Mon compte'}
    >
      {initial ?? <User size={17} aria-hidden />}
    </Link>
  );
}
