import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';
import { useAuth } from '../account/useAuth';
import { useNotificationEvents } from './useSocial';
import * as api from './api';
import type { Group, GroupMember, GroupMessage } from './types';

/** Au-delà, on considère que la personne a cessé d'écrire sans le dire (onglet fermé). */
const TYPING_TTL_MS = 4000;
/** Un signal « écrit… » au plus toutes les deux secondes et demie par personne. */
const TYPING_THROTTLE_MS = 2500;

export type ChatStatus = 'loading' | 'ready' | 'forbidden' | 'gone' | 'error';

/**
 * Un groupe ouvert : ses membres, sa conversation, qui est en train d'écrire.
 *
 * Deux canaux, pour deux garanties différentes.
 *
 *   - Les messages arrivent par `postgres_changes` : ce sont des lignes en
 *     base, filtrées par la RLS. Un membre retiré cesse de les recevoir.
 *   - « X écrit… » passe par un broadcast sur un canal privé : éphémère, rien
 *     n'est écrit en base. Si ce canal échoue, la conversation fonctionne
 *     toujours — seul l'indicateur manque.
 *
 * Les messages système (« X a rejoint le groupe ») servent aussi de signal :
 * à leur arrivée, on relit les membres et le groupe, qui viennent de changer.
 */
export function useGroupChat(groupId: string) {
  const { user, profile } = useAuth();
  const uid = user?.id ?? null;

  const [status, setStatus] = useState<ChatStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [goneReason, setGoneReason] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState<Record<string, { username: string; until: number }>>({});

  const typingChannel = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const membersRef = useRef(members);
  membersRef.current = members;

  const refreshMeta = useCallback(async () => {
    const [g, m] = await Promise.all([api.getGroup(groupId), api.getGroupMembers(groupId)]);
    if (!g) {
      setStatus((s) => (s === 'loading' ? 'forbidden' : 'gone'));
      return;
    }
    setGroup(g);
    setMembers(m);
  }, [groupId]);

  const upsert = useCallback((msg: GroupMessage) => {
    setMessages((list) => {
      const i = list.findIndex((m) => m.id === msg.id);
      if (i === -1) return [...list, msg].sort((a, b) => a.id - b.id);
      const next = list.slice();
      next[i] = msg;
      return next;
    });
  }, []);

  // Chargement initial.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setMessages([]);
    setGroup(null);
    setMembers([]);
    setGoneReason(null);

    Promise.all([api.getGroup(groupId), api.getGroupMembers(groupId), api.getGroupMessages(groupId)])
      .then(([g, m, page]) => {
        if (cancelled) return;
        if (!g) {
          setStatus('forbidden');
          return;
        }
        setGroup(g);
        setMembers(m);
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Chargement impossible.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Messages en direct.
  useEffect(() => {
    if (status !== 'ready') return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let client: Awaited<ReturnType<typeof getSupabase>> | null = null;

    getSupabase().then((c) => {
      if (cancelled) return;
      client = c;
      channel = c
        .channel(`group-db:${groupId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const msg = payload.new as GroupMessage;
            upsert(msg);
            if (payload.eventType !== 'INSERT') return;
            const unknownSender = msg.sender_id && !membersRef.current.some((m) => m.user_id === msg.sender_id);
            if (msg.kind === 'system' || unknownSender) void refreshMeta().catch(() => {});
            // Un message envoyé efface l'indicateur de son auteur.
            if (msg.sender_id) {
              setTyping((t) => {
                if (!t[msg.sender_id!]) return t;
                const next = { ...t };
                delete next[msg.sender_id!];
                return next;
              });
            }
          },
        )
        // Rattraper ce qui a pu arriver pendant une coupure réseau : à chaque
        // (ré)abonnement, on relit la dernière page.
        .subscribe((state) => {
          if (state !== 'SUBSCRIBED' || cancelled) return;
          api
            .getGroupMessages(groupId)
            .then((page) => page.messages.forEach(upsert))
            .catch(() => {});
        });
    });

    return () => {
      cancelled = true;
      if (channel) void client?.removeChannel(channel);
    };
  }, [groupId, status, upsert, refreshMeta]);

  // Indicateur de frappe.
  useEffect(() => {
    if (status !== 'ready' || !uid) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let client: Awaited<ReturnType<typeof getSupabase>> | null = null;

    getSupabase().then(async (c) => {
      if (cancelled) return;
      client = c;
      await c.realtime.setAuth();
      if (cancelled) return;
      channel = c
        .channel(`group:${groupId}`, { config: { private: true, broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const { user_id, username } = payload as { user_id: string; username: string };
          if (user_id === uid) return;
          setTyping((t) => ({ ...t, [user_id]: { username, until: Date.now() + TYPING_TTL_MS } }));
        })
        .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
          const { user_id } = payload as { user_id: string };
          setTyping((t) => {
            if (!t[user_id]) return t;
            const next = { ...t };
            delete next[user_id];
            return next;
          });
        })
        .subscribe();
      typingChannel.current = channel;
    });

    // Balayage des indicateurs expirés.
    const sweep = window.setInterval(() => {
      setTyping((t) => {
        const now = Date.now();
        const alive = Object.entries(t).filter(([, v]) => v.until > now);
        return alive.length === Object.keys(t).length ? t : Object.fromEntries(alive);
      });
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(sweep);
      typingChannel.current = null;
      if (channel) void client?.removeChannel(channel);
      setTyping({});
    };
  }, [groupId, status, uid]);

  // Retiré du groupe ou groupe supprimé pendant qu'on le regarde.
  useNotificationEvents((event) => {
    if ((event.kind === 'group_removed' || event.kind === 'group_deleted') && event.payload.group_id === groupId) {
      setGoneReason(event.kind === 'group_deleted' ? 'Ce groupe vient d’être supprimé.' : 'Tu as été retiré de ce groupe.');
      setStatus('gone');
    }
  });

  const loadMore = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.getGroupMessages(groupId, oldest.id);
      setMessages((list) => [...page.messages.filter((m) => !list.some((x) => x.id === m.id)), ...list]);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, messages, loadingMore]);

  const send = useCallback(
    async (content: string) => {
      const msg = await api.sendGroupMessage(groupId, content);
      upsert(msg);
      lastTypingSent.current = 0;
      void typingChannel.current?.send({ type: 'broadcast', event: 'stop_typing', payload: { user_id: uid } });
    },
    [groupId, upsert, uid],
  );

  const remove = useCallback(
    async (messageId: number) => {
      await api.deleteGroupMessage(messageId);
      setMessages((list) =>
        list.map((m) => (m.id === messageId ? { ...m, content: null, deleted_at: new Date().toISOString() } : m)),
      );
    },
    [],
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      const channel = typingChannel.current;
      if (!channel || !uid || !profile) return;
      if (!isTyping) {
        if (lastTypingSent.current === 0) return;
        lastTypingSent.current = 0;
        void channel.send({ type: 'broadcast', event: 'stop_typing', payload: { user_id: uid } });
        return;
      }
      const now = Date.now();
      if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
      lastTypingSent.current = now;
      void channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: uid, username: profile.username } });
    },
    [uid, profile],
  );

  return {
    status,
    error,
    goneReason,
    group,
    members,
    messages,
    hasMore,
    loadingMore,
    typingNames: Object.values(typing).map((t) => t.username),
    refreshMeta,
    loadMore,
    send,
    remove,
    notifyTyping,
  };
}
