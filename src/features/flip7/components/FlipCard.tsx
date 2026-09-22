import { cardLabel } from '../engine/deck';
import type { Card } from '../engine/types';
import { MARK_FLAMES } from '../../../components/brand/plafeeArt';

/** Les numéros en couleurs néon, lisibles sur le carton noir. Le 7 porte le vert PLAFEE. */
const COLORS = ['#ff4fa3', '#c49bff', '#e6f53d', '#ff5f7e', '#3fe6ff', '#7dffb2', '#e36bff', '#50ff4d', '#ffd23f', '#ff9f1c', '#ff4d4d', '#6ea8ff', '#b8a1ff'];
const NAMES = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE'];

const PIXEL = "'Press Start 2P', monospace";
const SILK = 'Silkscreen, monospace';
/** Le symbole de la charte (288,8 × 501,7), réduit pour le dos de carte. */
const MARK = MARK_FLAMES.join('');
const MARK_SCALE = 70 / 501.7;
const MARK_X = 60 - (288.8 * MARK_SCALE) / 2;

/** Taille du grand chiffre : Press Start 2P dessine chaque signe sur 1 em de large. */
function numeral(label: string) {
  const size = label.length > 2 ? 30 : label.length > 1 ? 44 : 64;
  // Ligne de base : centre à y ≈ 100, capitales hautes de 7/8 em.
  return { size, y: 100 + size * 0.44 };
}

/** Carte vectorielle originale : cadre art déco, carton noir et chiffres néon. */
export function FlipCard({ card, back = false, className = '' }: { card?: Card; back?: boolean; className?: string }) {
  const kind = card?.kind ?? 'number';
  const special = kind === 'freeze' || kind === 'chance' || kind === 'flip3';
  const accent = back ? '#50ff4d' : kind === 'number' ? COLORS[card?.value ?? 7]
    : kind === 'freeze' ? '#3fe6ff' : kind === 'chance' ? '#ff5f7e' : kind === 'flip3' ? '#e6f53d' : '#ffae3d';
  // Les cartes spéciales restent pleines de couleur : on les repère de loin.
  const paper = special ? accent : '#0e0e0e';
  const ink = special ? '#0d0d0d' : accent;
  const label = back ? 'Dos de carte Flip 7' : card ? cardLabel(card) : 'Carte';
  const big = numeral(label);
  return <svg className={`f7-card ${className}`} viewBox="0 0 120 180" role="img" aria-label={label}>
    <title>{label}</title>
    <rect x="1" y="1" width="118" height="178" rx="7" fill={paper} stroke={special ? '#0d0d0d' : accent} strokeWidth="2" />
    <path d="M12 8H108V16H113V164H108V172H12V164H7V16H12Z" fill="none" stroke={ink} strokeOpacity={special ? 0.55 : 0.5} strokeWidth=".8" />
    <path d="M16 13H104V21H109V159H104V167H16V159H11V21H16Z" fill="none" stroke={ink} strokeOpacity={special ? 0.4 : 0.3} strokeWidth=".7" />
    {[0, 180].map(rotation => <g key={rotation} transform={`rotate(${rotation} 60 90)`}>
      <path d="M37 1A23 17 0 0 0 83 1M42 1A18 12 0 0 0 78 1" fill="none" stroke={ink} strokeWidth="4" opacity={special ? 0.5 : 0.8} />
      <path d="M0 64L12 71L4 56L17 68L13 50L22 68L23 49L28 70L34 54L32 77L38 64L33 85L0 94Z" fill={ink} opacity={special ? 0.22 : 0.5} />
      <path d="M7 20H17V10M103 10V20H113" fill="none" stroke={ink} strokeWidth="1" opacity=".8" />
    </g>)}
    {back ? <>
      <text x="60" y="37" textAnchor="middle" fill="#a6ffa3" fontFamily={SILK} fontWeight="700" fontSize="9" letterSpacing="2">PLAFEE</text>
      <path d={MARK} fill="#50ff4d" transform={`translate(${MARK_X.toFixed(2)} 46) scale(${MARK_SCALE.toFixed(4)})`} />
      <text x="60" y="146" textAnchor="middle" fill="#00ffff" fontFamily={PIXEL} fontSize="12">FLIP 7</text>
    </> : special ? <>
      <text x="60" y="57" textAnchor="middle" fill="#0d0d0d" fontSize="30">{kind === 'freeze' ? '❄' : kind === 'chance' ? '♡' : '↻'}</text>
      <g transform="rotate(-12 60 100)">
        <path d="M4 77H116V104H4ZM4 109H116V136H4Z" fill="#0d0d0d" />
        <text x="60" y="96" textAnchor="middle" fill={accent} fontFamily={PIXEL} fontSize={kind === 'chance' ? 11 : 13}>{kind === 'freeze' ? 'FREEZE' : kind === 'chance' ? 'SECOND' : 'FLIP'}</text>
        <text x="60" y="128" textAnchor="middle" fill={accent} fontFamily={PIXEL} fontSize={kind === 'chance' ? 11 : 13}>{kind === 'freeze' ? 'STOP' : kind === 'chance' ? 'CHANCE' : 'THREE'}</text>
      </g>
    </> : <>
      <text x="60" y="37" textAnchor="middle" fill={accent} fillOpacity=".8" fontFamily={SILK} fontWeight="700" fontSize="6.5" letterSpacing="1">{kind === 'number' ? 'OSE UNE CARTE DE PLUS' : 'LE PETIT COUP DE POUCE'}</text>
      <text x="60" y={big.y} textAnchor="middle" fill={accent} stroke="#000" strokeWidth="3" paintOrder="stroke" fontFamily={PIXEL} fontSize={big.size}>{label}</text>
      <path d="M9 145H111V164H9Z" fill={accent} fillOpacity=".12" stroke={accent} strokeOpacity=".7" strokeWidth=".8" />
      <text x="60" y="158.5" textAnchor="middle" fill={accent} fontFamily={SILK} fontWeight="700" fontSize="10" letterSpacing="1.5">{kind === 'number' ? NAMES[card?.value ?? 0] : kind === 'double' ? 'DOUBLE' : 'BONUS'}</text>
    </>}
  </svg>;
}
