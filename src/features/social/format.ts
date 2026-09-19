const RELATIVE = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const TIME_FMT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « à l'instant », « il y a 5 minutes », « hier », puis une date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "à l'instant";
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return RELATIVE.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 6) return RELATIVE.format(Math.round(seconds / 86400), 'day');
  return `le ${DAY_FMT.format(new Date(iso))}`;
}

/** L'heure d'un message : seule si c'est aujourd'hui, avec le jour sinon. */
export function messageTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? TIME_FMT.format(d) : `${DAY_FMT.format(d)}, ${TIME_FMT.format(d)}`;
}

export function winRate(wins: number, games: number): string {
  return games > 0 ? `${Math.round((wins / games) * 100)} %` : '—';
}
