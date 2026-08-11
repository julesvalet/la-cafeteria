import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { applyAction, createInitialState } from '../engine/rules';
import type { P4Action, P4Mode, P4State } from '../engine/types';

const PEER_PREFIX = 'la-cafeteria-p4-';

type WireMessage =
  | { type: 'ACTION'; action: P4Action }
  | { type: 'STATE'; state: P4State }
  | { type: 'ERROR'; message: string };

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

interface UseP4RoomResult {
  state: P4State | null;
  selfId: string | null;
  isHost: boolean;
  status: ConnectionStatus;
  error: string | null;
  clearError: () => void;
  sendAction: (action: P4Action) => void;
}

/**
 * Same shape as the Scopa room: the host owns the authoritative state, applies
 * every action through the pure engine, and broadcasts the result. Unlike Scopa
 * there is no hidden information on a Puissance 4 board, so the state goes out
 * to everyone unmasked.
 */
export function useP4Room(
  roomCode: string,
  playerName: string,
  isHost: boolean,
  mode: P4Mode,
): UseP4RoomResult {
  const [state, setState] = useState<P4State | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const hostStateRef = useRef<P4State | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);

  // Read at connection time only, so retyping a name cannot restart the peer.
  const nameRef = useRef(playerName);
  nameRef.current = playerName;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let cancelled = false;
    const code = roomCode.trim().toUpperCase();
    const conns = connsRef.current;

    if (isHost) {
      const hostId = PEER_PREFIX + code;
      const peer = new Peer(hostId);
      peerRef.current = peer;

      const broadcast = (next: P4State) => {
        for (const conn of conns.values()) {
          if (conn.open) conn.send({ type: 'STATE', state: next } satisfies WireMessage);
        }
      };

      const commit = (next: P4State) => {
        hostStateRef.current = next;
        setState(next);
        broadcast(next);
      };

      peer.on('open', (id) => {
        if (cancelled) return;
        setSelfId(id);
        const initial = applyAction(createInitialState(code, id, modeRef.current), {
          type: 'JOIN',
          playerId: id,
          name: nameRef.current,
        }).state;
        hostStateRef.current = initial;
        setState(initial);
        setStatus('connected');
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => {
          conns.set(conn.peer, conn);
          if (hostStateRef.current) {
            conn.send({ type: 'STATE', state: hostStateRef.current } satisfies WireMessage);
          }
        });

        conn.on('data', (data) => {
          const msg = data as WireMessage;
          if (msg.type !== 'ACTION' || !hostStateRef.current) return;
          // Never trust a client's claim about who it is.
          const action = { ...msg.action, playerId: conn.peer } as P4Action;
          const { state: next, error: err } = applyAction(hostStateRef.current, action);
          commit(next);
          if (err && conn.open) conn.send({ type: 'ERROR', message: err } satisfies WireMessage);
        });

        conn.on('close', () => {
          conns.delete(conn.peer);
          if (!hostStateRef.current) return;
          commit(applyAction(hostStateRef.current, { type: 'LEAVE', playerId: conn.peer }).state);
        });
      });

      peer.on('error', (err) => {
        if (cancelled) return;
        setError(
          (err as { type?: string }).type === 'unavailable-id'
            ? 'Ce code de room est déjà utilisé. Reviens en arrière et recrée une partie.'
            : 'Erreur de connexion : ' + err.message,
        );
        setStatus('error');
      });
    } else {
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
        if (cancelled) return;
        setSelfId(id);
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
        hostConnRef.current = conn;

        conn.on('open', () => {
          conn.send({
            type: 'ACTION',
            action: { type: 'JOIN', playerId: id, name: nameRef.current },
          } satisfies WireMessage);
          setStatus('connected');
        });
        conn.on('data', (data) => {
          const msg = data as WireMessage;
          if (msg.type === 'STATE') setState(msg.state);
          if (msg.type === 'ERROR') setError(msg.message);
        });
        conn.on('close', () => {
          if (cancelled) return;
          setStatus('error');
          setError("La connexion avec l'hôte a été perdue.");
        });
        conn.on('error', (err) => {
          if (cancelled) return;
          setStatus('error');
          setError('Impossible de rejoindre la room : ' + err.message);
        });
      });

      peer.on('error', (err) => {
        if (cancelled) return;
        setStatus('error');
        setError('Room introuvable. Vérifie le code avec ton pote. (' + err.message + ')');
      });
    }

    return () => {
      cancelled = true;
      peerRef.current?.destroy();
      conns.clear();
    };
  }, [roomCode, isHost]);

  const sendAction = useCallback(
    (action: P4Action) => {
      if (isHost) {
        if (!hostStateRef.current) return;
        const { state: next, error: err } = applyAction(hostStateRef.current, action);
        hostStateRef.current = next;
        setState(next);
        for (const conn of connsRef.current.values()) {
          if (conn.open) conn.send({ type: 'STATE', state: next } satisfies WireMessage);
        }
        if (err) setError(err);
      } else {
        hostConnRef.current?.send({ type: 'ACTION', action } satisfies WireMessage);
      }
    },
    [isHost],
  );

  const clearError = useCallback(() => setError(null), []);

  return { state, selfId, isHost, status, error, clearError, sendAction };
}
