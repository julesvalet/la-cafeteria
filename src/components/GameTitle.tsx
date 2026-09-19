import { Fragment } from 'react';
import type { GameTypeId } from '../features/account/types';
import './gameTitle.css';

/**
 * Le nom d'un jeu dans sa typographie : chaque jeu a sa police, sa couleur,
 * ses ornements et sa réaction au survol (voir gameTitle.css).
 *
 * Les ornements (◆ • ● ◇) sont décoratifs : les lecteurs d'écran lisent le nom
 * simple (`label`).
 */
interface TitleSpec {
  label: string;
  /** Ornement de part et d'autre du nom. */
  ornament?: string;
  /** Les mots du nom : la ligne ne se coupe qu'entre eux ; `•` y devient un
   *  point décoratif. */
  parts: string[];
  motto: string;
}

const GAME_TITLES: Record<GameTypeId, TitleSpec> = {
  scopa: { label: 'Scopa', ornament: '◆', parts: ['SCOPA'], motto: 'Le jeu de cartes légendaire' },
  puissance4: { label: 'P4 Forge', parts: ['P•4', 'FORGE'], motto: 'Stratégie & Pouvoirs' },
  'puissance4-original': { label: 'P4 Classic', parts: ['P•4', 'CLASSIC'], motto: 'Classique pur' },
  uno: { label: 'UNO', ornament: '●', parts: ['U', 'N', 'O'], motto: 'Chaos Multicolore' },
  flip7: { label: 'Flip 7', ornament: '◇', parts: ['FLIP•7'], motto: 'Stop ou Encore ?' },
};

interface Props {
  game: GameTypeId;
  /** sm : listes et onglets · md : cartes · lg : tuiles · xl : en-têtes de page. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Affiche la devise du jeu sous son nom. */
  motto?: boolean;
  /** Suffixe en texte simple, ex. « room ABC123 ». */
  suffix?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
}

export function GameTitle({ game, size = 'md', motto = false, suffix, as: Tag = 'span', className }: Props) {
  const spec = GAME_TITLES[game];
  const ornament = spec.ornament && (
    <span className="gt-orn" aria-hidden>
      {spec.ornament}
    </span>
  );
  return (
    <Tag className={`gt${className ? ` ${className}` : ''}`} data-game={game} data-size={size}>
      <span className="gt-name">
        <span className="gt-sr">{spec.label}</span>
        <span className="gt-word" aria-hidden>
          {ornament}
          {spec.parts.map((p, i) => (
            <span key={i} className="gt-part" data-i={i}>
              {p.split('•').map((bit, j) => (
                <Fragment key={j}>
                  {j > 0 && <span className="gt-dot">•</span>}
                  {bit}
                </Fragment>
              ))}
            </span>
          ))}
          {ornament}
        </span>
        {suffix && <span className="gt-suffix">{suffix}</span>}
      </span>
      {motto && <span className="gt-motto">{spec.motto}</span>}
    </Tag>
  );
}
