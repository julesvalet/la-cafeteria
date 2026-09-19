import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessagesSquare, Radio, Trophy, User, Users } from 'lucide-react';
import { useSocial } from '../useSocial';

/**
 * La navigation de l'espace compte, en tête de chacune de ses pages.
 *
 * Des onglets dans la page plutôt qu'un menu déroulant dans l'en-tête : cinq
 * destinations restent visibles d'un coup d'oeil, et l'en-tête, qui flotte
 * au-dessus des plateaux de jeu, garde sa sobriété.
 */
export function SocialNav() {
  const { incoming, groupInvitations, active } = useSocial();

  const links = [
    { to: '/tableau-de-bord', label: 'Accueil', icon: LayoutDashboard, badge: 0 },
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
    <nav className="soc-nav" aria-label="Espace joueur">
      {links.map(({ to, label, icon: Icon, badge }) => (
        <NavLink key={to} to={to} className="soc-nav-link" end>
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
