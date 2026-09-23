import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { MODES, ORIGINAL_MODES } from '../engine/modes';
import { applyAction, createInitialState } from '../engine/rules';
import type { P4Action, P4Mode, P4State } from '../engine/types';
import {
  createSpectatorDesk,
  isSeatMessage,
  isSpectatorsMessage,
  withSeatsFilled,
  type SeatMessage,
  type Spectator,
  type SpectatorsMessage,
} from '../../rooms/spectators';
import { getCurrentUserId } from '../../account/currentUser';
import { createBotRunner, LOCAL_SELF_ID, makeBots, type BotSetup } from '../../bots/bots';
import { p4Decide } from '../engine/ai';

export type P4Variant = 'powers' | 'original';

/**
 * Separate peer namespaces per variant: a room code is only unique within its
 * own game, so "WL993" in Puissance 4 Original must not collide with the
 * powers version's room of the same code.
 */
const PEER_PREFIXES: Record<P4Variant, string> = {
  powers: 'la-cafeteria-p4-',
  original: 'la-cafeteria-p4o-',
};

type WireMessage =
  | { type: 'ACTION'; action: P4Action }
  | { type: 'STATE'; state: P4State }
  | { type: 'ERROR'; message: string }
  | SpectatorsMessage
  | SeatMessage;

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

/**
 * Hides which of the *other* players' discs are charged, keeping only how many
 * they have left. You are shown your own next power, so without this the same
 * screen would quietly hand you everyone else's — the length is public, the
 * contents are not.
 */
function maskState(state: P4State, viewerId: string): P4State {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === viewerId ? p : { ...p, charges: p.charges.map(() => null) },
    ),
  };
}

interface UseP4RoomResult {
  state: P4State | null;
  selfId: string | null;
  isHost: boolean;
  status: ConnectionStatus;
  error: string | null;
  clearError: () => void;
  sendAction: (action: P4Action) => void;
  spectators: Spectator[];
  requestSeat: (want: boolean) => void;
}

/**
 * Same shape as the Scopa room: the host owns the authoritative state, applies
 * every action through the pure engine, and broadcasts the result — masked per
 * recipient, since each player may only see their own charged discs.
 */
