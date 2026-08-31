import { motion } from 'framer-motion';
import { Gift, Layers, Megaphone, Target, X } from 'lucide-react';
import { MYSTERY_EFFECTS, MYSTERY_ORDER } from '../engine/deck';
import { UNO_PENALTY } from '../engine/rules';

interface UnoRulesModalProps {
  open: boolean;
  onClose: () => void;
  stackingEnabled?: boolean;
  mysteryEnabled?: boolean;
}

export function UnoRulesModal({ open, onClose, stackingEnabled, mysteryEnabled }: UnoRulesModalProps) {
  if (!open) return null;

  // Full-screen overlay: unmounted outright rather than animated out, so it can
  // never linger and swallow a click meant for the table.
  return (
    <motion.div className="p4-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <motion.div
        className="p4-modal p4-rules-modal"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="uno-rules-title"
      >
        <div className="p4-modal-header">
          <h2 id="uno-rules-title">Règles du UNO</h2>
          <button type="button" className="p4-modal-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="p4-modal-body">
          <section className="p4-rule-section">
            <h3>
              <Target size={17} className="p4-rule-icon" /> Objectif
            </h3>
            <p>
              Débarrasse-toi de toutes tes cartes avant les autres. À ton tour, pose une carte de la{' '}
              <strong>même couleur</strong> ou du <strong>même symbole</strong> que celle du dessus de la pile, ou un
              joker. Si tu n'as rien à jouer, tu pioches une carte — et tu peux la jouer aussitôt si elle correspond.
            </p>
            <ul className="p4-rule-list">
              <li>
                <strong>Cartes numérotées (0-9)</strong> — dans les quatre couleurs.
              </li>
              <li>
                <strong>+2</strong> — le joueur suivant pioche 2 cartes et passe son tour.
              </li>
              <li>
                <strong>Passe ton tour</strong> — le joueur suivant est sauté.
              </li>
              <li>
                <strong>Inversion</strong> — le sens du jeu change. À deux joueurs, elle agit comme un « passe ton
                tour ».
              </li>
              <li>
                <strong>Changement de couleur</strong> — se joue sur n'importe quoi, tu choisis la nouvelle couleur.
              </li>
              <li>
                <strong>+4 joker</strong> — tu choisis la couleur et le joueur suivant pioche 4 cartes.
              </li>
            </ul>
            <p className="p4-rule-note">
              Aucune aide à l'écran : les cartes jouables ne sont pas mises en avant, c'est à toi de repérer tes coups.
            </p>
          </section>

          <section className="p4-rule-section">
            <h3>
              <Layers size={17} className="p4-rule-icon" /> Surenchère des +
              <span className="uno-rule-flag">{stackingEnabled ? 'activée' : 'désactivée'}</span>
            </h3>
            {stackingEnabled ? (
              <p>
                Quand quelqu'un pose un +2, tu peux répondre par un autre +2 ou un +4 pour faire grimper la pile au
                lieu de piocher : +2 → +2 → +4 fait <strong>8 cartes</strong> pour le premier qui ne peut plus
                surenchérir. Tant que la pile est en cours, seuls les +2 et les +4 sont jouables.
              </p>
            ) : (
              <p>
                Règles standard : pas de cumul. Un +2 ou un +4 se pioche immédiatement, et le joueur pénalisé passe
                son tour. L'hôte peut activer la surenchère avant de lancer la partie.
              </p>
            )}
          </section>

          <section className="p4-rule-section">
            <h3>
              <Gift size={17} className="p4-rule-icon" /> Cartes mystère
              <span className="uno-rule-flag">{mysteryEnabled === false ? 'hors duel' : '2 dans la pioche'}</span>
            </h3>
            <p>
              Deux cartes mystère sont mélangées au hasard dans la pioche en début de partie. Elles ne se jouent pas :
              dès que quelqu'un en <strong>pioche</strong> une, elle se révèle, son effet se déclenche aussitôt et
              tout le monde en est averti. Impossible de savoir quand elles vont tomber.
            </p>
            <ul className="p4-rule-list">
              {MYSTERY_ORDER.map((id) => (
                <li key={id}>
                  <strong>{MYSTERY_EFFECTS[id].label}</strong> — {MYSTERY_EFFECTS[id].description}
                </li>
              ))}
            </ul>
            <p className="p4-rule-note">
              En 1 v 1 il n'y a pas de carte mystère : sans public, la surprise n'a aucun intérêt.
            </p>
          </section>

          <section className="p4-rule-section">
            <h3>
              <Megaphone size={17} className="p4-rule-icon" /> UNO et Contre UNO
            </h3>
            <p>
              <strong>UNO</strong> — quand il ne te reste qu'<strong>une seule carte</strong>, tu dois cliquer le
              bouton UNO avant de jouer ton dernier coup. Bien annoncé, il ne se passe rien : c'est le protocole. Si
              tu l'oublies et que tu poses quand même, tu prends <strong>+{UNO_PENALTY} cartes</strong>.
            </p>
            <p className="p4-rule-note">
              Rien ne t'empêche de crier UNO n'importe quand — toute la table voit l'annonce, et c'est fait pour.
              Mais un cri lancé avec plusieurs cartes en main ne te <em>protège</em> pas : il ne compte pas comme
              une annonce, et tu restes dénonçable une fois vraiment descendu à une carte.
            </p>
            <p>
              <strong>Contre UNO</strong> — à tout moment, tu peux dénoncer un adversaire qui n'a qu'une carte sans
              avoir annoncé. Si tu le prends sur le fait, <strong>c'est lui</strong> qui pioche +{UNO_PENALTY}. Mais
              si personne n'était en faute, c'est <strong>toi</strong> qui prends +{UNO_PENALTY}. À double tranchant :
              sois sûr de toi.
            </p>
          </section>

          <section className="p4-rule-section">
            <h3>Fin de partie</h3>
            <p>
              Le premier joueur à poser sa dernière carte remporte la partie. Si la pioche se vide, la défausse est
              remélangée pour la reconstituer.
            </p>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
