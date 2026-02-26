import { cardToCode } from './card-code.ts';
import { createMulberry32, type RandomSource } from './rng.ts';
import type { Card, Rank, Suit } from './types.ts';

const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function buildStandardDeck(): Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        rank,
        suit,
        code: cardToCode({ rank, suit }),
      });
    }
  }

  return cards;
}

export function shuffleDeck(cards: readonly Card[], randomSource: RandomSource = Math.random): Card[] {
  const shuffled = cards.map((card) => ({ ...card }));

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomSource() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  return shuffled;
}

export function createShuffledDeck(seed: number): Card[] {
  const randomSource = createMulberry32(seed);
  return shuffleDeck(buildStandardDeck(), randomSource);
}

export function drawCards(deck: readonly Card[], count: number): { drawn: Card[]; remaining: Card[] } {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`drawCards count must be a positive integer. Received: ${count}`);
  }

  if (deck.length < count) {
    throw new Error(`Not enough cards in deck. Requested ${count}, only ${deck.length} remain.`);
  }

  const drawn = deck.slice(0, count).map((card) => ({ ...card }));
  const remaining = deck.slice(count).map((card) => ({ ...card }));

  return { drawn, remaining };
}
