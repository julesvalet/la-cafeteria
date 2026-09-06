import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import type { ChatMessage } from '../engine/types';

export function ChatPanel({ messages, onSend, selfId }: { messages: ChatMessage[]; onSend: (text: string) => void; selfId: string }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages.length, open]);
  return <>
    <button className="f7-chat-bubble" aria-label="Ouvrir la conversation" aria-expanded={open} onClick={() => setOpen(v => !v)}><MessageCircle size={23} /></button>
    <aside className={`f7-chat ${open ? 'is-open' : ''}`} aria-label="Conversation de la table">
      <div className="f7-chat-head"><span><MessageCircle size={17} /> À la table</span><button className="f7-icon" aria-label="Fermer la conversation" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div ref={scroll} className="f7-messages" role="log" aria-live="polite" aria-relevant="additions">
        {!messages.length && <div className="f7-chat-empty"><span>☕</span><p>Un petit mot entre<br />deux cartes ?</p></div>}
        {messages.map(m => <div className={`f7-message ${m.playerId === selfId ? 'is-mine' : ''}`} key={m.id}><div><b>{m.name}</b><time>{new Date(m.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{m.text}</p></div>)}
      </div>
      <form onSubmit={e => { e.preventDefault(); if (text.trim()) { onSend(text); setText(''); } }}><input aria-label="Message" maxLength={300} value={text} onChange={e => setText(e.target.value)} placeholder="Un petit mot…" /><button aria-label="Envoyer le message" disabled={!text.trim()}><Send size={17} /></button></form>
    </aside>
  </>;
}
