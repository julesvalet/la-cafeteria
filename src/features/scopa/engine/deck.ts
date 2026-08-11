import type { CardT, Suit } from './types';

const SUITS: Suit[] = ['denari', 'coppe', 'spade', 'bastoni'];

export function createDeck(): CardT[] {
  const deck: CardT[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 10; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  return deck;
}

export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const RANK_LABEL: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: 'F',
  9: 'C',
  10: 'R',
};

export const SUIT_LABEL: Record<Suit, string> = {
  denari: 'Denari',
  coppe: 'Coppe',
  spade: 'Spade',
  bastoni: 'Bastoni',
};

const RANK_FILE: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: 'fante',
  9: 'cavallo',
  10: 're',
};

export function cardImageUrl(card: Pick<CardT, 'suit' | 'rank'>): string {
  return `${import.meta.env.BASE_URL}assets/cards/${card.suit}-${RANK_FILE[card.rank]}.png`;
}
