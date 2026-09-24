const BOW = `${import.meta.env.BASE_URL}cosmetics/bow.svg`;

/**
 * L'accessoire posé sur une photo (rayon Accessoires de la boutique), sur le
 * profil comme en partie. Le nœud est une image ; les fleurs, un fond CSS
 * (styles/plafee-v2.css) pour passer à leur version fixe quand les animations
 * sont coupées.
 */
export function AvatarAccessory({ id }: { id: string | null | undefined }) {
  if (id === 'bow') return <img className="cos-bow" src={BOW} alt="" draggable={false} />;
  if (id === 'flowers') return <span className="cos-flowers" aria-hidden />;
  return null;
}
