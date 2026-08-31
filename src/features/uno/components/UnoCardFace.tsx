import { COLOR_HEX } from '../engine/deck';
import type { UnoCard, UnoColor } from '../engine/types';

/**
 * A UNO card face, drawn as inline SVG so it stays sharp at any size and can be
 * tinted from the palette rather than shipped as 108 bitmaps.
 *
 * Geometry follows the reference deck: a coloured body, a white rounded border,
 * and the white oval rotated across the middle that carries the big glyph.
 */

const W = 140;
const H = 210;

/** The tilted white ellipse every face is built around. */
function Oval() {
  return <ellipse cx={W / 2} cy={H / 2} rx={46} ry={78} fill="#fff" transform={`rotate(-32 ${W / 2} ${H / 2})`} />;
}

function Body({ color }: { color: string }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} rx={14} fill="#fff" />
      <rect x={7} y={7} width={W - 14} height={H - 14} rx={9} fill={color} />
    </>
  );
}

/** The big central number, in the outlined display style of the real deck. */
function CenterNumber({ value, color }: { value: number; color: string }) {
  return (
    <text
      x={W / 2}
      y={H / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="Georgia, 'Times New Roman', serif"
      fontSize={96}
      fontWeight="700"
      fill={color}
      stroke="#fff"
      strokeWidth={3}
      paintOrder="stroke"
      transform={`rotate(-15 ${W / 2} ${H / 2})`}
    >
      {value}
    </text>
  );
}

function CornerNumber({ value, x, y, flip }: { value: number | string; x: number; y: number; flip?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="Georgia, 'Times New Roman', serif"
      fontSize={26}
      fontWeight="700"
      fill="#fff"
      transform={flip ? `rotate(180 ${x} ${y})` : undefined}
    >
      {value}
    </text>
  );
}

/** Two interlocking arrows — the "reverse" glyph. */
function ReverseGlyph({ color, scale = 1, cx = W / 2, cy = H / 2 }: { color: string; scale?: number; cx?: number; cy?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}>
      <path
        d={`M ${cx - 20} ${cy + 24} L ${cx - 20} ${cy - 10} L ${cx - 32} ${cy - 10} L ${cx - 12} ${cy - 32} L ${cx + 8} ${cy - 10} L ${cx - 4} ${cy - 10} L ${cx - 4} ${cy + 24} Z`}
        fill={color}
        stroke="#fff"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d={`M ${cx + 20} ${cy - 24} L ${cx + 20} ${cy + 10} L ${cx + 32} ${cy + 10} L ${cx + 12} ${cy + 32} L ${cx - 8} ${cy + 10} L ${cx + 4} ${cy + 10} L ${cx + 4} ${cy - 24} Z`}
        fill={color}
        stroke="#fff"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The barred circle used for "skip". */
function SkipGlyph({ color, r = 30, cx = W / 2, cy = H / 2, sw = 9 }: { color: string; r?: number; cx?: number; cy?: number; sw?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth={sw + 5} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} />
      <line
        x1={cx - r * 0.78}
        y1={cy + r * 0.78}
        x2={cx + r * 0.78}
        y2={cy - r * 0.78}
        stroke="#fff"
        strokeWidth={sw + 5}
        strokeLinecap="round"
      />
      <line
        x1={cx - r * 0.78}
        y1={cy + r * 0.78}
        x2={cx + r * 0.78}
        y2={cy - r * 0.78}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Two overlapping rounded rectangles, as on the +2 face. */
function TwoCardsGlyph({ color, cx = W / 2, cy = H / 2, scale = 1 }: { color: string; cx?: number; cy?: number; scale?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy}) rotate(-15 ${cx} ${cy})`}>
      <rect x={cx - 26} y={cy - 30} width={30} height={46} rx={5} fill="#fff" stroke={color} strokeWidth={3} />
      <rect x={cx - 8} y={cy - 18} width={30} height={46} rx={5} fill={color} stroke="#fff" strokeWidth={3} />
    </g>
  );
}

/**
 * The four-colour pinwheel on the two joker faces. Drawn as four true pie
 * slices rather than clipped rectangles — a clipPath would need a document
 * unique id, and several jokers can be on screen at once.
 */
function WildWheel({ cx = W / 2, cy = H / 2, r = 42 }: { cx?: number; cy?: number; r?: number }) {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  const slice = (from: number, to: number) => `M ${cx} ${cy} L ${point(from)} A ${r} ${r} 0 0 1 ${point(to)} Z`;

  const quads: [UnoColor, string][] = [
    ['red', slice(-135, -45)],
    ['blue', slice(-45, 45)],
    ['green', slice(45, 135)],
    ['yellow', slice(135, 225)],
  ];

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#111" />
      {quads.map(([color, d]) => (
        <path key={color} d={d} fill={COLOR_HEX[color]} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth={4} />
    </g>
  );
}

/** The +4 face: four small cards in the four colours. */
function FourCardsGlyph({ cx = W / 2, cy = H / 2 }: { cx?: number; cy?: number }) {
  const cards: [UnoColor, number, number][] = [
    ['red', -16, -22],
    ['blue', 2, -14],
    ['yellow', -16, 2],
    ['green', 2, 10],
  ];
  return (
    <g transform={`rotate(-15 ${cx} ${cy})`}>
      {cards.map(([color, dx, dy]) => (
        <rect
          key={color}
          x={cx + dx - 6}
          y={cy + dy - 6}
          width={26}
          height={38}
          rx={4}
          fill={COLOR_HEX[color]}
          stroke="#fff"
          strokeWidth={2.5}
        />
      ))}
    </g>
  );
}

function CornerGlyph({ card, x, y, flip }: { card: UnoCard; x: number; y: number; flip?: boolean }) {
  const transform = flip ? `rotate(180 ${x} ${y})` : undefined;
  const color = card.color ? COLOR_HEX[card.color] : '#111';

  if (card.kind === 'number') return <CornerNumber value={card.number!} x={x} y={y} flip={flip} />;
  if (card.kind === 'draw2') return <CornerNumber value="+2" x={x} y={y} flip={flip} />;
  if (card.kind === 'wild4') return <CornerNumber value="+4" x={x} y={y} flip={flip} />;
  if (card.kind === 'skip')
    return (
      <g transform={transform}>
        <SkipGlyph color={color} r={9} cx={x} cy={y} sw={3.5} />
      </g>
    );
  if (card.kind === 'reverse')
    return (
      <g transform={transform}>
        <ReverseGlyph color={color} scale={0.3} cx={x} cy={y} />
      </g>
    );
  return null;
}

interface UnoCardFaceProps {
  card: UnoCard;
  /** Overrides the body colour — used to show the chosen colour on a played wild. */
  tint?: UnoColor | null;
  className?: string;
}

export function UnoCardFace({ card, tint, className }: UnoCardFaceProps) {
  const wild = card.kind === 'wild' || card.kind === 'wild4';
  const mystery = card.kind === 'mystery';
  const bodyColor = mystery ? '#2b1a10' : wild ? (tint ? COLOR_HEX[tint] : '#141414') : COLOR_HEX[card.color!];
  const glyphColor = wild ? '#141414' : COLOR_HEX[card.color ?? 'red'];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <Body color={bodyColor} />

      {mystery ? (
        <>
          <Oval />
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={78}
            fontWeight="700"
            fill="#c9975e"
            transform={`rotate(-15 ${W / 2} ${H / 2})`}
          >
            ?
          </text>
        </>
      ) : (
        <>
          <Oval />
          {card.kind === 'number' && <CenterNumber value={card.number!} color={glyphColor} />}
          {card.kind === 'skip' && <SkipGlyph color={glyphColor} />}
          {card.kind === 'reverse' && <ReverseGlyph color={glyphColor} />}
          {card.kind === 'draw2' && <TwoCardsGlyph color={glyphColor} />}
          {card.kind === 'wild' && <WildWheel />}
          {card.kind === 'wild4' && <FourCardsGlyph />}

          <CornerGlyph card={card} x={22} y={26} />
          <CornerGlyph card={card} x={W - 22} y={H - 26} flip />
        </>
      )}
    </svg>
  );
}

/** The shared card back, for opponents' hands and the draw pile. */
export function UnoCardBack({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={W} height={H} rx={14} fill="#fff" />
      <rect x={7} y={7} width={W - 14} height={H - 14} rx={9} fill="#141414" />
      <ellipse cx={W / 2} cy={H / 2} rx={46} ry={78} fill="#d8232a" transform={`rotate(-32 ${W / 2} ${H / 2})`} />
      <text
        x={W / 2}
        y={H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize={40}
        fontWeight="700"
        fill="#f4c500"
        stroke="#fff"
        strokeWidth={2}
        paintOrder="stroke"
        transform={`rotate(-15 ${W / 2} ${H / 2})`}
      >
        UNO
      </text>
    </svg>
  );
}
