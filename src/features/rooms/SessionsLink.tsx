import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../account/useAuth';

/** « Voir les sessions » dans un salon : les tables d'amis ne concernent qu'un joueur connecté. */
export function SessionsLink({ className }: { className?: string }) {
  const { status } = useAuth();
  if (!accountsEnabled || status !== 'signed-in') return null;
  return (
    <Link to="/sessions" className={className ? `sess-link ${className}` : 'sess-link'}>
      <Radio size={15} aria-hidden /> Voir les tables de tes amis
    </Link>
  );
}
