import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../account/useAuth';
import { describeNotification } from './notificationText';
import type { AppNotification } from './types';

/**
 * Suivre une notification jusqu'à sa destination.
 *
 * Une invitation à une partie emmène directement à la table, pseudo du compte
 * déjà renseigné : l'ami invité n'a pas à retaper son nom dans l'écran
 * « Rejoindre la room » qu'un lien partagé lui aurait montré.
 */
export function useOpenNotification() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return useCallback(
    (n: AppNotification) => {
      const { to } = describeNotification(n, n.actor?.username ?? null);
      if (!to) return;
      if (n.kind === 'game_invite' && profile) {
        navigate(to, { state: { isHost: false, name: profile.username } });
      } else {
        navigate(to);
      }
    },
    [navigate, profile],
  );
}
