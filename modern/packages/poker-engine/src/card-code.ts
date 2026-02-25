import type { Card, Rank, Suit } from './types.ts';

const tokenToRank: Record<string, Rank> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const rankToToken: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const cardPattern = /^(10|[2-9]|[JQKA])([CDHS])$/;

export function parseCardCode(code: string): Card {
  const normalized = code.trim().toUpperCase();
  const match = normalized.match(cardPattern);

  if (!match) {
    throw new Error(`Invalid card code '${code}'. Expected formats like AS, 10D, QC.`);
  }

  const [, rankToken, suitToken] = match;

  return {
    rank: tokenToRank[rankToken],
    suit: suitToken as Suit,
    code: `${rankToken}${suitToken}`,
  };
}

export function parseCardCodes(codes: readonly string[]): Card[] {
  return codes.map((code) => parseCardCode(code));
}

export function cardToCode(card: Pick<Card, 'rank' | 'suit'>): string {
  const rankToken = rankToToken[card.rank as Rank];
  return `${rankToken}${card.suit}`;
}
