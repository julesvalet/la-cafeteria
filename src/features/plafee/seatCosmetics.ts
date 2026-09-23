import { useEffect, useRef } from 'react';
import { useCosmetics } from './useCosmetics';
import { celebrate, type VictoryAnim } from './victory';

/* Les cosmétiques des autres joueurs, en partie (voir components/SeatFlair.tsx). */

/** Le skin de cartes d'un joueur, à poser en `data-seat-cards` sur ses cartes (rien s'il a les classiques). */
export function useSeatCards(userId?: string | null): string | undefined {
  const c = useCosmetics(userId ?? null);
  return c?.card_skin && c.card_skin !== 'classic' ? c.card_skin : undefined;
}

/**
 * Quand un autre joueur gagne, tout le monde voit son animation de victoire.
 * `key` identifie la partie (elle change à la revanche) : une animation par
 * victoire, pas une par rendu. Sa propre victoire passe par l'enregistrement
 * de la partie (useRecordGame), avec les FEES gagnés.
 */
export function useOpponentVictory(winner: { userId: string | null | undefined; name: string; key: string } | null) {
  const c = useCosmetics(winner?.userId ?? null);
  const played = useRef<string | null>(null);
  const key = winner?.userId ? winner.key : null;
  const name = winner?.name ?? '';
  const anim = (c?.victory_anim as VictoryAnim | null | undefined) ?? null;
  const loaded = Boolean(c);
  useEffect(() => {
    if (!key || played.current === key) return;
    const fire = () => {
      if (played.current === key) return;
      played.current = key;
      celebrate({ fees: 0, anim: anim ?? 'confetti', winner: name });
    };
    // Ses cosmétiques arrivent d'habitude tout de suite ; sinon, des confettis.
    if (loaded) {
      fire();
      return;
    }
    const t = window.setTimeout(fire, 1500);
    return () => window.clearTimeout(t);
  }, [key, name, anim, loaded]);
}
