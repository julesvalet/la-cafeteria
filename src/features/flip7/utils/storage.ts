export interface Stats { rounds: number; best: number; points: number; flip7s: number; recorded: string[] }
const KEY = 'cafeteria-flip7-stats-v1';
export function readPreference(key: string, fallback: string): string {
  try { return localStorage.getItem(`flip7-${key}`) ?? fallback; } catch { return fallback; }
}
export function savePreference(key: string, value: string) {
  try { localStorage.setItem(`flip7-${key}`, value); } catch { /* Private mode can disable storage. */ }
}
export function readStats(): Stats {
  const empty = { rounds: 0, best: 0, points: 0, flip7s: 0, recorded: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return s && ['rounds', 'best', 'points', 'flip7s'].every(k => Number.isFinite(s[k]) && s[k] >= 0)
      && Array.isArray(s.recorded) ? s : empty;
  } catch { return empty; }
}
export function recordRound(id: string, score: number, flip7: boolean) {
  const s = readStats(); if (s.recorded.includes(id)) return;
  const next = { rounds: s.rounds + 1, best: Math.max(s.best, score), points: s.points + score,
    flip7s: s.flip7s + Number(flip7), recorded: [...s.recorded, id].slice(-200) };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Play remains available without persistence. */ }
}
