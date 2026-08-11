import { motion } from 'framer-motion';
import { Target, Users, X, Zap } from 'lucide-react';
import { MODES, MODE_ORDER } from '../engine/modes';
import { POWERS, POWER_ORDER } from '../engine/powers';
import { POWER_ICONS } from './powerIcons';

interface P4RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function P4RulesModal({ open, onClose }: P4RulesModalProps) {
  if (!open) return null;

  // Full-screen overlay: unmounted outright rather than animated out, so it can
  // never linger and swallow a click meant for the board.
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
            aria-labelledby="p4-rules-title"
          >
            <div className="p4-modal-header">
              <h2 id="p4-rules-title">Règles du Puissance 4</h2>
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
                  Les jetons tombent au fond de la colonne que tu choisis.
                </p>
              </section>

              <section className="p4-rule-section">
                <h3>
                  <Users size={17} className="p4-rule-icon" /> Modes de jeu
                </h3>
                <ul className="p4-rule-list">
                  {MODE_ORDER.map((id) => {
                    const mode = MODES[id];
                    return (
                      <li key={id}>
                        <strong>{mode.label}</strong> — grille {mode.cols} × {mode.rows}.{' '}
                        {id === 'teams'
                          ? "Les deux coéquipiers jouent chacun leur tour et partagent le même objectif : l'alignement peut mélanger vos deux jetons."
                          : 'Chacun pour soi, le premier à aligner quatre jetons gagne.'}
                      </li>
                    );
                  })}
                </ul>
                <p className="p4-rule-note">
                  Plus il y a de joueurs, plus la grille est grande : à quatre sur une 7 × 6, chaque coup serait
                  forcé avant même que quiconque puisse construire une menace.
                </p>
              </section>

              <section className="p4-rule-section">
                <h3>
                  <Zap size={17} className="p4-rule-icon" /> Pouvoirs spéciaux
                </h3>
                <p>
                  Chaque joueur démarre avec la même réserve, et chaque pouvoir a un nombre d'utilisations limité
                  pour toute la partie. Tout pouvoir <strong>remplace ton tour</strong>, sauf le Double-tour dont
                  l'activation est gratuite.
                </p>
                <ul className="p4-power-rules">
                  {POWER_ORDER.map((id) => {
                    const def = POWERS[id];
                    const Icon = POWER_ICONS[id];
                    return (
                      <li key={id} style={{ '--p4-power-color': def.color } as React.CSSProperties}>
                        <span className="p4-power-rule-icon">
                          <Icon size={18} strokeWidth={1.9} />
                        </span>
                        <span className="p4-power-rule-text">
                          <strong>
                            {def.name}
                            <span className="p4-power-rule-uses">
                              {def.uses} utilisation{def.uses > 1 ? 's' : ''}
                            </span>
                          </strong>
                          {def.long}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="p4-rule-section">
                <h3>Fin de partie</h3>
                <p>
                  La partie s'arrête dès qu'un alignement de 4 est complété — y compris si c'est la gravité qui le
                  complète, après une Destruction ou le retour d'une Inversion. Si le plateau se remplit sans
                  alignement, c'est match nul.
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
    </>
  );
}
