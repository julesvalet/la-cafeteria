import { useCallback } from 'react';
import * as api from './api';
import { useSocial } from './useSocial';

/**
 * Les amis du joueur et ce qu'on peut en faire.
 *
 * Chaque action relit la liste après coup plutôt que de la corriger à la main :
 * la base décide (deux demandes croisées deviennent une amitié, un blocage
 * efface la demande en attente…) et la liste affichée doit refléter sa
 * décision, pas une supposition du client.
 */
export function useFriends() {
  const { friends, incoming, outgoing, online, presenceLive, refreshFriends } = useSocial();

  const after = useCallback(
    async <T,>(action: Promise<T>): Promise<T> => {
      try {
        return await action;
      } finally {
        await refreshFriends().catch(() => {});
      }
    },
    [refreshFriends],
  );

  return {
    friends,
    incoming,
    outgoing,
    online,
    presenceLive,
    addFriend: useCallback((username: string) => after(api.sendFriendRequest(username)), [after]),
    acceptRequest: useCallback((id: string) => after(api.respondFriendRequest(id, true)), [after]),
    declineRequest: useCallback((id: string) => after(api.respondFriendRequest(id, false)), [after]),
    removeFriend: useCallback((userId: string) => after(api.removeFriend(userId)), [after]),
    blockUser: useCallback((userId: string) => after(api.blockUser(userId)), [after]),
  };
}
