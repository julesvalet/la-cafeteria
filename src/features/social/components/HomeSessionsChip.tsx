import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useSocial } from '../useSocial';
import { useFriendSessions } from '../useFriendSessions';

/**
 * Le raccourci vers les tables des amis, posé sur la page d'accueil.
 *
 * Un petit jeton flottant plutôt qu'un panneau : l'accueil est une scène 3D
 * plein écran, qu'il ne faut pas couvrir. Il s'allume quand une table attend.
 */
export function HomeSessionsChip() {
  const { active } = useSocial();
  if (!active) return null;
  return <Chip />;
}

function Chip() {
  const { sessions } = useFriendSessions();
  const waiting = sessions.filter((s) => s.status === 'waiting' && !s.is_mine).length;
  return (
    <Link to="/sessions" className="home-sess-chip" data-live={waiting > 0 || undefined}>
      <Radio size={16} aria-hidden />
      {sessions.length === 0
        ? 'Tables de tes amis'
        : `${sessions.length} table${sessions.length > 1 ? 's' : ''} ouverte${sessions.length > 1 ? 's' : ''}`}
      {waiting > 0 && <span className="home-sess-dot" aria-label={`${waiting} en attente de joueurs`} />}
    </Link>
  );
}
