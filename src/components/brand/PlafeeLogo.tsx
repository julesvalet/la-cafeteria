import type { CSSProperties } from 'react';
import { MARK_FLAMES, MARK_VIEWBOX, WORDMARK_LETTERS, WORDMARK_VIEWBOX } from './plafeeArt';
import './brand.css';

interface Props {
  className?: string;
  /** Nom lu par les lecteurs d'écran ; absent, le dessin est décoratif. */
  title?: string;
  /** S'allume au montage : les flammes, puis les lettres une à une. */
  animated?: boolean;
}

const a11y = (title?: string) =>
  title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const };

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/**
 * Le symbole PLAFEE — le « D » en carrés pivotés — en ligne dans la page :
 * il prend la couleur du texte (`currentColor`) et peut s'allumer flamme par
 * flamme. Pour un simple affichage, `public/brand/plafee-mark.svg` suffit.
 */
export function PlafeeMark({ className, title, animated = false }: Props) {
  return (
    <svg className={cls('plf-mark', animated && 'is-animated', className)} viewBox={MARK_VIEWBOX} fill="currentColor" focusable="false" {...a11y(title)}>
      {MARK_FLAMES.map((d, i) => (
        <path key={i} d={d} className="plf-flame" style={{ '--i': i } as CSSProperties} />
      ))}
    </svg>
  );
}

/** Le lettrage PLAFEE en pastilles, lettre par lettre. */
export function PlafeeWordmark({ className, title, animated = false }: Props) {
  return (
    <svg className={cls('plf-wordmark', animated && 'is-animated', className)} viewBox={WORDMARK_VIEWBOX} fill="currentColor" focusable="false" {...a11y(title)}>
      {WORDMARK_LETTERS.map((d, i) => (
        <path key={i} d={d} className="plf-letter" style={{ '--i': i } as CSSProperties} />
      ))}
    </svg>
  );
}
