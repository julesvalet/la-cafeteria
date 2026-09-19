import { Lock, Globe } from 'lucide-react';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../account/useAuth';

export type Visibility = 'public' | 'private';

/**
 * Public ou privé, au moment de créer une table.
 *
 * « Public » veut dire visible de ses amis, pas du monde entier : la liste des
 * sessions ne montre que les tables d'amis. Sans compte, il n'y a pas d'amis à
 * qui montrer quoi que ce soit — le choix n'est pas proposé.
 */
export function SessionVisibility({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const { status } = useAuth();
  if (!accountsEnabled || status !== 'signed-in') return null;

  return (
    <fieldset className="sess-visibility">
      <legend>Qui voit ta table ?</legend>
      <div className="sess-visibility-options">
        <label data-checked={value === 'public' || undefined}>
          <input type="radio" name="sess-visibility" checked={value === 'public'} onChange={() => onChange('public')} />
          <Globe size={17} aria-hidden />
          <span>
            <strong>Publique</strong>
            <small>Tes amis la voient et peuvent la rejoindre.</small>
          </span>
        </label>
        <label data-checked={value === 'private' || undefined}>
          <input type="radio" name="sess-visibility" checked={value === 'private'} onChange={() => onChange('private')} />
          <Lock size={17} aria-hidden />
          <span>
            <strong>Privée</strong>
            <small>Sur invitation ou avec le code seulement.</small>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
