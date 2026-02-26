import {
  buildStandardDeck,
  compareEvaluatedHands,
  createMulberry32,
  evaluateBestHand,
  type Card,
  type SeatState,
  type TexasHoldemState,
} from '@poker/poker-engine';

type WinOddsMode = 'SIMULATED' | 'DETERMINISTIC' | 'PAYOUT' | 'SINGLE_CONTENDER' | 'UNAVAILABLE';

export interface SeatWinOdds {
  seatId: number;
  playerId: string;
  percentage: number;
  isContender: boolean;
  isFolded: boolean;
  isLeader: boolean;
  payoutAmount: number;
  handLabel: string | null;
}

export interface WinOddsSnapshot {
  mode: WinOddsMode;
  boardCardsRemaining: number;
  simulations: number;
  seats: SeatWinOdds[];
}

interface EvaluatedSeatHand {
  seatId: number;
  label: string;
  comparedAgainst: ReturnType<typeof evaluateBestHand>;
}

const SIMULATION_COUNT_BY_BOARD_REMAINING: Record<number, number> = {
  0: 1,
  1: 240,
  2: 420,
  3: 560,
  4: 720,
  5: 760,
};

let cachedStateKey: string | null = null;
let cachedSnapshot: WinOddsSnapshot | null = null;

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function buildStateCacheKey(state: TexasHoldemState): string {
  const boardKey = state.board.map((card) => card.code).join(',');
  const seatKey = state.seats
    .map((seat) => `${seat.seatId}:${seat.folded ? 1 : 0}:${seat.holeCards.map((card) => card.code).join('.')}`)
    .join('|');
  const payoutKey = state.payouts.map((payout) => `${payout.seatId}:${payout.amount}:${payout.reason}`).join('|');
  return `${state.handId}|${state.phase}|${boardKey}|${seatKey}|${payoutKey}`;
}

