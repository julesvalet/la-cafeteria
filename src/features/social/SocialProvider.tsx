import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { accountsEnabled, getSupabase } from '../../lib/supabase';
import { useAuth } from '../account/useAuth';
import * as api from './api';
import {
  SocialContext,
  type CurrentRoom,
  type NotificationEvent,
  type PresenceStatus,
  type SocialValue,
} from './socialContext';
import { Toasts, type Toast } from './components/Toasts';
import { FriendsDock } from './components/FriendsDock';
import { AchievementNotification } from '../achievements/AchievementNotification';
import type { AppNotification, Friendship, GroupInvitation } from './types';

/** Assez souvent pour que « vu il y a 5 min » dise vrai, assez rarement pour ne rien coûter. */
const LAST_SEEN_EVERY_MS = 4 * 60 * 1000;

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_MAP: ReadonlyMap<string, 'online' | 'away'> = new Map();
/** Onglet caché depuis tant de temps : on passe « absent » tout seul. */
const AUTO_AWAY_MS = 5 * 60 * 1000;
const STATUS_KEY = 'cafeteria-presence-status';

function readStatus(): PresenceStatus {
  try {
    const v = localStorage.getItem(STATUS_KEY);
    return v === 'away' || v === 'offline' ? v : 'online';
  } catch {
    return 'online';
  }
}

