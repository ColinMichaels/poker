import { choose } from './combinations.ts';
import type { Card, EvaluatedHand, HandCategory } from './types.ts';

const categoryStrength: Record<HandCategory, number> = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

const categoryLabel: Record<HandCategory, string> = {
  HIGH_CARD: 'High Card',
  PAIR: 'Pair',
  TWO_PAIR: 'Two Pair',
  THREE_OF_A_KIND: 'Three of a Kind',
  STRAIGHT: 'Straight',
  FLUSH: 'Flush',
  FULL_HOUSE: 'Full House',
  FOUR_OF_A_KIND: 'Four of a Kind',
  STRAIGHT_FLUSH: 'Straight Flush',
  ROYAL_FLUSH: 'Royal Flush',
};

function sortNumbersDesc(values: readonly number[]): number[] {
  return [...values].sort((a, b) => b - a);
}

function getStraightHigh(ranks: readonly number[]): number | null {
  const unique = Array.from(new Set(ranks));
  if (unique.length !== 5) {
    return null;
  }

  const sorted = sortNumbersDesc(unique);

  if (sorted.join(',') === '14,5,4,3,2') {
    return 5;
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (sorted[i] - 1 !== sorted[i + 1]) {
      return null;
    }
  }

  return sorted[0];
}

function buildHand(category: HandCategory, tiebreak: number[]): EvaluatedHand {
  return {
    category,
    strength: categoryStrength[category],
    tiebreak,
    label: categoryLabel[category],
  };
}

function assertUniqueCards(cards: readonly Card[]): void {
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.code)) {
      throw new Error(`Duplicate card detected in hand evaluation: ${card.code}`);
    }
    seen.add(card.code);
  }
}

export function evaluateFiveCardHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error(`evaluateFiveCardHand expects exactly 5 cards. Received: ${cards.length}`);
  }

  assertUniqueCards(cards);

  const ranks = cards.map((card) => card.rank);
  const suits = cards.map((card) => card.suit);

  const sortedRanks = sortNumbersDesc(ranks);
  const straightHigh = getStraightHigh(ranks);
  const flush = suits.every((suit) => suit === suits[0]);

  const rankCounts = new Map<number, number>();
  for (const rank of ranks) {
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  }

  const groups = Array.from(rankCounts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const counts = groups.map((group) => group.count);

  const isRoyal = flush && straightHigh === 14 && sortedRanks.includes(10);

  if (isRoyal) {
    return buildHand('ROYAL_FLUSH', [14]);
  }

  if (flush && straightHigh !== null) {
    return buildHand('STRAIGHT_FLUSH', [straightHigh]);
  }

  if (counts[0] === 4) {
    const four = groups[0].rank;
    const kicker = groups[1].rank;
    return buildHand('FOUR_OF_A_KIND', [four, kicker]);
  }

  if (counts[0] === 3 && counts[1] === 2) {
    return buildHand('FULL_HOUSE', [groups[0].rank, groups[1].rank]);
  }

  if (flush) {
    return buildHand('FLUSH', sortedRanks);
  }

  if (straightHigh !== null) {
    return buildHand('STRAIGHT', [straightHigh]);
  }

  if (counts[0] === 3) {
    const trip = groups[0].rank;
    const kickers = groups.slice(1).map((group) => group.rank).sort((a, b) => b - a);
    return buildHand('THREE_OF_A_KIND', [trip, ...kickers]);
  }

  if (counts[0] === 2 && counts[1] === 2) {
    const pairRanks = groups
      .filter((group) => group.count === 2)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    const kicker = groups.find((group) => group.count === 1)?.rank;

    if (kicker === undefined) {
      throw new Error('Unable to determine kicker for two-pair hand.');
    }

    return buildHand('TWO_PAIR', [...pairRanks, kicker]);
  }

  if (counts[0] === 2) {
    const pair = groups.find((group) => group.count === 2)?.rank;
    const kickers = groups
      .filter((group) => group.count === 1)
      .map((group) => group.rank)
      .sort((a, b) => b - a);

    if (pair === undefined) {
      throw new Error('Unable to determine pair rank.');
    }

    return buildHand('PAIR', [pair, ...kickers]);
  }

  return buildHand('HIGH_CARD', sortedRanks);
}

export function compareEvaluatedHands(left: EvaluatedHand, right: EvaluatedHand): number {
  if (left.strength !== right.strength) {
    return left.strength > right.strength ? 1 : -1;
  }

  const length = Math.max(left.tiebreak.length, right.tiebreak.length);

  for (let i = 0; i < length; i += 1) {
    const leftValue = left.tiebreak[i] ?? 0;
    const rightValue = right.tiebreak[i] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

export function evaluateBestHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateBestHand expects between 5 and 7 cards. Received: ${cards.length}`);
  }

  if (cards.length === 5) {
    return evaluateFiveCardHand(cards);
  }

  const combos = choose(cards, 5);
  if (combos.length === 0) {
    throw new Error('Unable to create card combinations for hand evaluation.');
  }

  let best = evaluateFiveCardHand(combos[0]);

  for (let i = 1; i < combos.length; i += 1) {
    const current = evaluateFiveCardHand(combos[i]);
    if (compareEvaluatedHands(current, best) > 0) {
      best = current;
    }
  }

  return best;
}
