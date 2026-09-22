import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Ruleset } from '../engine/types';

export function RulesModal({ open, onClose, ruleset }: { open: boolean; onClose: () => void; ruleset: Ruleset }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal(); else dialog.current?.close();
    return () => { dialog.current?.close(); };
  }, [open]);
  const official = ruleset === 'official';
  return <dialog ref={dialog} className="f7-rules" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="f7-rules-title">
    <button className="f7-icon f7-close" onClick={onClose} aria-label="Fermer les règles"><X size={20} /></button>
    <p className="f7-eyebrow">LE PLAISIR DU RISQUE</p><h2 id="f7-rules-title">Une carte de plus ?</h2>
    <p>{official ? 'Règles officielles · 94 cartes · Objectif 200 points' : 'Variante PLAFEE · 62 cartes · Manches libres'}</p>
    <div className="f7-rule-block"><b>01 — OUI pour continuer. NON pour assurer.</b><p>{official ? 'Une carte est distribuée à chacun. Puis, à tour de rôle, prends une carte ou arrête pour sécuriser tes points. Après chaque carte, la main passe au joueur actif suivant.' : 'À ton tour, retourne autant de cartes que tu le souhaites. Arrête pour valider tes points et passer la main.'}</p></div>
    <div className="f7-rule-block"><b>02 — Un doublon et tout s’envole.</b><p>Un numéro déjà devant toi annule les points de cette manche. Ton total des manches précédentes reste acquis. {official ? 'Il y a un 0, un 1, deux 2… jusqu’à douze 12. Sept numéros différents ? +15 points et fin immédiate de la manche pour tous.' : 'Il y a un 0, deux 1, trois 2… jusqu’à huit 7. Les cartes bonus ne provoquent jamais de doublon.'}</p></div>
    <div className="f7-rule-grid">
      <div><strong className="f7-orange">×2 / +2 à +10</strong><p>{official ? 'Double la somme des numéros, puis ajoute les bonus. Le +15 de Flip 7 n’est jamais doublé.' : '×2 double le score courant. Les + ajoutent leur valeur immédiatement.'}</p></div>
      <div><strong className="f7-yellow">↻ Flip Three</strong><p>{official ? 'Choisis un joueur actif : il doit tirer trois cartes. Freeze et Flip Three attendent la fin de ces tirages ; un doublon sans protection les annule.' : 'Retire 3 points à ton score courant, sans descendre sous zéro.'}</p></div>
      <div><strong className="f7-blue">❄ Freeze</strong><p>{official ? 'Choisis un joueur actif, toi compris. Ses points sont sécurisés et sa manche s’arrête.' : 'La main passe et tu sautes ta prochaine occasion de jouer. Ta pile et tes points sont conservés.'}</p></div>
      <div><strong className="f7-red">♡ Second Chance</strong><p>{official ? 'Protège d’un doublon : défausse la protection et le numéro en double. Une deuxième protection doit être offerte à un joueur actif qui n’en a pas, sinon elle est défaussée.' : 'Au premier doublon, ta protection est consommée et tu recommences ta pile à zéro, une seule fois par manche.'}</p></div>
    </div>
    <div className="f7-rule-block"><b>03 — Savoir s’arrêter, c’est aussi gagner.</b><p>{official ? 'Quand tous ont arrêté ou perdu, les points sont ajoutés au total. Le meilleur score gagne dès 200 points en fin de manche. En cas d’égalité en tête, on continue. Les cartes déjà jouées sont mises de côté ; elles sont remélangées quand la pioche est vide.' : 'La manche se termine quand tous ont arrêté ou perdu. Le classement se cumule et l’hôte peut lancer autant de manches qu’il le souhaite.'} En solo, les manches sont illimitées.</p></div>
    {official && <a className="f7-source" href="https://theop.games/pages/flip-7-faqs" target="_blank" rel="noreferrer">Consulter la FAQ de l’éditeur ↗</a>}
    <button className="f7-primary" onClick={onClose}>À moi de jouer</button>
  </dialog>;
}
