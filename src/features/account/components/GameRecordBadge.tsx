import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Flame, Loader2, Trophy } from 'lucide-react';
import type { RecordState } from '../useRecordGame';

/**
 * Ce que l'enregistrement d'une partie a donné, en une ligne.
 *
 * Glissé dans l'écran de fin de chaque jeu, il ne doit jamais voler la vedette
 * au résultat : un échec d'enregistrement se mentionne, il n'alarme pas — la
 * partie a bien eu lieu, et c'est elle qui compte pour les joueurs autour de
 * la table.
 */
export function GameRecordBadge({ state }: { state: RecordState }) {
  if (state.kind === 'idle') return null;

  if (state.kind === 'anonymous') {
    return (
      <p className="game-record" data-tone="muted">
        <Link to="/connexion">Connecte-toi</Link> pour enregistrer tes parties et tes points.
      </p>
    );
  }

  if (state.kind === 'saving') {
    return (
      <p className="game-record" data-tone="muted" role="status">
        <Loader2 size={14} className="neon-spin" aria-hidden /> Enregistrement…
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <p className="game-record" data-tone="warn" role="status">
        <AlertTriangle size={14} aria-hidden /> Partie non enregistrée ({state.message})
      </p>
    );
  }

  if (state.already) {
    return (
      <p className="game-record" data-tone="muted" role="status">
        <Check size={14} aria-hidden /> Partie déjà enregistrée.
      </p>
    );
  }

  if (state.points === 0) {
    return (
      <p className="game-record" data-tone="muted" role="status">
        <Check size={14} aria-hidden /> Partie enregistrée.
      </p>
    );
  }

  return (
    <p className="game-record" data-tone="win" role="status">
      <Trophy size={14} aria-hidden />
      <strong>+{state.points} points</strong>
      {state.streakBonus && (
        <span className="game-record-streak">
          <Flame size={13} aria-hidden /> série de {state.streak}
        </span>
      )}
    </p>
  );
}
