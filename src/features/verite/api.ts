import { accountsEnabled, getSupabase } from '../../lib/supabase';
import type { VeriteQuestion, VeriteTheme } from './engine/types';

/*
 * Les questions perso publiques, en base (migration 0005).
 *
 * Seules les questions *publiques* sont écrites : une question privée ne vit
 * que dans l'état de la partie, chez l'hôte, et disparaît avec elle — c'est
 * ce que « privée » promet, et une question HARD n'a rien à faire en base si
 * son auteur ne l'a pas voulu.
 *
 * Tout est facultatif : sans Supabase (ou en panne), la partie se joue avec
 * la banque du jeu et les questions privées.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isQuestionUuid = (id: string) => UUID.test(id);

/** L'identifiant en base d'une question publique de la partie (`pub-<uuid>`). */
export function publicQuestionUuid(q: Pick<VeriteQuestion, 'id' | 'source'>): string | null {
  if (q.source !== 'public' || !q.id.startsWith('pub-')) return null;
  const id = q.id.slice(4);
  return isQuestionUuid(id) ? id : null;
}

interface Row {
  id: string;
  content: string;
  theme: VeriteTheme;
  author: string | null;
}

/**
 * Un échantillon du pool public, tiré au hasard par la base. Lu par l'hôte au
 * lancement ; ne rejette jamais — sans base, la partie se passe de ce pool.
 */
export async function fetchPublicQuestions(themes: VeriteTheme[], limit = 60): Promise<VeriteQuestion[]> {
  if (!accountsEnabled) return [];
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('random_truth_questions', { p_themes: themes, p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return (data as Row[]).map((r) => ({
      id: `pub-${r.id}`,
      text: r.content,
      theme: r.theme,
      source: 'public' as const,
      byName: r.author ?? undefined,
    }));
  } catch {
    return [];
  }
}

/** Publie une question dans le pool partagé. Compte requis. Renvoie son identifiant. */
export async function publishQuestion(text: string, theme: VeriteTheme): Promise<string> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('add_truth_question', { p_content: text, p_theme: theme });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Signale une question publique. Au troisième signalement, elle sort du pool. */
export async function reportQuestion(uuid: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('report_truth_question', { p_question_id: uuid });
  if (error) throw new Error(error.message);
}

/** Compte les tirages (colonne `used_count`). Sans importance si ça échoue. */
export function markQuestionUsed(uuid: string): void {
  if (!accountsEnabled) return;
  getSupabase()
    .then((s) => s.rpc('mark_truth_question_used', { p_question_id: uuid }))
    .catch(() => {});
}
