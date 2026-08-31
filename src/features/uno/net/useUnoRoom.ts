import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { applyAction, createInitialState } from '../engine/rules';
import type { UnoAction, UnoState } from '../engine/types';

const PEER_PREFIX = 'la-cafeteria-uno-';

type WireMessage =
  | { type: 'ACTION'; action: UnoAction }
  | { type: 'STATE'; state: UnoState }
  | { type: 'ERROR'; message: string };

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

/**
 * Strips other players' hands down to a count. `handCount` is maintained
 * alongside `hand` precisely so the table can still show how many cards
 * everyone is holding without ever shipping their contents.
 */
function maskState(state: UnoState, viewerId: string): UnoState {
  return {
    ...state,
    // The deck's *contents* would give away exactly where the mystery cards
    // are sitting, but its length is what draws the pile — so keep the count
    // and blank out every face.
    deck: state.deck.map((_, i) => ({ id: `hidden-${i}`, kind: 'number' as const, color: null, number: 0 })),
    players: state.players.map((p) => (p.id === viewerId ? p : { ...p, hand: [] })),
  };
}

interface UseUnoRoomResult {
  state: UnoState | null;
  selfId: string | null;
  isHost: boolean;
  status: ConnectionStatus;
  error: string | null;
  clearError: () => void;
  sendAction: (action: UnoAction) => void;
}

/**
 * Same shape as the Scopa and Puissance 4 rooms: the host owns the
 * authoritative state, runs every action through the pure engine, and
 * broadcasts the result masked per recipient.
 */
export function useUnoRoom(
  roomCode: string,
  playerName: string,
  isHost: boolean,
  maxPlayers: number,
  stackingEnabled: boolean,
): UseUnoRoomResult {
  const [state, setState] = useState<UnoState | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const hostStateRef = useRef<UnoState | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);

  // Read at connection time only, so retyping a name cannot restart the peer.
  const nameRef = useRef(playerName);
  nameRef.current = playerName;
  const optionsRef = useRef({ maxPlayers, stackingEnabled });
  optionsRef.current = { maxPlayers, stackingEnabled };

  useEffect(() => {
    let cancelled = false;
    const code = roomCode.trim().toUpperCase();
    const conns = connsRef.current;

    if (isHost) {
      const hostId = PEER_PREFIX + code;
      const peer = new Peer(hostId);
      peerRef.current = peer;

      const broadcast = (next: UnoState) => {
        for (const [peerId, conn] of conns) {
          if (conn.open) conn.send({ type: 'STATE', state: maskState(next, peerId) } satisfies WireMessage);
        }
      };

      const commit = (next: UnoState) => {
        // The ref keeps the truth; every view of it, the host's included, is masked.
        hostStateRef.current = next;
        setState(maskState(next, hostId));
        broadcast(next);
      };

      peer.on('open', (id) => {
        if (cancelled) return;
        setSelfId(id);
        const { maxPlayers: max, stackingEnabled: stacking } = optionsRef.current;
        let initial = createInitialState(code, id, max);
        initial = applyAction(initial, { type: 'SET_OPTIONS', maxPlayers: max, stackingEnabled: stacking }).state;
        initial = applyAction(initial, { type: 'JOIN', playerId: id, name: nameRef.current }).state;
        hostStateRef.current = initial;
        setState(maskState(initial, id));
        setStatus('connected');
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => {
          conns.set(conn.peer, conn);
          if (hostStateRef.current) {
            conn.send({ type: 'STATE', state: maskState(hostStateRef.current, conn.peer) } satisfies WireMessage);
          }
        });

        conn.on('data', (data) => {
          const msg = data as WireMessage;
          if (msg.type !== 'ACTION' || !hostStateRef.current) return;
          // Never trust a client's claim about who it is.
          const action = { ...msg.action, playerId: conn.peer } as UnoAction;
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
    (action: UnoAction) => {
      if (isHost) {
        if (!hostStateRef.current) return;
        const { state: next, error: err } = applyAction(hostStateRef.current, action);
        hostStateRef.current = next;
        setState(maskState(next, PEER_PREFIX + roomCode.trim().toUpperCase()));
        for (const [peerId, conn] of connsRef.current) {
          if (conn.open) conn.send({ type: 'STATE', state: maskState(next, peerId) } satisfies WireMessage);
        }
        if (err) setError(err);
      } else {
        hostConnRef.current?.send({ type: 'ACTION', action } satisfies WireMessage);
      }
    },
    [isHost, roomCode],
  );

  const clearError = useCallback(() => setError(null), []);

  return { state, selfId, isHost, status, error, clearError, sendAction };
}
