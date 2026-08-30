import { motion } from 'framer-motion';
import { Target, Users, X } from 'lucide-react';
import { ORIGINAL_MODES, MODE_ORDER } from '../engine/modes';

interface OriginalRulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function OriginalRulesModal({ open, onClose }: OriginalRulesModalProps) {
  if (!open) return null;

  return (
    <>
        <motion.div
          className="p4-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
        >
          <motion.div
            className="p4-modal p4-rules-modal"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="p4o-rules-title"
          >
            <div className="p4-modal-header">
              <h2 id="p4o-rules-title">Règles du Puissance 4 Original</h2>
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
                  Aligne <strong>4 jetons</strong> de ta couleur — horizontalement, verticalement ou en diagonale.
                  Les jetons tombent au fond de la colonne que tu choisis. Le Puissance 4 classique, sans surprise.
                </p>
              </section>

              <section className="p4-rule-section">
                <h3>
                  <Users size={17} className="p4-rule-icon" /> Modes de jeu
                </h3>
                <ul className="p4-rule-list">
                  {MODE_ORDER.map((id) => {
                    const cfg = ORIGINAL_MODES[id];
                    return (
                      <li key={id}>
                        <strong>{cfg.label}</strong> — grille {cfg.cols} × {cfg.rows}.{' '}
                        {id === 'teams'
                          ? "Les deux coéquipiers jouent chacun leur tour et partagent le même objectif : l'alignement peut mélanger vos deux jetons."
                          : 'Chacun pour soi, le premier à aligner quatre jetons gagne.'}
                      </li>
                    );
                  })}
                </ul>
                <p className="p4-rule-note">
                  Même grille standard 7 × 6 quel que soit le nombre de joueurs — aucun pouvoir, aucun jeton chargé.
                </p>
              </section>

              <section className="p4-rule-section">
                <h3>Fin de partie</h3>
                <p>
                  La partie s'arrête dès qu'un alignement de 4 est complété. Match nul si le plateau se remplit sans
                  qu'aucun alignement n'ait été fait.
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
    </>
  );
}
