import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { applyAction, createInitialState } from '../engine/rules';
import type { GameState, ScopaAction } from '../engine/types';

const PEER_PREFIX = 'la-cafeteria-scopa-';

type WireMessage =
  | { type: 'ACTION'; action: ScopaAction }
  | { type: 'STATE'; state: GameState }
  | { type: 'ERROR'; message: string };

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

interface UseScopaRoomResult {
  state: GameState | null;
  selfId: string | null;
  isHost: boolean;
  status: ConnectionStatus;
  error: string | null;
  sendAction: (action: ScopaAction) => void;
}

function maskState(state: GameState, viewerId: string): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === viewerId ? p : { ...p, hand: [] })),
  };
}

export function useScopaRoom(roomCode: string, playerName: string, isHost: boolean): UseScopaRoomResult {
  const [state, setState] = useState<GameState | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const hostStateRef = useRef<GameState | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);
  const nameRef = useRef(playerName);
  nameRef.current = playerName;

  useEffect(() => {
    let cancelled = false;
    const code = roomCode.trim().toUpperCase();

    if (isHost) {
      const hostId = PEER_PREFIX + code;
      const peer = new Peer(hostId);
      peerRef.current = peer;

      const broadcast = (next: GameState) => {
        for (const [pid, conn] of connsRef.current) {
          if (conn.open) conn.send({ type: 'STATE', state: maskState(next, pid) } satisfies WireMessage);
        }
      };

      peer.on('open', (id) => {
        if (cancelled) return;
        setSelfId(id);
        const initial = applyAction(createInitialState(code, id), {
          type: 'JOIN',
          playerId: id,
          name: nameRef.current,
        }).state;
        hostStateRef.current = initial;
        setState(maskState(initial, id));
        setStatus('connected');
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => {
          connsRef.current.set(conn.peer, conn);
        });
        conn.on('data', (data) => {
          const msg = data as WireMessage;
          if (msg.type !== 'ACTION' || !hostStateRef.current) return;
          const { state: next, error: err } = applyAction(hostStateRef.current, msg.action);
          hostStateRef.current = next;
          setState(maskState(next, hostId));
          broadcast(next);
          if (err && conn.open) conn.send({ type: 'ERROR', message: err } satisfies WireMessage);
        });
        conn.on('close', () => {
          connsRef.current.delete(conn.peer);
          if (!hostStateRef.current) return;
          const next = applyAction(hostStateRef.current, { type: 'LEAVE', playerId: conn.peer }).state;
          hostStateRef.current = next;
          setState(maskState(next, hostId));
          broadcast(next);
        });
      });

      peer.on('error', (err) => {
        if (cancelled) return;
        if ((err as { type?: string }).type === 'unavailable-id') {
          setError('Ce code de room est déjà utilisé. Choisis-en un autre.');
        } else {
          setError('Erreur de connexion : ' + err.message);
        }
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
          conn.send({ type: 'ACTION', action: { type: 'JOIN', playerId: id, name: nameRef.current } } satisfies WireMessage);
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
      connsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isHost]);

  const sendAction = useCallback(
    (action: ScopaAction) => {
      if (isHost) {
        const hostId = PEER_PREFIX + roomCode.trim().toUpperCase();
        if (!hostStateRef.current) return;
        const { state: next, error: err } = applyAction(hostStateRef.current, action);
        hostStateRef.current = next;
        setState(maskState(next, hostId));
        for (const [pid, conn] of connsRef.current) {
          if (conn.open) conn.send({ type: 'STATE', state: maskState(next, pid) } satisfies WireMessage);
        }
        if (err) setError(err);
      } else {
        hostConnRef.current?.send({ type: 'ACTION', action } satisfies WireMessage);
      }
    },
    [isHost, roomCode],
  );

  return { state, selfId, isHost, status, error, sendAction };
}