/*
 * Le temps réel du site, là où le cahier des charges plaçait Socket.io.
 *
 * Il n'y a pas de serveur pour tenir des sockets : ce sont les canaux Supabase
 * Realtime qui en tiennent lieu, avec deux abonnements par onglet connecté.
 *
 *   - `notifications:<uid>` suit les insertions dans la table notifications,
 *     filtrées par la RLS. C'est le bus d'événements : demande d'ami, groupe
 *     supprimé, invitation à une partie… Chaque événement dit au client quelle
 *     liste relire, plutôt que de transporter la liste elle-même.
 *   - `online` est un canal privé de présence. Chaque onglet s'y annonce ; le
 *     départ est détecté par Realtime lui-même quand la connexion tombe, ce
 *     qu'aucun appel « je pars » envoyé à la fermeture ne garantit.
 *
 * Tout est inerte sans compte : un visiteur anonyme n'ouvre aucun canal.
 */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { status, user, profile } = useAuth();
  const uid = status === 'signed-in' ? (user?.id ?? null) : null;
  const active = accountsEnabled && uid !== null;

  const [loading, setLoading] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);
  const [presence, setPresence] = useState<ReadonlyMap<string, 'online' | 'away'>>(EMPTY_MAP);
  const online = useMemo<ReadonlySet<string>>(() => (presence.size ? new Set(presence.keys()) : EMPTY_SET), [presence]);
  const [myStatus, setMyStatusState] = useState<PresenceStatus>(readStatus);
  const [hiddenLong, setHiddenLong] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<CurrentRoom | null>(null);
  const presenceChannel = useRef<RealtimeChannel | null>(null);
  const [presenceLive, setPresenceLive] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const listeners = useRef(new Set<(event: NotificationEvent) => void>());

  // Les préférences se lisent au moment de l'événement, pas à l'abonnement :
  // décocher « notifications » ne doit pas exiger de rouvrir les canaux.
  const wantsToasts = useRef(true);
  wantsToasts.current = profile?.preferences.notifications ?? true;

  const refreshFriends = useCallback(async () => {
    if (!active) return;
    setFriendships(await api.listFriendships());
  }, [active]);

  const refreshNotifications = useCallback(async () => {
    if (!active) return;
    setNotifications(await api.listNotifications());
  }, [active]);

  const refreshInvitations = useCallback(async () => {
    if (!active) return;
    setGroupInvitations(await api.listGroupInvitations());
  }, [active]);

  const markRead = useCallback(async (ids?: number[]) => {
    const now = new Date().toISOString();
    // Optimiste : la pastille s'éteint au clic, pas un aller-retour plus tard.
    setNotifications((list) =>
      list.map((n) => (n.read_at === null && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n)),
    );
    await api.markNotificationsRead(ids);
  }, []);

  const subscribe = useCallback<SocialValue['subscribe']>((listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  // Déconnexion : rien de l'ancien compte ne doit rester affiché.
  useEffect(() => {
    if (active) return;
    setFriendships([]);
    setNotifications([]);
    setGroupInvitations([]);
    setPresence(EMPTY_MAP);
    setPresenceLive(false);
    setToasts([]);
    setPanelOpen(false);
  }, [active]);

  const setMyStatus = useCallback((status: PresenceStatus) => {
    setMyStatusState(status);
    try {
      localStorage.setItem(STATUS_KEY, status);
    } catch {
      // Le choix vaudra pour cette visite seulement.
    }
  }, []);

  // Absence automatique : un onglet oublié en arrière-plan ne doit pas
  // afficher « en ligne » à des amis qui attendent une réponse.
  useEffect(() => {
    let timer: number | undefined;
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'hidden') timer = window.setTimeout(() => setHiddenLong(true), AUTO_AWAY_MS);
      else setHiddenLong(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const shownStatus: PresenceStatus = myStatus === 'online' && hiddenLong ? 'away' : myStatus;
  const statusRef = useRef(shownStatus);
  statusRef.current = shownStatus;

  // Chargement initial.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([api.listFriendships(), api.listNotifications(), api.listGroupInvitations()])
      .then(([f, n, i]) => {
        if (cancelled) return;
        if (f.status === 'fulfilled') setFriendships(f.value);
        if (n.status === 'fulfilled') setNotifications(n.value);
        if (i.status === 'fulfilled') setGroupInvitations(i.value);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, uid]);

  // Pointage de présence : à l'ouverture, puis régulièrement tant que l'onglet est visible.
  useEffect(() => {
    if (!active) return;
    const touch = () => {
      if (document.visibilityState === 'visible') api.touchLastSeen().catch(() => {});
    };
    touch();
    const timer = window.setInterval(touch, LAST_SEEN_EVERY_MS);
    document.addEventListener('visibilitychange', touch);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', touch);
    };
  }, [active, uid]);

  // Canaux temps réel.
  useEffect(() => {
    if (!active || !uid) return;
    let cancelled = false;
    const channels: RealtimeChannel[] = [];
    let client: Awaited<ReturnType<typeof getSupabase>> | null = null;

    async function onNotification(event: NotificationEvent) {
      for (const listener of listeners.current) listener(event);

      if (event.kind.startsWith('friend_')) void refreshFriends().catch(() => {});
      if (event.kind === 'group_invite') void refreshInvitations().catch(() => {});
      if (event.silent) return;

      const list = await api.listNotifications().catch(() => null);
      if (cancelled || !list) return;
      setNotifications(list);

      const full = list.find((n) => n.id === event.id);
      // Les trophées ont leur propre pop-up doré (AchievementNotification).
      if (full && wantsToasts.current && event.kind !== 'achievement') {
        setToasts((current) => [...current.slice(-2), { id: full.id, notification: full }]);
      }
    }

    getSupabase()
      .then(async (c) => {
        if (cancelled) return;
        client = c;
        // Les canaux privés s'authentifient avec le jeton de la session.
        await c.realtime.setAuth();
        if (cancelled) return;

        channels.push(
          c
            .channel(`notifications:${uid}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
              (payload) => void onNotification(payload.new as NotificationEvent),
            )
            .subscribe(),
        );

        const presenceCh = c.channel('online', { config: { private: true, presence: { key: uid } } });
        presenceChannel.current = presenceCh;
        presenceCh
          .on('presence', { event: 'sync' }, () => {
            if (cancelled) return;
            const next = new Map<string, 'online' | 'away'>();
            for (const [key, metas] of Object.entries(presenceCh.presenceState<{ status?: string }>())) {
              // Plusieurs onglets pour un même joueur : il est « en ligne » si
              // l'un d'eux l'est.
              next.set(key, metas.some((m) => m.status !== 'away') ? 'online' : 'away');
            }
            setPresence(next);
          })
          .subscribe((state) => {
            if (cancelled) return;
            if (state === 'SUBSCRIBED') {
              setPresenceLive(true);
              if (statusRef.current !== 'offline') {
                void presenceCh.track({ status: statusRef.current, since: new Date().toISOString() });
              }
            } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
              // Canal refusé (policies absentes) ou coupé : les pastilles vertes
              // cèdent la place à l'heure de dernier passage.
              setPresenceLive(false);
            }
          });
        channels.push(presenceCh);
      })
      .catch(() => {
        // Sans temps réel, le site marche encore : les listes se rechargent à
        // l'ouverture des pages.
      });

    return () => {
      cancelled = true;
      for (const channel of channels) void client?.removeChannel(channel);
      presenceChannel.current = null;
      setPresence(EMPTY_MAP);
      setPresenceLive(false);
    };
  }, [active, uid, refreshFriends, refreshInvitations]);

  // Annoncer (ou retirer) sa présence quand le statut change, sans rouvrir le canal.
  useEffect(() => {
    const channel = presenceChannel.current;
    if (!channel || !presenceLive) return;
    if (shownStatus === 'offline') void channel.untrack();
    else void channel.track({ status: shownStatus, since: new Date().toISOString() });
  }, [shownStatus, presenceLive]);

  const value = useMemo<SocialValue>(() => {
    const friends = friendships.filter((f) => f.direction === 'friend');
    return {
      active,
      loading,
      friendships,
      friends,
      incoming: friendships.filter((f) => f.direction === 'incoming'),
      outgoing: friendships.filter((f) => f.direction === 'outgoing'),
      online,
      presenceLive,
      presence,
      myStatus,
      setMyStatus,
      panelOpen,
      setPanelOpen,
      currentRoom,
      setCurrentRoom,
      notifications,
      unreadCount: notifications.filter((n) => n.read_at === null).length,
      groupInvitations,
      refreshFriends,
      refreshNotifications,
      refreshInvitations,
      markRead,
      subscribe,
    };
  }, [
    active,
    loading,
    friendships,
    online,
    presenceLive,
    presence,
    myStatus,
    setMyStatus,
    panelOpen,
    currentRoom,
    notifications,
    groupInvitations,
    refreshFriends,
    refreshNotifications,
    refreshInvitations,
    markRead,
    subscribe,
  ]);

  return (
    <SocialContext value={value}>
      {children}
      {active && <Toasts toasts={toasts} onDismiss={dismissToast} onRead={(id) => void markRead([id]).catch(() => {})} />}
      <FriendsDock />
      {active && <AchievementNotification />}
    </SocialContext>
  );
}
