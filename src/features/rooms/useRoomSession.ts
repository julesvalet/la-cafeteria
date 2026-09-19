import { useEffect, useRef } from 'react';
import type { GameTypeId } from '../account/types';
import { useSocial } from '../social/useSocial';
import * as api from '../social/api';

/** Le battement qui garde la table dans l'annuaire (la base l'oublie après 90 s). */
const HEARTBEAT_MS = 30_000;

export interface RoomSessionInfo {
  game: GameTypeId;
  code: string;
  isHost: boolean;
  /** Choisi à la création : une table privée n'est jamais annoncée. */
  isPublic: boolean;
  /** Nul tant que la connexion à la table n'est pas établie. */
  role: 'player' | 'spectator' | null;
  status: 'waiting' | 'playing';
  players: number;
  maxPlayers: number;
  spectators: number;
}

/**
 * Une room déclare où se trouve le joueur.
 *
 * Deux effets : le contexte social apprend la table courante (le bouton
 * « Inviter » du panneau d'amis invite alors ici), et la base publie la table
 * aux amis si elle est publique. Rien de tout ça sans compte, ni en statut
 * « hors ligne » : un joueur invisible ne laisse pas de trace.
 *
 * Le jeu lui-même n'en dépend pas : si la base ne répond pas, la partie
 * continue, simplement absente de la liste des sessions.
 */
export function useRoomSession(info: RoomSessionInfo) {
  const { active, myStatus, setCurrentRoom } = useSocial();
  const { game, code, isHost, isPublic, role } = info;
  const latest = useRef(info);
  latest.current = info;

  const visible = active && myStatus !== 'offline' && role !== null;

  useEffect(() => {
    if (!role) return;
    setCurrentRoom({ game, code, isHost, isPublic, role });
    return () => setCurrentRoom(null);
  }, [game, code, isHost, isPublic, role, setCurrentRoom]);

  // Vie de l'annonce : battement régulier, et retrait en quittant la table.
  useEffect(() => {
    if (!visible) return;
    const beat = () => {
      const i = latest.current;
      const call = i.isHost
        ? api.publishRoom({
            game: i.game,
            code: i.code,
            isPublic: i.isPublic,
            status: i.status,
            players: i.players,
            maxPlayers: i.maxPlayers,
            spectators: i.spectators,
          })
        : api.setCurrentRoom(i.game, i.code, i.role ?? 'player');
      call.catch(() => {});
    };
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    return () => {
      window.clearInterval(timer);
      api.leaveCurrentRoom().catch(() => {});
    };
  }, [visible, game, code]);

  // Les changements visibles de la liste (places prises, partie lancée) partent
  // tout de suite, sans attendre le prochain battement — regroupés sur un
  // instant pour ne pas écrire à chaque carte jouée.
  const { status, players, maxPlayers, spectators } = info;
  const first = useRef(true);
  useEffect(() => {
    if (!visible) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const i = latest.current;
      if (i.isHost) {
        api
          .publishRoom({ game: i.game, code: i.code, isPublic: i.isPublic, status, players, maxPlayers, spectators })
          .catch(() => {});
      } else {
        api.setCurrentRoom(i.game, i.code, i.role ?? 'player').catch(() => {});
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [visible, status, players, maxPlayers, spectators, role]);
}
