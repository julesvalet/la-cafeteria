import { AnimatePresence, motion } from 'framer-motion';
import { Target, X, Coins } from 'lucide-react';
import { PlayingCard } from './PlayingCard';
import type { CardT } from '../engine/types';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

function c(id: string, suit: CardT['suit'], rank: number): CardT {
  return { id, suit, rank };
}

export function RulesModal({ open, onClose }: RulesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scopa-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="scopa-modal scopa-rules-modal"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="scopa-modal-header">
              <h2>Règles du Scopa</h2>
              <button type="button" className="scopa-modal-close" onClick={onClose} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="scopa-modal-body">
              <section className="scopa-rule-section">
                <h3>
                  <Target size={17} className="scopa-rule-icon" /> Objectif
                </h3>
                <p>
                  Sois le premier à atteindre <strong>11 points</strong>, cumulés sur plusieurs manches, en capturant
                  des cartes sur la table.
                </p>
              </section>

              <section className="scopa-rule-section">
                <h3>1. Capture simple</h3>
                <p>Si une carte de la table a la même valeur que la carte jouée, tu la captures.</p>
                <div className="scopa-rule-example">
                  <div className="scopa-rule-group">
                    <span className="scopa-rule-tag">Ta carte</span>
                    <PlayingCard card={c('ex-1', 'spade', 7)} small />
                  </div>
                  <span className="scopa-rule-arrow">+</span>
                  <div className="scopa-rule-group">
                    <span className="scopa-rule-tag">Sur la table</span>
                    <PlayingCard card={c('ex-2', 'denari', 7)} small />
                  </div>
                  <span className="scopa-rule-arrow">→</span>
                  <div className="scopa-rule-group">
                    <span className="scopa-rule-tag">Ta pile</span>
                    <PlayingCard card={c('ex-1b', 'spade', 7)} small />
                    <PlayingCard card={c('ex-2b', 'denari', 7)} small />
                  </div>
                </div>
              </section>

              <section className="scopa-rule-section">
                <h3>2. Capture par somme</h3>
                <p>Tu peux aussi capturer plusieurs cartes de la table si leur somme égale la valeur de ta carte.</p>
                <div className="scopa-rule-example">
                  <div className="scopa-rule-group">
                    <span className="scopa-rule-tag">Ta carte</span>
                    <PlayingCard card={c('ex-3', 'coppe', 8)} small />
                  </div>
                  <span className="scopa-rule-arrow">+</span>
                  <div className="scopa-rule-group">
                    <span className="scopa-rule-tag">3 + 5 sur la table</span>
                    <PlayingCard card={c('ex-4', 'bastoni', 3)} small />
                    <PlayingCard card={c('ex-5', 'spade', 5)} small />
                  </div>
                  <span className="scopa-rule-arrow">→</span>
                  <div className="scopa-rule-group">
                    <span className="scopa-rule-tag">Ta pile</span>
                    <PlayingCard card={c('ex-3b', 'coppe', 8)} small />
                    <PlayingCard card={c('ex-4b', 'bastoni', 3)} small />
                    <PlayingCard card={c('ex-5b', 'spade', 5)} small />
                  </div>
                </div>
                <p className="scopa-rule-note">
                  Les figures valent : Fante (F) = 8, Cavallo (C) = 9, Re (R) = 10. Si une capture est possible, elle
                  est <strong>obligatoire</strong> — impossible de poser la carte sans capturer. À toi de repérer les
                  combinaisons sur la table !
                </p>
              </section>

              <section className="scopa-rule-section">
                <h3>3. Scopa</h3>
                <p>
                  Si ta capture vide complètement la table, c'est une <strong>Scopa</strong> ! Elle rapporte 1 point
                  bonus immédiat, en plus des points de fin de manche.
                </p>
              </section>

              <section className="scopa-rule-section">
                <h3>4. Décompte de fin de manche</h3>
                <p>Quand toutes les cartes ont été jouées, les points suivants sont attribués :</p>
                <ul className="scopa-rule-list">
                  <li>
                    <strong>Carte</strong> — 1 pt au joueur avec le plus de cartes capturées.
                  </li>
                  <li>
                    <strong>Denari</strong> — 1 pt au joueur avec le plus de cartes de la couleur Denari (
                    <Coins size={13} className="scopa-rule-icon" />).
                  </li>
                  <li>
                    <strong>Settebello</strong> — 1 pt à qui a capturé le 7 de Denari.
                  </li>
                  <li>
                    <strong>Primiera</strong> — 1 pt à la meilleure combinaison (7 &gt; 6 &gt; 1 &gt; 5 &gt; 4 &gt; 3 &gt;
                    2 &gt; figures, un par couleur).
                  </li>
                  <li>
                    <strong>Scope</strong> — 1 pt par Scopa réalisée pendant la manche.
                  </li>
                </ul>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
