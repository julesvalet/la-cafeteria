import { NavLink } from 'react-router-dom';
import { House, MessagesSquare, Radio, Trophy, User, Users } from 'lucide-react';
import { useSocial } from '../useSocial';

/**
 * La navigation de l'espace compte, en tête de chacune de ses pages.
 *
 * Des onglets dans la page plutôt qu'un menu déroulant dans l'en-tête : cinq
 * destinations restent visibles d'un coup d'oeil, et l'en-tête, qui flotte
 * au-dessus des plateaux de jeu, garde sa sobriété.
 */
export function SocialNav({ variant = 'page' }: { variant?: 'page' | 'header' }) {
  const { incoming, groupInvitations, active } = useSocial();

  const links = [
    { to: '/', label: 'Accueil', icon: House, badge: 0 },
    { to: '/amis', label: 'Amis', icon: Users, badge: incoming.length },
    { to: '/groupes', label: 'Groupes', icon: MessagesSquare, badge: groupInvitations.length },
    { to: '/sessions', label: 'Sessions', icon: Radio, badge: 0 },
    { to: '/classements', label: 'Classements', icon: Trophy, badge: 0 },
    { to: '/compte', label: 'Profil', icon: User, badge: 0 },
  ];

  // Les classements sont publics : un visiteur anonyme y arrive sans le reste
  // de l'espace compte, qu'il ne pourrait pas ouvrir.
  if (!active) return null;

  return (
    <nav className="soc-nav" data-variant={variant} aria-label={variant === 'header' ? 'Navigation principale' : 'Espace joueur'}>
      {links.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          className="soc-nav-link"
          end
          // Sur téléphone, les libellés se cachent : le nom du lien reste là.
          aria-label={badge > 0 ? `${label} (${badge} en attente)` : label}
          title={label}
        >
          <Icon size={16} aria-hidden />
          <span className="soc-nav-label">{label}</span>
          {badge > 0 && (
            <span className="soc-badge" aria-label={`${badge} en attente`}>
              {badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