function hashText(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function buildContenders(state: TexasHoldemState): SeatState[] {
  return state.seats.filter((seat) => !seat.folded && seat.holeCards.length === 2);
}

function buildPayoutMap(state: TexasHoldemState): Map<number, number> {
  const payoutBySeat = new Map<number, number>();
  for (const payout of state.payouts) {
    payoutBySeat.set(payout.seatId, (payoutBySeat.get(payout.seatId) ?? 0) + payout.amount);
  }
  return payoutBySeat;
}

function buildRemainingDeck(state: TexasHoldemState): Card[] {
  const knownCodes = new Set<string>();
  for (const card of state.board) {
    knownCodes.add(card.code);
  }
  for (const seat of state.seats) {
    for (const card of seat.holeCards) {
      knownCodes.add(card.code);
    }
  }
  return buildStandardDeck().filter((card) => !knownCodes.has(card.code));
}

function drawRandomCardsWithoutReplacement(cards: readonly Card[], count: number, randomSource: () => number): Card[] {
  if (count <= 0) {
    return [];
  }

  const selected = new Set<number>();
  const drawn: Card[] = [];

  while (drawn.length < count && selected.size < cards.length) {
    const index = Math.floor(randomSource() * cards.length);
    if (selected.has(index)) {
      continue;
    }
    selected.add(index);
    drawn.push(cards[index]);
  }

  return drawn;
}

function evaluateSeatHands(contenders: readonly SeatState[], board: readonly Card[]): EvaluatedSeatHand[] {
  return contenders.map((seat) => {
    const evaluated = evaluateBestHand([...seat.holeCards, ...board]);
    return {
      seatId: seat.seatId,
      label: evaluated.label,
      comparedAgainst: evaluated,
    };
  });
}

function resolveWinningSeatIds(evaluatedHands: readonly EvaluatedSeatHand[]): number[] {
  if (evaluatedHands.length === 0) {
    return [];
  }

  let winners = [evaluatedHands[0].seatId];
  let best = evaluatedHands[0].comparedAgainst;

  for (let index = 1; index < evaluatedHands.length; index += 1) {
    const candidate = evaluatedHands[index];
    const compared = compareEvaluatedHands(candidate.comparedAgainst, best);
    if (compared > 0) {
      best = candidate.comparedAgainst;
      winners = [candidate.seatId];
      continue;
    }
    if (compared === 0) {
      winners.push(candidate.seatId);
    }
  }

  return winners;
}

function buildSeatSnapshot(
  state: TexasHoldemState,
  seatShares: Map<number, number>,
  payoutBySeat: Map<number, number>,
  contenders: readonly SeatState[],
  handLabelBySeat: Map<number, string>,
): SeatWinOdds[] {
  const contenderSeatIds = new Set(contenders.map((seat) => seat.seatId));
  const contenderShares = contenders.map((seat) => seatShares.get(seat.seatId) ?? 0);
  const topShare = contenderShares.length > 0 ? Math.max(...contenderShares) : 0;

  return state.seats.map((seat) => {
    const share = seatShares.get(seat.seatId) ?? 0;
    const percentage = clampPercentage(share * 100);
    return {
      seatId: seat.seatId,
      playerId: seat.playerId,
      percentage,
      isContender: contenderSeatIds.has(seat.seatId),
      isFolded: seat.folded,
      isLeader: contenderSeatIds.has(seat.seatId) && topShare > 0 && Math.abs(share - topShare) < 0.0001,
      payoutAmount: payoutBySeat.get(seat.seatId) ?? 0,
      handLabel: handLabelBySeat.get(seat.seatId) ?? null,
    };
  });
}

export function buildWinOddsSnapshot(state: TexasHoldemState): WinOddsSnapshot {
  const cacheKey = buildStateCacheKey(state);
  if (cacheKey === cachedStateKey && cachedSnapshot) {
    return cachedSnapshot;
  }

  const contenders = buildContenders(state);
  const payoutBySeat = buildPayoutMap(state);
  const boardCardsRemaining = Math.max(0, 5 - state.board.length);
  const seatShares = new Map<number, number>();
  const handLabelBySeat = new Map<number, string>();
  let mode: WinOddsMode = 'UNAVAILABLE';
  let simulations = 0;

  for (const contender of contenders) {
    seatShares.set(contender.seatId, 0);
  }

  if (state.phase === 'HAND_COMPLETE' && state.payouts.length > 0) {
    const totalPaid = state.payouts.reduce((sum, payout) => sum + Math.max(0, payout.amount), 0);
    if (totalPaid > 0) {
      for (const payout of state.payouts) {
        seatShares.set(payout.seatId, (payout.amount > 0 ? payout.amount : 0) / totalPaid);
      }
    }
    if (state.board.length >= 5 && contenders.length > 0) {
      for (const hand of evaluateSeatHands(contenders, state.board)) {
        handLabelBySeat.set(hand.seatId, hand.label);
      }
    }
    mode = 'PAYOUT';
  } else if (contenders.length === 1) {
    seatShares.set(contenders[0].seatId, 1);
    mode = 'SINGLE_CONTENDER';
  } else if (contenders.length >= 2 && boardCardsRemaining === 0) {
    const evaluatedHands = evaluateSeatHands(contenders, state.board);
    for (const hand of evaluatedHands) {
      handLabelBySeat.set(hand.seatId, hand.label);
    }
    const winners = resolveWinningSeatIds(evaluatedHands);
    if (winners.length > 0) {
      const share = 1 / winners.length;
      for (const seatId of winners) {
        seatShares.set(seatId, share);
      }
    }
    mode = 'DETERMINISTIC';
  } else if (contenders.length >= 2) {
    const remainingDeck = buildRemainingDeck(state);
    const requiredCards = boardCardsRemaining;
    if (remainingDeck.length >= requiredCards) {
      const boardSeedKey = `${cacheKey}|odds`;
      const randomSource = createMulberry32(hashText(boardSeedKey) ^ 0x9e3779b9);
      simulations = SIMULATION_COUNT_BY_BOARD_REMAINING[boardCardsRemaining] ?? 420;

      for (let index = 0; index < simulations; index += 1) {
        const runout = drawRandomCardsWithoutReplacement(remainingDeck, requiredCards, randomSource);
        if (runout.length !== requiredCards) {
          continue;
        }

        const board = [...state.board, ...runout];
        const winners = resolveWinningSeatIds(evaluateSeatHands(contenders, board));
        if (winners.length === 0) {
          continue;
        }

        const share = 1 / winners.length;
        for (const seatId of winners) {
          seatShares.set(seatId, (seatShares.get(seatId) ?? 0) + share / simulations);
        }
      }
      mode = 'SIMULATED';
    }
  }

  const snapshot: WinOddsSnapshot = {
    mode,
    boardCardsRemaining,
    simulations,
    seats: buildSeatSnapshot(state, seatShares, payoutBySeat, contenders, handLabelBySeat),
  };

  cachedStateKey = cacheKey;
  cachedSnapshot = snapshot;
  return snapshot;
}
