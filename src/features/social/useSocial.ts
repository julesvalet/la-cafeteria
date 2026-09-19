import { useContext, useEffect, useRef } from 'react';
import { SocialContext, type NotificationEvent, type SocialValue } from './socialContext';

export function useSocial(): SocialValue {
  const value = useContext(SocialContext);
  if (!value) throw new Error('useSocial doit être utilisé sous <SocialProvider>.');
  return value;
}

/**
 * Réagir aux notifications entrantes sans se réabonner à chaque rendu.
 *
 * Le callback est lu à travers une référence : l'appelant peut passer une
 * fonction fléchée recréée à chaque rendu sans que l'abonnement ne tombe et ne
 * se refasse entre deux événements.
 */
export function useNotificationEvents(listener: (event: NotificationEvent) => void) {
  const { subscribe } = useSocial();
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => subscribe((event) => ref.current(event)), [subscribe]);
}
