import { GAME_LABELS } from '../account/types';
import { gameRoomPath } from './gameRooms';
import type { AppNotification } from './types';

export interface NotificationView {
  text: string;
  /** Où mène un clic sur la notification. */
  to: string | null;
}

/** Le texte et la destination d'une notification, partagés par la cloche et les toasts. */
export function describeNotification(
  n: Pick<AppNotification, 'kind' | 'payload' | 'group_id'>,
  actorName: string | null,
): NotificationView {
  const who = actorName ?? "Quelqu'un";
  const group = n.payload.group_name ?? 'un groupe';

  switch (n.kind) {
    case 'friend_request':
      return { text: `${who} t'a envoyé une demande d'ami.`, to: '/amis' };
    case 'friend_accepted':
      return { text: `${who} a accepté ta demande d'ami.`, to: '/amis' };
    case 'group_invite':
      return { text: `${who} t'invite dans le groupe « ${group} ».`, to: '/groupes' };
    case 'group_removed':
      return { text: `Tu as été retiré du groupe « ${group} ».`, to: '/groupes' };
    case 'group_deleted':
      return { text: `Le groupe « ${group} » a été supprimé.`, to: '/groupes' };
    case 'game_invite': {
      const game = n.payload.game_type;
      const label = game ? GAME_LABELS[game] : 'une partie';
      return {
        text: `${who} t'attend pour une partie de ${label}.`,
        to: game && n.payload.room_code ? gameRoomPath(game, n.payload.room_code) : null,
      };
    }
    default:
      return { text: 'Nouvelle notification.', to: null };
  }
}
