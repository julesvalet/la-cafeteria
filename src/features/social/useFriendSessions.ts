import { useCallback, useEffect, useState } from 'react';
import * as api from './api';
import { useSocial } from './useSocial';
import type { FriendSession } from './types';

const POLL_MS = 20_000;

/**
 * Les tables publiques où jouent (ou qu'hébergent) les amis du joueur.
 *
 * Relu à intervalle régulier plutôt que poussé en temps réel : l'annuaire
 * change au rythme des parties, pas des coups, et vingt secondes de retard sur
 * « une place vient de se libérer » ne coûtent rien. Relu aussi quand la
 * présence bouge — un ami qui arrive ou part change souvent la liste.
 */
export function useFriendSessions() {
  const { active, online } = useSocial();
  const [sessions, setSessions] = useState<FriendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      setSessions(await api.listFriendSessions());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sessions indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [active, refresh]);

  // Un ami qui arrive ou repart : la liste a sans doute changé.
  const onlineCount = online.size;
  useEffect(() => {
    if (active) void refresh();
  }, [active, onlineCount, refresh]);

  /** La table où se trouve un ami donné, s'il est à une table publique. */
  const sessionOf = useCallback(
    (userId: string) =>
      sessions.find((s) => s.host_id === userId || s.friends_inside.some((f) => f.user_id === userId)) ?? null,
    [sessions],
  );

  return { sessions, loading, error, refresh, sessionOf };
}
