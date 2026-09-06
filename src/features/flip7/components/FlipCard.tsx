import { cardLabel } from '../engine/deck';
import type { Card } from '../engine/types';

const COLORS = ['#cf427d', '#9c80b4', '#b7bd30', '#e45676', '#32abb6', '#4fba69', '#b753aa', '#cf8275', '#8eba76', '#eea130', '#e84c50', '#668bc2', '#9683aa'];
const NAMES = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE'];

/** Original vector artwork: art-deco frame, cream stock and a coloured fan motif. */
export function FlipCard({ card, back = false, className = '' }: { card?: Card; back?: boolean; className?: string }) {
  const kind = card?.kind ?? 'number';
  const special = kind === 'freeze' || kind === 'chance' || kind === 'flip3';
  const accent = back ? '#d7af50' : kind === 'number' ? COLORS[card?.value ?? 7]
    : kind === 'freeze' ? '#47bed4' : kind === 'chance' ? '#ed7167' : kind === 'flip3' ? '#e7cd3c' : '#efa92e';
  const paper = back ? '#173b32' : kind === 'number' ? '#f5e9ba' : accent;
  const label = back ? 'Dos de carte Flip 7' : card ? cardLabel(card) : 'Carte';
  return <svg className={`f7-card ${className}`} viewBox="0 0 120 180" role="img" aria-label={label}>
    <title>{label}</title>
    <rect x="1" y="1" width="118" height="178" rx="7" fill={paper} stroke="#d8c797" strokeWidth="2" />
    <path d="M12 8H108V16H113V164H108V172H12V164H7V16H12Z" fill="none" stroke={back ? accent : '#574c64'} strokeWidth=".8" />
    <path d="M16 13H104V21H109V159H104V167H16V159H11V21H16Z" fill="none" stroke={back ? accent : '#574c64'} strokeWidth=".7" />
    {[0, 180].map(rotation => <g key={rotation} transform={`rotate(${rotation} 60 90)`}>
      <path d="M37 1A23 17 0 0 0 83 1M42 1A18 12 0 0 0 78 1" fill="none" stroke={accent} strokeWidth="4" />
      <path d="M0 64L12 71L4 56L17 68L13 50L22 68L23 49L28 70L34 54L32 77L38 64L33 85L0 94Z" fill={accent} stroke={back ? '#e6d099' : '#685b74'} strokeWidth=".6" opacity=".85" />
      <path d="M7 20H17V10M103 10V20H113" fill="none" stroke={back ? accent : '#685b74'} strokeWidth="1" />
    </g>)}
    {back ? <>
      <path d="M30 44L60 27L90 44V136L60 153L30 136Z" fill="none" stroke={accent} strokeWidth="1" />
      <text x="60" y="65" textAnchor="middle" fill="#efd796" fontSize="9" letterSpacing="3">LA CAFÉTÉRIA</text>
      <text x="60" y="99" textAnchor="middle" fill="#f6e9bd" fontFamily="Georgia,serif" fontWeight="bold" fontSize="30" fontStyle="italic">FLIP</text>
      <text x="60" y="131" textAnchor="middle" fill={accent} fontFamily="Georgia,serif" fontWeight="bold" fontSize="42">7</text>
    </> : special ? <>
      <text x="60" y="57" textAnchor="middle" fill="#554760" fontSize="30">{kind === 'freeze' ? '❄' : kind === 'chance' ? '♡' : '↻'}</text>
      <g transform="rotate(-12 60 100)">
        <path d="M4 77H116V104H4ZM4 109H116V136H4Z" fill="#fbefd0" stroke="#65586a" strokeWidth="1" />
        <text x="60" y="97" textAnchor="middle" fill="#51465d" fontSize={kind === 'chance' ? 17 : 21} fontFamily="Georgia,serif" fontWeight="bold" letterSpacing="2">{kind === 'freeze' ? 'FREEZE' : kind === 'chance' ? 'SECOND' : 'FLIP'}</text>
        <text x="60" y="129" textAnchor="middle" fill="#51465d" fontSize={kind === 'chance' ? 18 : 19} fontFamily="Georgia,serif" fontWeight="bold" letterSpacing="2">{kind === 'freeze' ? 'STOP' : kind === 'chance' ? 'CHANCE' : 'THREE'}</text>
      </g>
    </> : <>
      <text x="60" y="35" textAnchor="middle" fill="#65586a" fontSize="5.5" letterSpacing="1.6">{kind === 'number' ? 'OSE UNE CARTE DE PLUS' : 'LE PETIT COUP DE POUCE'}</text>
      <text x="60" y="132" textAnchor="middle" fill={kind === 'number' ? accent : '#e99782'} stroke="#53465f" strokeWidth="2.6" paintOrder="stroke" fontFamily="Impact, 'Arial Narrow', sans-serif" fontSize={label.length > 2 ? 57 : 87} fontWeight="bold">{label}</text>
      <text x="60" y="132" textAnchor="middle" fill="none" stroke="#fff4d2" strokeWidth=".7" fontFamily="Impact, 'Arial Narrow', sans-serif" fontSize={label.length > 2 ? 57 : 87} fontWeight="bold">{label}</text>
      <path d="M9 145H111V164H9Z" fill="#fbefd0" stroke="#65586a" strokeWidth=".8" />
      <text x="60" y="158" textAnchor="middle" fill="#65586a" fontSize="10" fontFamily="Georgia,serif" fontWeight="bold" letterSpacing="1.8">{kind === 'number' ? NAMES[card?.value ?? 0] : kind === 'double' ? 'DOUBLE' : 'BONUS'}</text>
    </>}
  </svg>;
}
