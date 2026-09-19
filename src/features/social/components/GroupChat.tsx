import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ChevronUp, Loader2, SendHorizontal, Trash2 } from 'lucide-react';
import { messageTime } from '../format';
import { UserAvatar } from './UserAvatar';
import type { GroupMember, GroupMessage } from '../types';

const MAX_LENGTH = 500;
/** À moins de cette distance du bas, on considère que le joueur suit la conversation. */
const STICKY_PX = 80;

interface Props {
  messages: GroupMessage[];
  members: GroupMember[];
  selfId: string;
  isAdmin: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  typingNames: string[];
  onLoadMore: () => Promise<void>;
  onSend: (content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onTyping: (typing: boolean) => void;
}

function typingLabel(names: string[]): string {
  if (names.length === 1) return `${names[0]} écrit…`;
  if (names.length === 2) return `${names[0]} et ${names[1]} écrivent…`;
  return 'Plusieurs personnes écrivent…';
}

export function GroupChat({
  messages,
  members,
  selfId,
  isAdmin,
  hasMore,
  loadingMore,
  typingNames,
  onLoadMore,
  onSend,
  onDelete,
  onTyping,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Où en était le défilement avant le dernier changement de la liste.
  const stick = useRef(true);
  const prependAnchor = useRef<{ height: number; top: number } | null>(null);
  const lastId = messages[messages.length - 1]?.id;

  /*
   * Deux cas, deux règles.
   *   - Des messages plus anciens arrivent en haut : on garde sous les yeux le
   *     message qu'on lisait, en compensant la hauteur ajoutée.
   *   - Un nouveau message arrive en bas : on descend si le joueur suivait déjà
   *     le bas, jamais s'il était remonté lire l'historique.
   */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prependAnchor.current) {
      el.scrollTop = el.scrollHeight - prependAnchor.current.height + prependAnchor.current.top;
      prependAnchor.current = null;
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastId, typingNames.length]);

  const byId = new Map(members.map((m) => [m.user_id, m]));

  async function loadMore() {
    const el = scroller.current;
    if (el) prependAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
    try {
      await onLoadMore();
    } catch {
      prependAnchor.current = null;
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    stick.current = true;
    try {
      await onSend(content);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée envoie, Maj+Entrée va à la ligne — la convention de toutes les
    // messageries, et celle que les doigts attendent.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="soc-chat">
      <div
        ref={scroller}
        className="soc-chat-scroll"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_PX;
        }}
      >
        {hasMore && (
          <div className="soc-chat-more">
            <button type="button" className="soc-link-btn" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? <Loader2 size={14} className="neon-spin" aria-hidden /> : <ChevronUp size={14} aria-hidden />}
              Messages précédents
            </button>
          </div>
        )}

        <ol className="soc-chat-list" role="log" aria-live="polite" aria-label="Conversation du groupe">
          {messages.length === 0 && <li className="soc-empty">Aucun message. Lance la conversation !</li>}
          {messages.map((m, i) => {
            if (m.kind === 'system') {
              return (
                <li key={m.id} className="soc-msg-system">
                  {m.content}
                </li>
              );
            }
            const prev = messages[i - 1];
            // Messages consécutifs d'une même personne à moins de cinq minutes :
            // un seul nom en tête du bloc, comme dans toute messagerie.
            const continued =
              prev?.kind === 'text' &&
              prev.sender_id === m.sender_id &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
            const mine = m.sender_id === selfId;
            const sender = m.sender_id ? byId.get(m.sender_id) : undefined;
            const name = sender?.username ?? 'Ancien membre';
            const deleted = m.deleted_at !== null;
            const canDelete = !deleted && (mine || isAdmin);

            return (
              <li key={m.id} className="soc-msg" data-mine={mine} data-continued={continued || undefined}>
                {!mine && !continued && <UserAvatar username={name} src={sender?.avatar} size={30} />}
                <div className="soc-msg-bubble" data-deleted={deleted || undefined}>
                  {!mine && !continued && <span className="soc-msg-author">{name}</span>}
                  <p className="soc-msg-text">{deleted ? 'Message supprimé' : m.content}</p>
                  <span className="soc-msg-time">
                    <time dateTime={m.created_at}>{messageTime(m.created_at)}</time>
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      className="soc-msg-delete"
                      aria-label="Supprimer ce message"
                      title="Supprimer"
                      onClick={() => void onDelete(m.id).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Suppression impossible.'))}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="soc-typing" aria-live="polite">
        {typingNames.length > 0 && (
          <>
            <span className="soc-typing-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {typingLabel(typingNames)}
          </>
        )}
      </p>

      {error && (
        <p className="neon-error soc-chat-error" role="alert">
          {error}
        </p>
      )}

      <form className="soc-chat-form" onSubmit={submit}>
        <label htmlFor="soc-chat-input" className="soc-sr-only">
          Ton message
        </label>
        <textarea
          id="soc-chat-input"
          className="neon-input soc-chat-input"
          rows={1}
          value={draft}
          maxLength={MAX_LENGTH}
          placeholder="Écris un message…"
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setDraft(e.target.value);
            onTyping(e.target.value.trim().length > 0);
          }}
          onBlur={() => onTyping(false)}
        />
        {draft.length > MAX_LENGTH - 60 && (
          <span className="soc-chat-count" aria-live="polite">
            {MAX_LENGTH - draft.length}
          </span>
        )}
        <button
          type="submit"
          className="soc-send"
          disabled={!draft.trim() || sending}
          aria-label="Envoyer"
        >
          {sending ? <Loader2 size={18} className="neon-spin" aria-hidden /> : <SendHorizontal size={18} aria-hidden />}
        </button>
      </form>
    </div>
  );
}
