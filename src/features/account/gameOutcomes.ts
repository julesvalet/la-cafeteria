import type { GameState as ScopaState } from '../scopa/engine/types';
import type { UnoState } from '../uno/engine/types';
import type { P4State } from '../puissance4/engine/types';
import type { PublicState as Flip7State } from '../flip7/engine/types';
import type { GameOutcome } from './recordGame';

/*
 * Traduire la fin d'une partie en ligne de classement.
 *
 * Les quatre dérivations vivent ensemble parce qu'elles partagent un contrat
 * qu'il vaut mieux relire d'un seul coup d'oeil que retrouver éparpillé :
 *
 *   1. Rendre `null` tant que la partie n'est pas finie.
 *   2. Bâtir une `signature` à partir de champs que *tous* les pairs voient à
 *      l'identique. Le masquage réseau ne cache que les mains et les pouvoirs,
 *      jamais le journal ni l'issue — ces champs-là sont donc sûrs.
 *   3. Faire changer cette signature à la revanche, sinon la seconde manche
 *      serait avalée par l'idempotence de la première. `log` et `lastEvent.seq`
 *      survivent au redémarrage dans UNO comme dans Puissance 4 : ils font
 *      d'excellents compteurs de manche.
 *
 * Les dépendances sont uniquement de type, donc effacées à la compilation : ce
 * module ne fait entrer aucun code de jeu dans le bundle des pages de compte.
 */

/** Une égalité ne fait pas de vainqueur — personne ne marque, la partie compte. */
export function scopaOutcome(
  state: ScopaState | null,
  selfId: string | null,
  roomCode: string,
): GameOutcome | null {
  if (!state || state.phase !== 'match-end' || !selfId) return null;

  const me = state.players.findIndex((p) => p.id === selfId);
  if (me === -1) return null;

  const best = Math.max(...state.matchScores);
  const tied = state.matchScores.filter((s) => s === best).length > 1;

  return {
    gameType: 'scopa',
    roomCode,
    playerCount: state.players.length,
    won: !tied && state.matchScores[me] === best,
    score: state.matchScores[me] ?? 0,
    signature: `${state.handNumber}|${state.matchScores.join('-')}`,
  };
}

export function unoOutcome(
  state: UnoState | null,
  selfId: string | null,
  roomCode: string,
): GameOutcome | null {
  if (!state || state.phase !== 'won' || state.winner === null || !selfId) return null;

  const seat = state.players.findIndex((p) => p.id === selfId);
  if (seat === -1) return null;

  return {
    gameType: 'uno',
    roomCode,
    playerCount: state.players.length,
    won: state.winner === seat,
    // UNO ne tient pas de score chiffré : seule l'issue compte.
    score: 0,
    signature: `${state.winner}|${state.lastEvent.seq}|${state.log.length}`,
  };
}

/** Le match nul est enregistré comme une partie sans vainqueur : zéro point, mais elle compte. */
export function p4Outcome(
  state: P4State | null,
  selfId: string | null,
  roomCode: string,
  gameType: 'puissance4' | 'puissance4-original',
): GameOutcome | null {
  if (!state || (state.phase !== 'won' && state.phase !== 'draw') || !selfId) return null;

  const me = state.players.findIndex((p) => p.id === selfId);
  if (me === -1) return null;

  const winningTeam = state.winner?.team ?? null;

  return {
    gameType,
    roomCode,
    playerCount: state.players.length,
    won: winningTeam !== null && state.players[me].team === winningTeam,
    score: 0,
    signature: `${state.phase}|${winningTeam ?? 'nul'}|${state.winner?.cells.join('-') ?? ''}|${state.log.length}`,
  };
}

/**
 * Flip 7 n'enregistre que les parties en ligne.
 *
 * Le mode solo et les parties contre des bots se gagnent à volonté et sans
 * adversaire réel : les compter reviendrait à mettre en tête du classement
 * celui qui a le plus de patience, pas celui qui joue le mieux.
 */
export function flip7Outcome(state: Flip7State | null, selfId: string | null): GameOutcome | null {
  if (!state || state.phase !== 'finished' || !selfId) return null;
  if (state.options.mode !== 'online') return null;

  const me = state.players.findIndex((p) => p.id === selfId);
  if (me === -1) return null;

  return {
    gameType: 'flip7',
    roomCode: state.code,
    playerCount: state.players.length,
    won: state.winnerId === selfId,
    score: state.players[me].total,
    // `id` identifie déjà la partie de façon unique, revanche comprise.
    signature: state.id,
  };
}
