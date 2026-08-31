import type { UnoCard, UnoColor, UnoMysteryEffect } from './types';

export const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

export const COLOR_LABEL: Record<UnoColor, string> = {
  red: 'Rouge',
  yellow: 'Jaune',
  green: 'Vert',
  blue: 'Bleu',
};

/** Card face colours, matching the reference deck. */
export const COLOR_HEX: Record<UnoColor, string> = {
  red: '#d8232a',
  yellow: '#f4c500',
  green: '#1a9c4b',
  blue: '#0a6cb8',
};

export const MYSTERY_EFFECTS: Record<UnoMysteryEffect, { label: string; description: string }> = {
  draw10: {
    label: 'Avalanche',
    description: 'Tu piochais une carte, tu en prends dix. Bon courage.',
  },
  draw8: {
    label: 'Déluge',
    description: 'Huit cartes de plus dans ta main. Ça pique.',
  },
  colorChangeDraw2: {
    label: 'Virage serré',
    description: 'La couleur change au hasard, et le joueur suivant pioche 2 cartes.',
  },
  reverseColorChange: {
    label: 'Demi-tour',
    description: 'Le sens du jeu s’inverse et la couleur change au hasard.',
  },
  swapHands: {
    label: 'Échange',
    description: 'Tu échanges ta main avec celle du joueur qui en a le moins.',
  },
};

export const MYSTERY_ORDER: UnoMysteryEffect[] = [
  'draw10',
  'draw8',
  'colorChangeDraw2',
  'reverseColorChange',
  'swapHands',
];

/** How many mystery cards get shuffled in. Never in a duel — see `startGame`. */
export const MYSTERY_COUNT = 2;

/**
 * A standard 108-card UNO deck: one 0 and two of each 1-9 per colour, two of
 * each action card per colour, four wilds and four wild draw-fours.
 */
export function createDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let n = 0;
  const push = (card: Omit<UnoCard, 'id'>) => deck.push({ ...card, id: `u${n++}` });

  for (const color of COLORS) {
    push({ kind: 'number', color, number: 0 });
    for (let value = 1; value <= 9; value++) {
      push({ kind: 'number', color, number: value });
      push({ kind: 'number', color, number: value });
    }
    for (const kind of ['skip', 'reverse', 'draw2'] as const) {
      push({ kind, color });
      push({ kind, color });
    }
  }

  for (let i = 0; i < 4; i++) {
    push({ kind: 'wild', color: null });
    push({ kind: 'wild4', color: null });
  }

  return deck;
}

export function createMysteryCards(count = MYSTERY_COUNT): UnoCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mystery-${i}`,
    kind: 'mystery' as const,
    color: null,
  }));
}

export function shuffle<T>(input: T[], random: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardLabel(card: UnoCard): string {
  switch (card.kind) {
    case 'number':
      return `${card.number} ${COLOR_LABEL[card.color!].toLowerCase()}`;
    case 'skip':
      return `Passe ton tour ${COLOR_LABEL[card.color!].toLowerCase()}`;
    case 'reverse':
      return `Inversion ${COLOR_LABEL[card.color!].toLowerCase()}`;
    case 'draw2':
      return `+2 ${COLOR_LABEL[card.color!].toLowerCase()}`;
    case 'wild':
      return 'Changement de couleur';
    case 'wild4':
      return '+4 joker';
    case 'mystery':
      return 'Carte mystère';
  }
}

/** The two colourless jokers are playable on anything. */
export function isWild(card: UnoCard): boolean {
  return card.kind === 'wild' || card.kind === 'wild4';
}
