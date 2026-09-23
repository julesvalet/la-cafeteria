/*
 * L'annonce d'une victoire, que VictoryFx (monté une fois dans App) joue avec
 * l'animation équipée. Un simple événement du navigateur : les jeux n'ont pas
 * à connaître l'animation.
 */

export type VictoryAnim = 'confetti' | 'fireworks' | 'pixels' | 'hologram';

export interface VictoryDetail {
  fees: number;
  streak?: number;
  /** Pour l'aperçu de la boutique : impose une animation. */
  anim?: VictoryAnim;
  preview?: boolean;
}

export function celebrate(detail: VictoryDetail) {
  window.dispatchEvent(new CustomEvent<VictoryDetail>('plafee:victory', { detail }));
}
