import { Link } from 'react-router-dom';
import { Armchair, Eye, LogOut, X } from 'lucide-react';
import type { Spectator } from './spectators';

/**
 * Le bandeau d'observation, commun aux cinq jeux.
 *
 * Pour un observateur : le badge, la place à réserver, la sortie. Pour les
 * joueurs : qui regarde. Il ne s'affiche que s'il y a quelqu'un dans les
 * gradins — une table sans public reste exactement comme avant.
 */
export function ObserverBar({
  spectators,
  selfId,
  isSpectator,
  vacated,
  onSeat,
  exitTo,
  variant = 'light',
}: {
  spectators: Spectator[];
  selfId: string | null;
  isSpectator: boolean;
  /** Sièges laissés par des joueurs partis, que la prochaine manche redonnera. */
  vacated: number;
  onSeat: (want: boolean) => void;
  exitTo: string;
  /** Flip 7 se joue sur un tapis sombre. */
  variant?: 'light' | 'casino';
}) {
  if (!isSpectator && spectators.length === 0) return null;

  const me = spectators.find((s) => s.id === selfId);
  const others = spectators.filter((s) => s.id !== selfId);

  return (
    <div className="obs-bar" data-variant={variant} role="region" aria-label="Observation">
      {isSpectator && (
        <div className="obs-self">
          <span className="obs-badge">
            <Eye size={14} aria-hidden /> Observation
          </span>
          <p className="obs-text">
            {me?.wantsSeat
              ? vacated > 0
                ? 'Une place s’est libérée : tu la prendras au début de la prochaine manche.'
                : 'Tu prendras la première place qui se libère.'
              : 'Tu regardes la partie. Les mains des joueurs restent cachées.'}
          </p>
          <div className="obs-actions">
            {me?.wantsSeat ? (
              <button type="button" className="obs-btn" onClick={() => onSeat(false)}>
                <X size={14} aria-hidden /> Rester spectateur
              </button>
            ) : (
              <button type="button" className="obs-btn" data-tone="primary" onClick={() => onSeat(true)}>
                <Armchair size={14} aria-hidden /> Rejoindre la manche suivante
              </button>
            )}
            <Link to={exitTo} className="obs-btn">
              <LogOut size={14} aria-hidden /> Quitter
            </Link>
          </div>
        </div>
      )}
      {others.length > 0 && (
        <p className="obs-list">
          <Eye size={13} aria-hidden />
          <span>Observateurs :</span>
          {others.map((s, i) => (
            <em key={s.id}>
              {s.name}
              {s.wantsSeat && <span className="obs-waiting"> (attend une place)</span>}
              {i < others.length - 1 ? ', ' : ''}
            </em>
          ))}
        </p>
      )}
    </div>
  );
}
