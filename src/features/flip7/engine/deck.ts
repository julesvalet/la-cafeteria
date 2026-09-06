import type { Card, Ruleset } from './types';

export function createDeck(ruleset: Ruleset = 'official'): Card[] {
  const cards: Card[] = [];
  const add = (kind: Card['kind'], value: number, count: number) => {
    for (let i = 0; i < count; i++) cards.push({ id: `${kind}-${value}-${i}`, kind, value });
  };
  for (let n = 0; n <= (ruleset === 'official' ? 12 : 7); n++) {
    add('number', n, ruleset === 'official' ? Math.max(1, n) : n + 1);
  }
  add('double', 2, ruleset === 'official' ? 1 : 9);
  [2, 4, 6, 8, 10].forEach((n, i) => add('bonus', n, ruleset === 'official' ? 1 : [6, 3, 1, 1, 1][i]));
  add('flip3', 0, ruleset === 'official' ? 3 : 1);
  add('freeze', 0, ruleset === 'official' ? 3 : 2);
  add('chance', 0, ruleset === 'official' ? 3 : 2);
  return cards;
}

/** Fisher–Yates; injected randomness makes complete games reproducible in tests. */
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'number': return String(card.value);
    case 'bonus': return `+${card.value}`;
    case 'double': return '×2';
    case 'flip3': return 'Flip Three';
    case 'freeze': return 'Freeze';
    case 'chance': return 'Second Chance';
  }
}