export function useP4Room(
  roomCode: string,
  playerName: string,
  isHost: boolean,
  mode: P4Mode,
  variant: P4Variant = 'powers',
  bots: BotSetup | null = null,
): UseP4RoomResult {
  const [state, setState] = useState<P4State | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [spectators, setSpectators] = useState<Spectator[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const hostStateRef = useRef<P4State | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);
  const hostApplyRef = useRef<(action: P4Action) => string | undefined>(() => undefined);

  // Read at connection time only, so retyping a name cannot restart the peer.
  const nameRef = useRef(playerName);
  nameRef.current = playerName;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const modes = variant === 'original' ? ORIGINAL_MODES : MODES;
  const powersEnabled = variant !== 'original';
  const peerPrefix = PEER_PREFIXES[variant];

  useEffect(() => {
    let cancelled = false;
    const code = roomCode.trim().toUpperCase();
    const conns = connsRef.current;

    // Contre des bots : pas de réseau, la table vit dans ce navigateur.
    if (bots) {
      const seats = makeBots(bots);
      const runner = createBotRunner<P4State, P4Action>({
        get: () => hostStateRef.current,
        apply: (action) => hostApplyRef.current(action),
        decide: (s) => p4Decide(s, seats),
      });
      const commit = (next: P4State) => {
        hostStateRef.current = next;
        setState(maskState(next, LOCAL_SELF_ID));
        runner.poke();
      };
      hostApplyRef.current = (action) => {
        if (!hostStateRef.current) return undefined;
        const { state: next, error: err } = applyAction(hostStateRef.current, action, modes, powersEnabled);
        commit(next);
        return err;
      };
      let initial = createInitialState(code, LOCAL_SELF_ID, modeRef.current, modes);
      initial = applyAction(initial, { type: 'JOIN', playerId: LOCAL_SELF_ID, name: nameRef.current, userId: getCurrentUserId() }, modes, powersEnabled).state;
      for (const b of seats) initial = applyAction(initial, { type: 'JOIN', playerId: b.id, name: b.name }, modes, powersEnabled).state;
      setSelfId(LOCAL_SELF_ID);
      commit(applyAction(initial, { type: 'START' }, modes, powersEnabled).state);
      setStatus('connected');
      return () => {
        runner.stop();
        hostApplyRef.current = () => undefined;
      };
    }

    if (isHost) {
      const hostId = peerPrefix + code;
      const peer = new Peer(hostId);
      peerRef.current = peer;

      const broadcast = (next: P4State) => {
        for (const [peerId, conn] of conns) {
          if (conn.open) conn.send({ type: 'STATE', state: maskState(next, peerId) } satisfies WireMessage);
        }
      };

      const commit = (next: P4State) => {
        // The ref keeps the truth; every view of it, the host's included, is masked.
        hostStateRef.current = next;
        setState(maskState(next, hostId));
        broadcast(next);
      };

      const desk = createSpectatorDesk((list) => {
        setSpectators(list);
        for (const conn of conns.values()) {
          if (conn.open) conn.send({ type: 'SPECTATORS', spectators: list } satisfies WireMessage);
        }
      });

      // A rematch is the moment to hand vacated seats to waiting spectators.
      hostApplyRef.current = (action) => {
        const current = hostStateRef.current;
        if (!current) return undefined;
        const run = (s: P4State) => applyAction(s, action, modes, powersEnabled);
        const { state: next, error: err } =
          action.type === 'REMATCH' || action.type === 'START' ? withSeatsFilled(current, desk, run) : run(current);
        commit(next);
        return err;
      };

      peer.on('open', (id) => {
        if (cancelled) return;
        setSelfId(id);
        const initial = applyAction(
          createInitialState(code, id, modeRef.current, modes),
          { type: 'JOIN', playerId: id, name: nameRef.current, userId: getCurrentUserId() },
          modes,
          powersEnabled,
        ).state;
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
          if (!hostStateRef.current) return;
          if (isSeatMessage(data)) {
            desk.setWant(conn.peer, data.want);
            return;
          }
          const msg = data as WireMessage;
          if (msg.type !== 'ACTION') return;

          if (msg.action.type === 'JOIN') {
            const joined = applyAction(hostStateRef.current, { ...msg.action, playerId: conn.peer }, modes, powersEnabled);
            if (joined.state.players.some((p) => p.id === conn.peer)) {
              commit(joined.state);
            } else if (desk.add(conn.peer, msg.action.name)) {
              // Game under way or table full: they watch.
              conn.send({ type: 'SPECTATORS', spectators: desk.list() } satisfies WireMessage);
            } else {
              conn.send({ type: 'ERROR', message: 'Table complète, même pour regarder.' } satisfies WireMessage);
            }
            return;
          }

          // Spectators do not play, and nobody plays for somebody else.
          if (desk.has(conn.peer)) return;
          const err = hostApplyRef.current({ ...msg.action, playerId: conn.peer } as P4Action);
          if (err && conn.open) conn.send({ type: 'ERROR', message: err } satisfies WireMessage);
        });

        conn.on('close', () => {
          conns.delete(conn.peer);
          if (desk.has(conn.peer)) {
            desk.remove(conn.peer);
            return;
          }
          if (!hostStateRef.current) return;
          commit(applyAction(hostStateRef.current, { type: 'LEAVE', playerId: conn.peer }, modes, powersEnabled).state);
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
        const conn = peer.connect(peerPrefix + code, { reliable: true });
        hostConnRef.current = conn;

        conn.on('open', () => {
          conn.send({
            type: 'ACTION',
            action: { type: 'JOIN', playerId: id, name: nameRef.current, userId: getCurrentUserId() },
          } satisfies WireMessage);
          setStatus('connected');
        });
        conn.on('data', (data) => {
          if (isSpectatorsMessage(data)) {
            setSpectators(data.spectators);
            return;
          }
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
      hostApplyRef.current = () => undefined;
    };
  }, [roomCode, isHost, variant, modes, powersEnabled, peerPrefix, bots]);

  const sendAction = useCallback(
    (action: P4Action) => {
      if (isHost) {
        const err = hostApplyRef.current(action);
        if (err) setError(err);
      } else {
        hostConnRef.current?.send({ type: 'ACTION', action } satisfies WireMessage);
      }
    },
    [isHost],
  );

  const requestSeat = useCallback((want: boolean) => {
    hostConnRef.current?.send({ type: 'SEAT', want } satisfies WireMessage);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { state, selfId, isHost, status, error, clearError, sendAction, spectators, requestSeat };
}
