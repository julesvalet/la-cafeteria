import { useCallback, useEffect, useRef, useState } from 'react';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { applyAction, botAction, createGame, leave, publicState, tick } from '../engine/rules';
import type { GameOptions, GameState, PlayerAction, PublicState } from '../engine/types';
import { parseEnvelope } from './protocol';
import { REVEAL_MS } from '../utils/animation';

export interface SessionOptions extends GameOptions { code: string; name: string; isHost: boolean }
const PREFIX = 'la-cafeteria-flip7-';

export function useFlip7Game(options: SessionOptions) {
  const [state, setState] = useState<PublicState | null>(null);
  const [selfId, setSelfId] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const command = useRef<(a: PlayerAction) => void>(() => {});
  const initial = useRef(options);

  useEffect(() => {
    const opts = initial.current;
    const local = opts.mode !== 'online';
    const host = local || opts.isHost;
    const hostId = local ? 'local-player' : PREFIX + opts.code;
    let truth: GameState | null = null;
    let peer: Peer | null = null;
    let hostConn: DataConnection | null = null;
    let cancelled = false;
    let lockedUntil = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let request = 0;
    const conns = new Map<string, DataConnection>();
    const requests = new Map<string, Set<string>>();
    const chatTimes = new Map<string, number>();

    const fail = (message: string, fatal = false) => { if (!cancelled) { setError(message); if (fatal) setStatus('error'); } };
    const send = (conn: DataConnection, data: unknown) => { if (conn.open) { try { conn.send(data); } catch { conn.close(); } } };
    const commit = (next: GameState) => {
      if (cancelled) return;
      const changed = next.revision !== truth?.revision;
      const newReveal = next.lastEvent.seq !== truth?.lastEvent.seq && Boolean(next.lastEvent.card);
      truth = next;
      const view = publicState(next);
      setState(view);
      for (const conn of conns.values()) {
        if (next.players.some(p => p.id === conn.peer)) send(conn, { type: 'STATE', state: view });
      }
      if (!changed) return;
      if (newReveal) lockedUntil = Date.now() + REVEAL_MS;
      clearTimeout(timer);
      const delay = Math.max(400, lockedUntil - Date.now() + 80);
      timer = setTimeout(() => {
        if (!truth || cancelled || truth.phase !== 'playing') return;
        if (truth.pending) {
          const p = truth.players[truth.pending.by];
          if (p?.bot) accept(p.id, botAction(truth, truth.pending.by));
        } else if (truth.queue.length) commit(tick(truth));
        else if (truth.players[truth.turn]?.bot) accept(truth.players[truth.turn].id, botAction(truth, truth.turn));
      }, delay + (next.players[next.pending?.by ?? next.turn]?.bot ? 650 : 0));
    };
    const accept = (actor: string, action: PlayerAction, conn?: DataConnection, revision?: number) => {
      if (!truth) return;
      const reject = (message: string) => conn ? send(conn, { type: 'ERROR', message }) : fail(message);
      if (!['CHAT', 'JOIN'].includes(action.type)) {
        if (revision !== undefined && revision !== truth.revision) { reject('La table a avancé. Réessaie ton choix.'); return; }
        if (Date.now() < lockedUntil) { reject('Attends la fin de la révélation.'); return; }
      }
      if (action.type === 'CHAT') {
        if (Date.now() - (chatTimes.get(actor) ?? 0) < 700) { reject('Un petit instant entre deux messages.'); return; }
        chatTimes.set(actor, Date.now());
      }
      const result = applyAction(truth, actor, action);
      if (result.error) { reject(result.error); return; }
      commit(result.state);
    };
    const initialize = () => {
      if (cancelled) return;
      setSelfId(hostId); setStatus('connected');
      const game = createGame(opts.code, hostId, opts.name, opts);
      commit(local ? applyAction(game, hostId, { type: 'START' }).state : game);
      command.current = action => accept(hostId, action);
    };
    if (local) initialize();
    else {
      timeout = setTimeout(() => fail('La connexion prend trop de temps. Vérifie le code et réessaie.', true), 18000);
      import('peerjs').then(({ default: PeerClass }) => {
        if (cancelled) return;
        peer = host ? new PeerClass(hostId) : new PeerClass();
        peer.on('open', id => {
          if (cancelled) return;
          if (host) { clearTimeout(timeout); initialize(); return; }
          setSelfId(id);
          hostConn = peer!.connect(PREFIX + opts.code, { reliable: true });
          const conn = hostConn;
          conn.on('open', () => {
            send(conn, { type: 'ACTION', action: { type: 'JOIN', name: opts.name }, revision: 0, requestId: `${id}-${++request}` });
            command.current = action => send(conn, { type: 'ACTION', action, revision: truth?.revision ?? 0, requestId: `${id}-${++request}` });
          });
          conn.on('data', raw => {
            if (cancelled || !raw || typeof raw !== 'object') return;
            const msg = raw as { type?: string; state?: PublicState; message?: string };
            if (msg.type === 'STATE' && msg.state?.code === opts.code && Array.isArray(msg.state.players)) {
              // The client retains only a public view; it never runs random draws.
              truth = { revision: msg.state.revision } as GameState;
              clearTimeout(timeout); setState(msg.state); setStatus('connected');
            } else if (msg.type === 'ERROR' && typeof msg.message === 'string') fail(msg.message, !truth);
          });
          conn.on('close', () => fail('L’hôte a fermé la table. Reviens au salon pour créer une nouvelle partie.', true));
          conn.on('error', () => fail('La connexion avec la table a été interrompue.', true));
        });
        if (host) peer.on('connection', conn => {
          const joinTimeout = setTimeout(() => { if (!conns.has(conn.peer)) conn.close(); }, 12000);
          conn.on('data', raw => {
            if (cancelled || !truth) return;
            const e = parseEnvelope(raw);
            if (!e) { send(conn, { type: 'ERROR', message: 'Commande invalide.' }); return; }
            const seen = requests.get(conn.peer) ?? new Set<string>();
            if (seen.has(e.requestId)) return;
            seen.add(e.requestId); if (seen.size > 128) seen.delete(seen.values().next().value!);
            requests.set(conn.peer, seen);
            if (!conns.has(conn.peer)) {
              if (e.action.type !== 'JOIN') return;
              const joined = applyAction(truth, conn.peer, e.action);
              if (joined.error) { send(conn, { type: 'ERROR', message: joined.error }); return; }
              clearTimeout(joinTimeout); conns.set(conn.peer, conn); commit(joined.state); return;
            }
            accept(conn.peer, e.action, conn, e.revision);
          });
          const disconnect = () => {
            clearTimeout(joinTimeout);
            if (conns.get(conn.peer) !== conn) return;
            conns.delete(conn.peer); requests.delete(conn.peer);
            if (truth && !cancelled) commit(leave(truth, conn.peer));
          };
          conn.on('close', disconnect); conn.on('error', disconnect);
        });
        peer.on('error', err => fail(err.type === 'unavailable-id'
          ? 'Ce code est déjà utilisé. Crée une nouvelle table.'
          : 'Connexion impossible. Vérifie le code et la connexion Internet.', true));
        peer.on('disconnected', () => { if (!cancelled && peer && !peer.destroyed) peer.reconnect(); });
      }).catch(() => fail('Le module de connexion n’a pas pu être chargé.', true));
    }
    return () => {
      cancelled = true; clearTimeout(timer); clearTimeout(timeout); command.current = () => {};
      for (const conn of conns.values()) conn.close(); conns.clear(); hostConn?.close(); peer?.destroy();
    };
  }, []);

  return { state, selfId, status, error, clearError: useCallback(() => setError(null), []),
    sendAction: useCallback((action: PlayerAction) => command.current(action), []) };
}
