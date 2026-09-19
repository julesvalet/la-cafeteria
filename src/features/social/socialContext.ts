import { createContext } from 'react';
import type { AppNotification, Friendship, GroupInvitation } from './types';
import type { GameTypeId } from '../account/types';

/** Ce que le joueur affiche aux autres. « offline » : invisible, il voit sans être vu. */
export type PresenceStatus = 'online' | 'away' | 'offline';

/** La table où se trouve le joueur, déclarée par la room elle-même. */
export interface CurrentRoom {
  game: GameTypeId;
  code: string;
  isHost: boolean;
  isPublic: boolean;
  role: 'player' | 'spectator';
}

/** Une notification telle que Realtime la livre : la ligne brute, sans jointure. */
export interface NotificationEvent {
  id: number;
  kind: string;
  actor_id: string | null;
  group_id: string | null;
  payload: AppNotification['payload'];
  silent: boolean;
  created_at: string;
}

export interface SocialValue {
  /** Faux sans compte connecté : tout le reste est alors vide. */
  active: boolean;
  loading: boolean;

  friendships: Friendship[];
  friends: Friendship[];
  incoming: Friendship[];
  outgoing: Friendship[];
  /**
   * Joueurs connectés en ce moment, d'après le canal de présence. Un
   * ensemble d'identifiants plutôt qu'un drapeau par ami : il sert aussi aux
   * membres d'un groupe, qui ne sont pas forcément des amis.
   */
  online: ReadonlySet<string>;
  /** Faux quand le canal de présence n'a pas pu s'ouvrir : on retombe sur « vu il y a… ». */
  presenceLive: boolean;
  /** Statut de chaque joueur présent : « away » est connecté mais absent. */
  presence: ReadonlyMap<string, Exclude<PresenceStatus, 'offline'>>;
  myStatus: PresenceStatus;
  setMyStatus: (status: PresenceStatus) => void;

  /** Le panneau d'amis latéral. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean | ((open: boolean) => boolean)) => void;

  currentRoom: CurrentRoom | null;
  setCurrentRoom: (room: CurrentRoom | null) => void;

  notifications: AppNotification[];
  unreadCount: number;
  groupInvitations: GroupInvitation[];

  refreshFriends: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  markRead: (ids?: number[]) => Promise<void>;
  /**
   * S'abonner aux notifications entrantes, silencieuses comprises. C'est le
   * bus d'événements du site : la page Groupes y apprend qu'un groupe a été
   * supprimé, la page Amis qu'une demande a été refusée.
   */
  subscribe: (listener: (event: NotificationEvent) => void) => () => void;
}

export const SocialContext = createContext<SocialValue | null>(null);
