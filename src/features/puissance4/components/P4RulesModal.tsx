import { motion } from 'framer-motion';
import { Dices, Target, Users, X } from 'lucide-react';
import { MODES, MODE_ORDER } from '../engine/modes';
import { POWERS, POWER_ORDER } from '../engine/powers';
import { POWER_ICONS } from './powerIcons';
import type { P4Mode } from '../engine/types';

interface P4RulesModalProps {
  open: boolean;
  onClose: () => void;
  /** Makes the disc counts concrete for the mode being played. */
  mode?: P4Mode;
}

export function P4RulesModal({ open, onClose, mode = 'duel' }: P4RulesModalProps) {
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
                    const cfg = MODES[id];
                    return (
                      <li key={id}>
                        <strong>{cfg.label}</strong> — grille {cfg.cols} × {cfg.rows}, {cfg.discs} jetons chacun.{' '}
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
                  <Dices size={17} className="p4-rule-icon" /> Des jetons chargés, pas des pouvoirs à choisir
                </h3>
                <p>
                  Tu ne choisis <strong>jamais</strong> un pouvoir. En début de partie, chaque joueur reçoit sa
                  réserve de jetons pour toute la partie ({MODES[mode].discs} en {MODES[mode].label}), et une petite
                  minorité d'entre eux — environ un sur quatre, tiré au hasard — est <strong>chargée</strong> d'un
                  pouvoir. Ni toi ni personne ne décide lequel ni où.
                </p>
                <p>
                  Tu joues donc toujours de la même façon : tu choisis une colonne, ton prochain jeton tombe. Si ce
                  jeton-là était chargé, son pouvoir se déclenche à l'impact.
                </p>
                <p className="p4-rule-note">
                  <strong>Tu vois ton prochain jeton à l'avance</strong>, sous le plateau : tu sais s'il est
                  ordinaire ou chargé, et de quel pouvoir. C'est volontaire — tu ne choisis pas <em>quel</em>
                  pouvoir te tombe dessus, mais tu choisis <em>quand et où</em> le dépenser. La Traversée change
                  d'ailleurs l'endroit où ton jeton se pose : te la révéler après coup retournerait ton propre coup
                  contre toi. En revanche, les jetons des adversaires te restent cachés.
                </p>
                <p>
                  Trois pouvoirs demandent une cible. Dans ce cas, <strong>une fois le jeton posé</strong>, le
                  plateau te laisse désigner ta cible — et rien d'autre. S'il n'y a aucune cible valable, le pouvoir
                  se perd.
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
                              {def.target === 'none' ? 'automatique' : 'à viser'}
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
                  complète, après une Destruction ou le retour d'une Inversion. Match nul si le plateau se remplit,
                  ou si tout le monde a épuisé sa réserve de jetons sans aligner quoi que ce soit.
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
    </>
  );
}
