import { parseCardCodes } from './card-code.ts';
import { compareEvaluatedHands, evaluateBestHand } from './evaluator.ts';
import type { Card, EvaluatedHand } from './types.ts';

export interface ShowdownPlayerInput {
  seatId: number;
  hole: readonly string[] | readonly Card[];
  folded?: boolean;
}

export interface ShowdownRanking {
  seatId: number;
  hand: EvaluatedHand;
}

export interface ShowdownResult {
  winners: number[];
  rankings: ShowdownRanking[];
}

function normalizeCards(cards: readonly string[] | readonly Card[]): Card[] {
  if (cards.length === 0) {
    return [];
  }

  if (typeof cards[0] === 'string') {
    return parseCardCodes(cards as readonly string[]);
  }

  return (cards as readonly Card[]).map((card) => ({ ...card }));
}

function assertUniqueCards(cards: readonly Card[], context: string): void {
  const seen = new Set<string>();

  for (const card of cards) {
    if (seen.has(card.code)) {
      throw new Error(`${context}: duplicate card detected: ${card.code}`);
    }
    seen.add(card.code);
  }
}

export function resolveShowdown(
  boardInput: readonly string[] | readonly Card[],
  players: readonly ShowdownPlayerInput[],
): ShowdownResult {
  const board = normalizeCards(boardInput);

  if (board.length !== 5) {
    throw new Error(`Showdown board must contain exactly 5 cards. Received: ${board.length}`);
  }

  if (players.length < 2) {
    throw new Error('Showdown requires at least two players.');
  }

  const activePlayers = players.filter((player) => !player.folded);

  if (activePlayers.length === 0) {
    throw new Error('No active players remain for showdown.');
  }

  const boardCodes = new Set(board.map((card) => card.code));
  const rankings: ShowdownRanking[] = [];

  for (const player of activePlayers) {
    const hole = normalizeCards(player.hole);

    if (hole.length !== 2) {
      throw new Error(`Player ${player.seatId} must have exactly two hole cards.`);
    }

    assertUniqueCards(hole, `seat ${player.seatId}`);

    for (const card of hole) {
      if (boardCodes.has(card.code)) {
        throw new Error(`Card collision between board and seat ${player.seatId}: ${card.code}`);
      }
    }

    const hand = evaluateBestHand([...board, ...hole]);
    rankings.push({ seatId: player.seatId, hand });
  }

  rankings.sort((left, right) => compareEvaluatedHands(right.hand, left.hand));

  const best = rankings[0];
  const winners = rankings
    .filter((ranking) => compareEvaluatedHands(ranking.hand, best.hand) === 0)
    .map((ranking) => ranking.seatId)
    .sort((a, b) => a - b);

  return {
    winners,
    rankings,
  };
}
