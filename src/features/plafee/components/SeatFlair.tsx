import { type CSSProperties, type ReactNode } from 'react';
import { useCosmetics } from '../useCosmetics';
import { useSeatCards } from '../seatCosmetics';

const BOW = `${import.meta.env.BASE_URL}cosmetics/bow.svg`;

/*
 * Les cosmétiques en partie : tout le monde voit ceux des autres. Les jeux
 * connaissent le compte de chaque place (`userId`, annoncé en rejoignant la
 * table) ; ces composants vont chercher le reste.
 */

/** Habille l'avatar d'une place : contour (flammes comprises) et nœud papillon. */
export function SeatFlair({ userId, children, className }: { userId?: string | null; children: ReactNode; className?: string }) {
  const c = useCosmetics(userId ?? null);
  return (
    <span className={`cos-seat${className ? ` ${className}` : ''}`} data-border={c?.border ?? undefined} data-accessory={c?.accessory ?? undefined}>
      {children}
      {c?.accessory === 'bow' && <img className="cos-bow" src={BOW} alt="" draggable={false} />}
    </span>
  );
}

/** Un avatar de place pour les jeux qui n'en dessinent pas : l'initiale, à la couleur du joueur. */
export function SeatAvatar({ userId, name, color, size = 26 }: { userId?: string | null; name: string; color?: string; size?: number }) {
  return (
    <SeatFlair userId={userId}>
      <span className="cos-seat-avatar" style={{ width: size, height: size, fontSize: size * 0.46, '--seat-color': color } as CSSProperties} aria-hidden>
        {name.charAt(0).toUpperCase()}
      </span>
    </SeatFlair>
  );
}

/** Un conteneur de cartes au skin de son joueur (la main d'un adversaire, par exemple). */
export function SeatCards({ userId, className, children }: { userId?: string | null; className?: string; children: ReactNode }) {
  const skin = useSeatCards(userId);
  return (
    <div className={className} data-seat-cards={skin}>
      {children}
    </div>
  );
}
