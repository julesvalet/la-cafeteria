import { useEffect, useSyncExternalStore } from 'react';
import { accountsEnabled } from '../../lib/supabase';
import { getCosmetics, type Cosmetics } from './api';

/*
 * Les cosmétiques des joueurs affichés (contour d'avatar, plaque, titre,
 * badges), partagés par toute la page.
 *
 * Une liste d'amis ou un classement monte des dizaines d'avatars d'un coup :
 * les demandes d'un même instant sont regroupées en un seul appel, et gardées
 * cinq minutes — un contour ne change pas toutes les secondes.
 */

const TTL = 5 * 60_000;
const cache = new Map<string, { value: Cosmetics | null; at: number }>();
const pending = new Set<string>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

function flush() {
  timer = null;
  const ids = [...pending].filter((id) => !inflight.has(id));
  pending.clear();
  if (!ids.length) return;
  ids.forEach((id) => inflight.add(id));
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    getCosmetics(batch)
      .then((rows) => {
        const now = Date.now();
        const found = new Map(rows.map((r) => [r.user_id, r]));
        batch.forEach((id) => cache.set(id, { value: found.get(id) ?? null, at: now }));
      })
      .catch(() => {
        // Sans cosmétiques, l'avatar reste nu : rien de grave.
        batch.forEach((id) => cache.set(id, { value: null, at: Date.now() }));
      })
      .finally(() => {
        batch.forEach((id) => inflight.delete(id));
        notify();
      });
  }
}

function request(ids: string[]) {
  const now = Date.now();
  let added = false;
  for (const id of ids) {
    const hit = cache.get(id);
    if (hit && now - hit.at < TTL) continue;
    if (inflight.has(id)) continue;
    pending.add(id);
    added = true;
  }
  if (added && !timer) timer = setTimeout(flush, 30);
}

/** Oublie un joueur : ses cosmétiques seront relus (après un achat, par exemple). */
export function invalidateCosmetics(userId: string) {
  cache.delete(userId);
  notify();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Les cosmétiques d'un joueur, ou `null` tant qu'ils ne sont pas chargés (ou sans compte). */
export function useCosmetics(userId: string | null | undefined): Cosmetics | null {
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    if (accountsEnabled && userId) request([userId]);
  }, [userId]);
  return (userId && cache.get(userId)?.value) || null;
}

/** Précharge une liste d'un coup (classements, listes d'amis). */
export function usePrefetchCosmetics(userIds: string[]) {
  const key = userIds.join(',');
  useEffect(() => {
    if (accountsEnabled && key) request(key.split(','));
  }, [key]);
}
