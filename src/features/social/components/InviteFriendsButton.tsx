import { useId, useState } from 'react';
import { Check, Send, UserPlus } from 'lucide-react';
import type { GameTypeId } from '../../account/types';
import { useSocial } from '../useSocial';
import { inviteToGame } from '../api';
import { UserAvatar } from './UserAvatar';

/**
 * « Inviter un ami » dans la barre d'une room.
 *
 * Ne s'affiche que pour un joueur connecté qui a des amis : sans compte, le
 * bouton « Copier le code » voisin reste la seule façon d'inviter, exactement
 * comme avant les comptes.
 *
 * `className` reprend le style des boutons voisins de chaque jeu, pour que ce
 * bouton ait l'air d'avoir toujours été là.
 */
export function InviteFriendsButton({
  game,
  code,
  className,
}: {
  game: GameTypeId;
  code: string;
  className: string;
}) {
  const { active, friends, online, presenceLive } = useSocial();
  const panelId = useId();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (!active || friends.length === 0) return null;

  const sorted = [...friends].sort((a, b) => Number(online.has(b.user_id)) - Number(online.has(a.user_id)));

  async function invite(userId: string) {
    setError(null);
    try {
      await inviteToGame(userId, game, code);
      setSent((s) => new Set(s).add(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation impossible.');
    }
  }

  return (
    <>
      <button type="button" className={className} popoverTarget={panelId}>
        <UserPlus size={14} aria-hidden /> Inviter un ami
      </button>
      <div id={panelId} popover="auto" className="soc-menu acc-scope">
        <p className="soc-menu-title">Inviter à cette table</p>
        <ul>
          {sorted.map((f) => {
            const done = sent.has(f.user_id);
            return (
              <li key={f.user_id}>
                <button type="button" disabled={done} onClick={() => void invite(f.user_id)}>
                  <UserAvatar username={f.username} src={f.avatar} size={26} online={presenceLive ? online.has(f.user_id) : undefined} />
                  <span className="soc-menu-name">{f.username}</span>
                  {done ? (
                    <span className="soc-meta">
                      <Check size={14} aria-hidden /> invité
                    </span>
                  ) : (
                    <Send size={14} aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {error && (
          <p className="neon-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
