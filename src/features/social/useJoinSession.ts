import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../account/useAuth';
import { gameRoomPath } from './gameRooms';
import type { GameTypeId } from '../account/types';

/**
 * S'asseoir à la table d'un ami.
 *
 * On arrive en invité, sous le pseudo du compte ; c'est l'hôte qui décide :
 * une place en salle d'attente, ou un siège d'observateur si la partie a
 * commencé ou si la table est pleine.
 */
export function useJoinSession() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  return useCallback(
    (game: GameTypeId, code: string) => {
      navigate(gameRoomPath(game, code), { state: { isHost: false, name: profile?.username } });
    },
    [navigate, profile?.username],
  );
}
