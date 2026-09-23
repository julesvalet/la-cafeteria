import { useEffect, useState } from 'react';
import { GAME_LABELS, type GameTypeId } from '../../account/types';

/** Les jeux, pour les listes déroulantes ; vide = tous les jeux. */
export const GAME_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Global (tous les jeux)' },
  ...(Object.keys(GAME_LABELS) as GameTypeId[]).map((g) => ({ value: g, label: GAME_LABELS[g] })),
];

/** Un message de retour qui s'efface tout seul. */
export function useFlash(): [{ tone: 'ok' | 'error'; text: string } | null, (tone: 'ok' | 'error', text: string) => void] {
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), msg.tone === 'ok' ? 3000 : 6000);
    return () => window.clearTimeout(t);
  }, [msg]);
  return [msg, (tone, text) => setMsg({ tone, text })];
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATETIME = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : '—');
export const fmtDateTime = (iso: string | null) => (iso ? DATETIME.format(new Date(iso)) : '—');

/** Une date ISO vers la valeur d'un <input type="datetime-local">, à l'heure locale. */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
