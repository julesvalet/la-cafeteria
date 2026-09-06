import type { Envelope, PlayerAction } from '../engine/types';

/** Parse the small command vocabulary before data ever reaches the rules engine. */
export function parseEnvelope(data: unknown): Envelope | null {
  if (!data || typeof data !== 'object') return null;
  const e = data as Record<string, unknown>;
  if (e.type !== 'ACTION' || typeof e.requestId !== 'string' || e.requestId.length > 90
    || !Number.isSafeInteger(e.revision) || !e.action || typeof e.action !== 'object') return null;
  const a = e.action as Record<string, unknown>;
  let action: PlayerAction;
  switch (a.type) {
    case 'JOIN': if (typeof a.name !== 'string' || !a.name.trim() || a.name.length > 18) return null; action = { type: 'JOIN', name: a.name }; break;
    case 'CHAT': if (typeof a.text !== 'string' || a.text.length > 300) return null; action = { type: 'CHAT', text: a.text }; break;
    case 'TARGET': if (typeof a.targetId !== 'string' || a.targetId.length > 100) return null; action = { type: 'TARGET', targetId: a.targetId }; break;
    case 'START': case 'HIT': case 'STAY': case 'NEXT_ROUND': case 'REMATCH': action = { type: a.type }; break;
    default: return null;
  }
  return { action, revision: e.revision as number, requestId: e.requestId };
}
