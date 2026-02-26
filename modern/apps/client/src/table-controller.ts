import {
  applyTexasHoldemCommand,
  buildTableActionStateDTO,
  createMulberry32,
  createTexasHoldemState,
  evaluateBestHand,
  type ActionOptionDTO,
  type Card,
  type DomainEvent,
  type HandCategory,
  type PokerAction,
  type SeatDefinition,
  type SeatState,
  type TableActionStateDTO,
  type TableCommand,
  type TablePhase,
  type TexasHoldemState,
} from '@poker/poker-engine';

export interface UserActionIntent {
  action: PokerAction;
  amount?: number;
}

export type TableLogKind = 'COMMAND' | 'EVENT' | 'SYSTEM' | 'ERROR';

export interface TableLogEntry {
  id: number;
  timestamp: string;
  kind: TableLogKind;
  message: string;
}

export interface TableViewModel {
  state: TexasHoldemState;
  actionState: TableActionStateDTO;
  userSeatId: number;
  handNumber: number;
  logs: TableLogEntry[];
}

interface LocalTableControllerOptions {
  userSeatId?: number;
}

type Listener = (model: TableViewModel) => void;
type RandomSource = () => number;

const MAX_LOGS = 120;
const MEMORY_WINDOW_SIZE = 18;
const BETTING_PHASES: readonly TablePhase[] = ['BETTING_PRE_FLOP', 'BETTING_FLOP', 'BETTING_TURN', 'BETTING_RIVER'];
const TABLE_SEAT_COUNT = 4;
const DEFAULT_STACK_SIZE = 400;
const BOT_NAME_POOL = ['bot-luna', 'bot-echo', 'bot-rio', 'bot-orion', 'bot-sage'] as const;
const BOT_RANDOM_MASK = 0x85ebca6b;
const POST_FLOP_CATEGORY_STRENGTH: Record<HandCategory, number> = {
  HIGH_CARD: 0.26,
  PAIR: 0.47,
  TWO_PAIR: 0.62,
  THREE_OF_A_KIND: 0.72,
  STRAIGHT: 0.82,
  FLUSH: 0.86,
  FULL_HOUSE: 0.93,
  FOUR_OF_A_KIND: 0.97,
  STRAIGHT_FLUSH: 0.99,
  ROYAL_FLUSH: 1,
};

interface BotProfile {
  tightness: number;
  aggression: number;
  bluffRate: number;
  gambleRate: number;
}

interface BoardTextureProfile {
  wetness: number;
  pairedness: number;
  broadwayPressure: number;
}

type TrackedAction = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

interface SeatActionMemory {
  recentActions: TrackedAction[];
}

interface BotMemoryInfluence {
  selfAggression: number;
  opponentsAggression: number;
  opponentsFoldRate: number;
  dominantOpponentAggression: number;
}

function isBettingPhase(phase: TablePhase): boolean {
  return BETTING_PHASES.includes(phase);
}

function truncate(value: string, max = 140): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}

function getActionOption(options: readonly ActionOptionDTO[], action: PokerAction): ActionOptionDTO | undefined {
  return options.find((option) => option.action === action);
}

function chooseTargetAmount(option: ActionOptionDTO, fraction: number): number {
  const min = option.minAmount ?? 0;
  const max = option.maxAmount ?? min;
  if (max <= min) {
    return min;
  }
  const span = max - min;
  return min + Math.floor(span * fraction);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function chance(randomSource: RandomSource, probability: number): boolean {
  return randomSource() < clamp01(probability);
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function buildBotProfile(seat: SeatState): BotProfile {
  const seed = mixUint32(hashString(`${seat.playerId}:${seat.seatId}`));
  return {
    tightness: 0.32 + ((seed & 0xff) / 255) * 0.42,
    aggression: 0.28 + (((seed >>> 8) & 0xff) / 255) * 0.5,
    bluffRate: 0.03 + (((seed >>> 16) & 0xff) / 255) * 0.17,
    gambleRate: 0.08 + (((seed >>> 24) & 0xff) / 255) * 0.2,
  };
}

function hasFlushDraw(cards: readonly Card[], boardCount: number): boolean {
  if (boardCount >= 5) {
    return false;
  }

  const suitCounts = new Map<string, number>();
  for (const card of cards) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  }

  return Array.from(suitCounts.values()).some((count) => count === 4);
}

function hasStraightDraw(cards: readonly Card[], boardCount: number): boolean {
  if (boardCount >= 5) {
    return false;
  }

  const uniqueRanks = new Set<number>();
  for (const card of cards) {
    uniqueRanks.add(card.rank);
    if (card.rank === 14) {
      uniqueRanks.add(1);
    }
  }

  const sorted = Array.from(uniqueRanks.values()).sort((left, right) => left - right);
  if (sorted.length < 4) {
    return false;
  }

  for (let index = 0; index <= sorted.length - 4; index += 1) {
    const window = sorted.slice(index, index + 4);
    if (window[3] - window[0] <= 4) {
      return true;
    }
  }

  return false;
}

function evaluatePreFlopStrength(holeCards: readonly Card[]): number {
  if (holeCards.length !== 2) {
    return 0.45;
  }

  const [first, second] = holeCards;
  const highRank = Math.max(first.rank, second.rank);
  const lowRank = Math.min(first.rank, second.rank);
  const suited = first.suit === second.suit;
  const gap = highRank - lowRank;

  if (highRank === lowRank) {
    const pairScore = 0.52 + ((highRank - 2) / 12) * 0.44;
    return clamp01(pairScore);
  }

  const broadwayCount = (first.rank >= 10 ? 1 : 0) + (second.rank >= 10 ? 1 : 0);
  let score = 0.24;
  score += broadwayCount * 0.11;
  score += suited ? 0.1 : 0;
  score += highRank >= 13 ? 0.09 : highRank >= 11 ? 0.05 : 0;
  score += gap === 1 ? 0.1 : gap === 2 ? 0.06 : gap === 3 ? 0.02 : -0.03;
  score += highRank >= 11 && lowRank >= 10 ? 0.05 : 0;
  score += highRank === 14 && lowRank <= 5 ? 0.04 : 0;
  return clamp01(score);
}

function evaluatePostFlopStrength(seat: SeatState, board: readonly Card[]): number {
  const combinedCards = [...seat.holeCards, ...board];
  if (combinedCards.length < 5) {
    return evaluatePreFlopStrength(seat.holeCards);
  }

  const evaluated = evaluateBestHand(combinedCards);
  let score = POST_FLOP_CATEGORY_STRENGTH[evaluated.category];

  if (evaluated.category === 'HIGH_CARD' || evaluated.category === 'PAIR' || evaluated.category === 'TWO_PAIR') {
    if (hasFlushDraw(combinedCards, board.length)) {
      score += 0.08;
    }
    if (hasStraightDraw(combinedCards, board.length)) {
      score += 0.06;
    }
  }

  if (evaluated.category === 'HIGH_CARD' && board.length === 3) {
    const boardHigh = Math.max(...board.map((card) => card.rank));
    const overCards = seat.holeCards.filter((card) => card.rank > boardHigh).length;
    if (overCards === 2) {
      score += 0.05;
    }
  }

  return clamp01(score);
}

function evaluateBotHandStrength(state: TexasHoldemState, seat: SeatState): number {
  if (state.board.length >= 3) {
    return evaluatePostFlopStrength(seat, state.board);
  }

  return evaluatePreFlopStrength(seat.holeCards);
}

function evaluateBoardTexture(board: readonly Card[]): BoardTextureProfile {
  if (board.length < 3) {
    return {
      wetness: 0,
      pairedness: 0,
      broadwayPressure: 0,
    };
  }

  const suitCounts = new Map<string, number>();
  const rankCounts = new Map<number, number>();
  const ranks: number[] = [];
  let broadwayCount = 0;

  for (const card of board) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    ranks.push(card.rank);
    if (card.rank >= 10) {
      broadwayCount += 1;
    }
  }

  const maxSuitCount = Math.max(...Array.from(suitCounts.values()));
  const suitedness = clamp01((maxSuitCount - 1) / Math.max(1, board.length - 1));

  const uniqueRanks = Array.from(new Set(ranks)).sort((left, right) => left - right);
  let closePairs = 0;
  for (let index = 1; index < uniqueRanks.length; index += 1) {
    if (uniqueRanks[index] - uniqueRanks[index - 1] <= 2) {
      closePairs += 1;
    }
  }
  const connectivity = uniqueRanks.length > 1 ? closePairs / (uniqueRanks.length - 1) : 0;

  const duplicateGroups = Array.from(rankCounts.values());
  const hasTripsOrBetter = duplicateGroups.some((count) => count >= 3);
  const pairCount = duplicateGroups.filter((count) => count === 2).length;
  const pairedness = hasTripsOrBetter ? 0.75 : pairCount >= 2 ? 0.55 : pairCount === 1 ? 0.35 : 0;

  const broadwayPressure = broadwayCount / board.length;
  const wetness = clamp01(suitedness * 0.44 + connectivity * 0.38 + broadwayPressure * 0.18);

  return {
    wetness,
    pairedness,
    broadwayPressure,
  };
}

function isSeatContestingHand(seat: SeatState): boolean {
  return !seat.folded && (seat.stack > 0 || seat.totalCommitted > 0);
}

function getPositionAdvantage(state: TexasHoldemState, seatId: number): number {
  const orderedContestingSeatIds = state.seats
    .filter((seat) => isSeatContestingHand(seat))
    .map((seat) => seat.seatId)
    .sort((left, right) => left - right);

  if (orderedContestingSeatIds.length <= 1) {
    return 0.5;
  }

  const buttonIndex = orderedContestingSeatIds.indexOf(state.buttonSeatId);
  const seatIndex = orderedContestingSeatIds.indexOf(seatId);
  if (buttonIndex < 0 || seatIndex < 0) {
    return 0.5;
  }

  const relative = (seatIndex - buttonIndex + orderedContestingSeatIds.length) % orderedContestingSeatIds.length;
  const normalized = relative / Math.max(1, orderedContestingSeatIds.length - 1);
  // 1 = button / latest position, 0 = earliest position.
  return clamp01(1 - normalized);
}

function countActiveOpponents(state: TexasHoldemState, seatId: number): number {
  return state.seats.filter((seat) => seat.seatId !== seatId && isSeatContestingHand(seat)).length;
}

function average(values: readonly number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  const sum = values.reduce((accumulator, value) => accumulator + value, 0);
  return sum / values.length;
}

function toTrackedActionFromEventType(eventType: string): TrackedAction | null {
  switch (eventType) {
    case 'PLAYER_FOLDED':
      return 'FOLD';
    case 'PLAYER_CHECKED':
      return 'CHECK';
    case 'PLAYER_CALLED':
      return 'CALL';
    case 'PLAYER_BET':
      return 'BET';
    case 'PLAYER_RAISED':
      return 'RAISE';
    case 'PLAYER_ALL_IN':
      return 'ALL_IN';
    default:
      return null;
  }
}

function readSeatIdFromPayload(payload: Record<string, unknown>): number | null {
  const value = payload.seatId;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function trackSeatAction(memoryBySeatId: Map<number, SeatActionMemory>, seatId: number, action: TrackedAction): void {
  const existing = memoryBySeatId.get(seatId) ?? { recentActions: [] };
  const nextActions = [...existing.recentActions, action];
  if (nextActions.length > MEMORY_WINDOW_SIZE) {
    nextActions.splice(0, nextActions.length - MEMORY_WINDOW_SIZE);
  }
  memoryBySeatId.set(seatId, { recentActions: nextActions });
}

function computeAggressionRate(actions: readonly TrackedAction[]): number {
  if (actions.length === 0) {
    return 0.35;
  }

  let aggressiveCount = 0;
  for (const action of actions) {
    if (action === 'BET' || action === 'RAISE' || action === 'ALL_IN') {
      aggressiveCount += 1;
    }
  }

  return aggressiveCount / actions.length;
}

function computeFoldRate(actions: readonly TrackedAction[]): number {
  if (actions.length === 0) {
    return 0.3;
  }

  let foldCount = 0;
  for (const action of actions) {
    if (action === 'FOLD') {
      foldCount += 1;
    }
  }

  return foldCount / actions.length;
}

function buildBotMemoryInfluence(
  memoryBySeatId: ReadonlyMap<number, SeatActionMemory>,
  seatId: number,
): BotMemoryInfluence {
  const selfActions = memoryBySeatId.get(seatId)?.recentActions ?? [];
  const selfAggression = computeAggressionRate(selfActions);

  const opponentAggressionRates: number[] = [];
  const opponentFoldRates: number[] = [];
  for (const [candidateSeatId, memory] of memoryBySeatId.entries()) {
    if (candidateSeatId === seatId) {
      continue;
    }

    opponentAggressionRates.push(computeAggressionRate(memory.recentActions));
    opponentFoldRates.push(computeFoldRate(memory.recentActions));
  }

  return {
    selfAggression,
    opponentsAggression: average(opponentAggressionRates, 0.36),
    opponentsFoldRate: average(opponentFoldRates, 0.3),
    dominantOpponentAggression: opponentAggressionRates.length > 0 ? Math.max(...opponentAggressionRates) : 0.36,
  };
}

function chooseSizingFraction(base: number, variance: number, randomSource: RandomSource): number {
  const offset = (randomSource() * 2 - 1) * variance;
  return clamp01(base + offset);
}

function chooseBotCommand(
  state: TexasHoldemState,
  actionState: TableActionStateDTO,
  seatId: number,
  memoryBySeatId: ReadonlyMap<number, SeatActionMemory>,
  randomSource: RandomSource,
): TableCommand | null {
  const actionSeat = actionState.seats.find((candidate) => candidate.seatId === seatId);
  const seatState = state.seats.find((candidate) => candidate.seatId === seatId);
  if (!actionSeat || !seatState) {
    return null;
  }

  const profile = buildBotProfile(seatState);
  const memoryInfluence = buildBotMemoryInfluence(memoryBySeatId, seatId);
  const handStrength = evaluateBotHandStrength(state, seatState);
  const texture = evaluateBoardTexture(state.board);
  const positionAdvantage = getPositionAdvantage(state, seatId);
  const positionOffset = positionAdvantage - 0.5;
  const activeOpponentCount = countActiveOpponents(state, seatId);
  const isHeadsUp = activeOpponentCount <= 1;
  const stackInBigBlinds = actionSeat.stack / Math.max(1, state.config.bigBlind);
  const isShortStack = stackInBigBlinds <= 10;
  const isPreFlop = state.phase === 'BETTING_PRE_FLOP';
  const facingOpenRaise = isPreFlop && actionSeat.toCall >= state.config.bigBlind * 2;
  const facingThreeBet = isPreFlop && (actionSeat.toCall >= state.config.bigBlind * 5 || state.currentBet >= state.config.bigBlind * 7);
  const pressure = actionSeat.toCall / Math.max(1, actionSeat.stack);
  const potOdds = actionSeat.toCall > 0 ? actionSeat.toCall / Math.max(1, state.pot + actionSeat.toCall) : 0;
  const texturePenalty = texture.wetness * (handStrength < 0.58 ? 0.12 + profile.tightness * 0.08 : 0.03);
  const textureBoost = texture.wetness * (handStrength > 0.64 ? 0.08 + profile.aggression * 0.05 : 0);
  const pairedPenalty = texture.pairedness * (handStrength < 0.68 ? 0.06 : 0.02);
  const dryBluffBoost = (1 - texture.wetness) * profile.bluffRate * 0.14;
  const positionBoost = positionOffset * (isPreFlop ? 0.16 : 0.08);
  const raisePressurePenalty = facingThreeBet
    ? 0.13 + profile.tightness * 0.08
    : facingOpenRaise
      ? 0.06 + profile.tightness * 0.04
      : 0;
  const headsUpBoost = isHeadsUp ? 0.05 + profile.aggression * 0.05 : 0;
  const memoryFoldEquityBoost = memoryInfluence.opponentsFoldRate * 0.05;
  const memoryAggressionPenalty =
    memoryInfluence.opponentsAggression * (handStrength < 0.6 ? 0.06 : 0.02);
  const memoryCounterAggressionBoost =
    memoryInfluence.dominantOpponentAggression * (handStrength > 0.7 ? 0.04 : 0);
  const selfStyleContinuity = (memoryInfluence.selfAggression - 0.35) * 0.06;
  const effectiveStrength = clamp01(
    handStrength -
      pressure * (0.2 + profile.tightness * 0.3) -
      potOdds * (0.12 + profile.tightness * 0.12) -
      texturePenalty -
      pairedPenalty +
      textureBoost +
      dryBluffBoost +
      positionBoost -
      raisePressurePenalty +
      headsUpBoost +
      memoryFoldEquityBoost -
      memoryAggressionPenalty +
      memoryCounterAggressionBoost +
      selfStyleContinuity,
  );

  const fold = getActionOption(actionSeat.actions, 'FOLD');
  const check = getActionOption(actionSeat.actions, 'CHECK');
  const call = getActionOption(actionSeat.actions, 'CALL');
  const bet = getActionOption(actionSeat.actions, 'BET');
  const raise = getActionOption(actionSeat.actions, 'RAISE');
  const allIn = getActionOption(actionSeat.actions, 'ALL_IN');

  if (isPreFlop && allIn?.allowed) {
    const jamThreshold = clamp01(
      0.56 +
        profile.tightness * 0.2 +
        Math.max(0, stackInBigBlinds - 3) * 0.018 -
        profile.aggression * 0.08 +
        (0.5 - positionAdvantage) * 0.1 +
        (facingThreeBet ? 0.08 : facingOpenRaise ? 0.03 : 0),
    );
    if (stackInBigBlinds <= 8 && effectiveStrength >= jamThreshold) {
      return { type: 'PLAYER_ACTION', seatId, action: 'ALL_IN' };
    }

    const defendThreshold = clamp01(
      jamThreshold -
        0.16 -
        profile.gambleRate * 0.05 -
        (positionAdvantage - 0.5) * 0.06 +
        (facingThreeBet ? 0.06 : 0),
    );
    if (
      actionSeat.toCall > 0 &&
      stackInBigBlinds <= 10 &&
      fold?.allowed &&
      effectiveStrength < defendThreshold &&
      !chance(randomSource, profile.gambleRate * 0.3)
    ) {
      return { type: 'PLAYER_ACTION', seatId, action: 'FOLD' };
    }
  }

  if (check?.allowed) {
    if (bet?.allowed) {
      const bluffChance =
        profile.bluffRate *
        (1 - effectiveStrength) *
        (0.35 + (1 - texture.wetness) * 0.75) *
        (0.8 + (1 - texture.pairedness) * 0.3) *
        (0.9 + positionAdvantage * 0.35) *
        (0.78 + memoryInfluence.opponentsFoldRate * 0.5);
      const texturePressure = texture.wetness * (effectiveStrength > 0.6 ? 0.16 : -0.08);
      const betChance = clamp01(
        (effectiveStrength - 0.34 + texturePressure + positionOffset * 0.06) * (0.82 + profile.aggression * 0.4) + bluffChance,
      );
      if (chance(randomSource, betChance)) {
        const sizing = chooseSizingFraction(
          0.18 + effectiveStrength * 0.64 + profile.aggression * 0.1 + texture.wetness * 0.08,
          0.12 + profile.gambleRate * 0.08,
          randomSource,
        );
        return {
          type: 'PLAYER_ACTION',
          seatId,
          action: 'BET',
          amount: chooseTargetAmount(bet, sizing),
        };
      }
    }

    return { type: 'PLAYER_ACTION', seatId, action: 'CHECK' };
  }

  if (call?.allowed) {
    if (raise?.allowed) {
      const raiseChance = clamp01(
        (effectiveStrength -
          0.48 +
          texture.wetness * (effectiveStrength > 0.6 ? 0.14 : -0.06) +
          texture.broadwayPressure * 0.04 +
          positionOffset * (isPreFlop ? 0.12 : 0.06) +
          (isHeadsUp ? 0.06 : 0) +
          (memoryInfluence.opponentsFoldRate - 0.3) * 0.12 +
          (memoryInfluence.selfAggression - 0.35) * 0.08) *
          (0.88 + profile.aggression * 0.45) -
          pressure * (0.35 + profile.tightness * 0.18 + texture.wetness * 0.12) -
          (positionAdvantage * 0.04),
      );
      if (chance(randomSource, raiseChance)) {
        const sizing = chooseSizingFraction(
          0.26 + effectiveStrength * 0.62 + profile.aggression * 0.08 + texture.wetness * 0.08,
          0.1 + profile.gambleRate * 0.08,
          randomSource,
        );
        return {
          type: 'PLAYER_ACTION',
          seatId,
          action: 'RAISE',
          amount: chooseTargetAmount(raise, sizing),
        };
      }
    }

    const surrenderThreshold =
      0.36 +
      profile.tightness * 0.2 +
      pressure * (0.42 + profile.tightness * 0.16) +
      potOdds * (0.32 + profile.tightness * 0.14) +
      texture.wetness * (effectiveStrength < 0.58 ? 0.16 : 0.04) +
      texture.pairedness * 0.08 +
      (0.5 - positionAdvantage) * 0.08 +
      (facingThreeBet ? 0.1 : facingOpenRaise ? 0.04 : 0) +
      memoryInfluence.dominantOpponentAggression * (effectiveStrength < 0.58 ? 0.06 : 0.02) -
      memoryInfluence.opponentsFoldRate * 0.04;
    if (fold?.allowed && effectiveStrength < surrenderThreshold && !chance(randomSource, profile.gambleRate * 0.35)) {
      return { type: 'PLAYER_ACTION', seatId, action: 'FOLD' };
    }

    const callChance = clamp01(
      0.35 +
        effectiveStrength * 0.75 +
        profile.gambleRate * 0.08 -
        pressure * (0.16 + profile.tightness * 0.14) -
        potOdds * 0.22 -
        texture.wetness * (effectiveStrength < 0.58 ? 0.09 : 0.03) +
        positionAdvantage * 0.08 -
        (facingThreeBet ? 0.07 : facingOpenRaise ? 0.03 : 0) +
        (isHeadsUp ? 0.04 : 0) +
        memoryInfluence.dominantOpponentAggression * (effectiveStrength >= 0.62 ? 0.04 : -0.06) +
        memoryInfluence.opponentsFoldRate * 0.03,
    );
    if (chance(randomSource, callChance) || !fold?.allowed) {
      return { type: 'PLAYER_ACTION', seatId, action: 'CALL' };
    }

    const jamChance = clamp01(
      (effectiveStrength - 0.74) * 0.4 +
        profile.gambleRate * 0.16 +
        (isShortStack ? 0.12 : 0) +
        texture.wetness * (effectiveStrength > 0.7 ? 0.08 : 0) +
        memoryInfluence.dominantOpponentAggression * (effectiveStrength > 0.72 ? 0.05 : -0.02),
    );
    if (allIn?.allowed && chance(randomSource, jamChance)) {
      return { type: 'PLAYER_ACTION', seatId, action: 'ALL_IN' };
    }

    if (fold?.allowed) {
      return { type: 'PLAYER_ACTION', seatId, action: 'FOLD' };
    }
  }

  if (bet?.allowed) {
    return {
      type: 'PLAYER_ACTION',
      seatId,
      action: 'BET',
      amount: chooseTargetAmount(
        bet,
        chooseSizingFraction(
          0.2 + effectiveStrength * 0.6 + texture.wetness * 0.08,
          0.14 + profile.gambleRate * 0.08,
          randomSource,
        ),
      ),
    };
  }

  if (raise?.allowed) {
    return {
      type: 'PLAYER_ACTION',
      seatId,
      action: 'RAISE',
      amount: chooseTargetAmount(
        raise,
        chooseSizingFraction(
          0.24 + effectiveStrength * 0.64 + texture.wetness * 0.08,
          0.14 + profile.gambleRate * 0.06,
          randomSource,
        ),
      ),
    };
  }

  if (allIn?.allowed && !fold?.allowed) {
    return { type: 'PLAYER_ACTION', seatId, action: 'ALL_IN' };
  }

  if (fold?.allowed) {
    return { type: 'PLAYER_ACTION', seatId, action: 'FOLD' };
  }

  return null;
}

function mixUint32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function cryptoRandomUint32(): number | null {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
    return null;
  }

  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] >>> 0;
}

function createRuntimeSeed(previousSeed = 0): number {
  const cryptoPart = cryptoRandomUint32();
  const randomPart = cryptoPart ?? Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  const nowPart = Date.now() >>> 0;
  const perfPart = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) >>> 0 : 0;
  const mixed = mixUint32(randomPart ^ mixUint32(nowPart) ^ mixUint32(perfPart) ^ mixUint32(previousSeed));
  return mixed === 0 ? 0xa341316c : mixed;
}

function buildSeatDefinitions(userSeatId: number): SeatDefinition[] {
  const seats: SeatDefinition[] = [];
  let botNameIndex = 0;

  for (let seatId = 1; seatId <= TABLE_SEAT_COUNT; seatId += 1) {
    if (seatId === userSeatId) {
      seats.push({ seatId, playerId: 'you', stack: DEFAULT_STACK_SIZE });
      continue;
    }

    seats.push({
      seatId,
      playerId: BOT_NAME_POOL[botNameIndex % BOT_NAME_POOL.length],
      stack: DEFAULT_STACK_SIZE,
    });
    botNameIndex += 1;
  }

  return seats;
}

function chooseDealerSeatId(seats: readonly SeatDefinition[], randomSource: RandomSource): number {
  const eligibleSeatIds = seats.filter((seat) => seat.stack > 0).map((seat) => seat.seatId);
  if (eligibleSeatIds.length === 0) {
    throw new Error('No eligible seats available to choose a dealer.');
  }

  const index = Math.floor(randomSource() * eligibleSeatIds.length);
  return eligibleSeatIds[index];
}

export class LocalTableController {
  private state: TexasHoldemState;
  private actionState: TableActionStateDTO;
  private handNumber: number;
  private readonly userSeatId: number;
  private readonly botSeatIds: Set<number>;
  private readonly listeners: Set<Listener>;
  private botRandomSource: RandomSource;
  private seatActionMemoryBySeatId: Map<number, SeatActionMemory>;
  private logs: TableLogEntry[];
  private nextLogId: number;

  public constructor(options: LocalTableControllerOptions = {}) {
    this.userSeatId = options.userSeatId ?? 1;
    this.handNumber = 1;
    this.logs = [];
    this.nextLogId = 1;
    this.listeners = new Set();
    this.botRandomSource = createMulberry32(1);
    this.seatActionMemoryBySeatId = new Map();

    const initialSeed = createRuntimeSeed();
    const seats = buildSeatDefinitions(this.userSeatId);
    this.seatActionMemoryBySeatId = new Map(seats.map((seat) => [seat.seatId, { recentActions: [] }]));
    const dealerSeatId = chooseDealerSeatId(seats, createMulberry32(initialSeed ^ 0x9e3779b9));

    this.state = createTexasHoldemState({
      handId: 'hand-boot',
      dealerSeatId,
      seed: initialSeed,
      config: {
        smallBlind: 5,
        bigBlind: 10,
        minBuyIn: 100,
        maxBuyIn: 1000,
      },
      seats,
    });
    this.resetBotRandomSource(this.state.rngSeed);

    this.actionState = buildTableActionStateDTO(this.state);
    this.botSeatIds = new Set(this.state.seats.map((seat) => seat.seatId).filter((seatId) => seatId !== this.userSeatId));

    this.pushLog('SYSTEM', `Initialized local simulation table (seed=${initialSeed}, dealer=Seat ${dealerSeatId}).`);
    this.startNextHand();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.toViewModel());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public startNextHand(): void {
    this.safeExecute(() => {
      const handId = `hand-${String(this.handNumber).padStart(4, '0')}`;
      const nextSeed = createRuntimeSeed(this.state.rngSeed ^ this.handNumber);

      this.handNumber += 1;
      this.runCommand({ type: 'START_HAND', handId, seed: nextSeed });
      this.resetBotRandomSource(nextSeed);
      this.runCommand({ type: 'POST_BLINDS' });
      this.runCommand({ type: 'DEAL_HOLE' });
      this.runAutomationLoop();
    }, 'Unable to start next hand.');

    this.emit();
  }

  public performUserAction(intent: UserActionIntent): void {
    this.safeExecute(() => {
      if (!isBettingPhase(this.state.phase)) {
        throw new Error(`Cannot act in phase ${this.state.phase}.`);
      }

      if (this.state.actingSeatId !== this.userSeatId) {
        throw new Error(`Seat ${this.userSeatId} is not acting.`);
      }

      const command: TableCommand = {
        type: 'PLAYER_ACTION',
        seatId: this.userSeatId,
        action: intent.action,
      };

      if (typeof intent.amount === 'number') {
        command.amount = intent.amount;
      }

      this.runCommand(command);
      this.runAutomationLoop();
    }, `Unable to apply ${intent.action}.`);

    this.emit();
  }

  private runAutomationLoop(): void {
    for (let guard = 0; guard < 256; guard += 1) {
      if (this.state.phase === 'DEAL_FLOP') {
        this.runCommand({ type: 'DEAL_FLOP' });
        continue;
      }

      if (this.state.phase === 'DEAL_TURN') {
        this.runCommand({ type: 'DEAL_TURN' });
        continue;
      }

      if (this.state.phase === 'DEAL_RIVER') {
        this.runCommand({ type: 'DEAL_RIVER' });
        continue;
      }

      if (this.state.phase === 'SHOWDOWN') {
        this.runCommand({ type: 'RESOLVE_SHOWDOWN' });
        continue;
      }

      if (!isBettingPhase(this.state.phase)) {
        return;
      }

      const actingSeatId = this.state.actingSeatId;
      if (actingSeatId < 0 || actingSeatId === this.userSeatId || !this.botSeatIds.has(actingSeatId)) {
        return;
      }

      const command = chooseBotCommand(
        this.state,
        this.actionState,
        actingSeatId,
        this.seatActionMemoryBySeatId,
        this.botRandomSource,
      );
      if (!command) {
        this.pushLog('ERROR', `No legal bot command available for seat ${actingSeatId}.`);
        return;
      }

      this.runCommand(command);
    }

    this.pushLog('ERROR', 'Automation loop guard reached; stopped to prevent infinite loop.');
  }

  private runCommand(command: TableCommand): void {
    this.pushLog('COMMAND', this.describeCommand(command));
    const result = applyTexasHoldemCommand(this.state, command);

    this.state = result.state;
    this.actionState = buildTableActionStateDTO(this.state);

    for (const event of result.events) {
      this.recordEventForMemory(event);
      this.pushLog('EVENT', this.describeEvent(event));
    }
  }

  private describeCommand(command: TableCommand): string {
    if (command.type === 'PLAYER_ACTION') {
      const suffix = typeof command.amount === 'number' ? ` ${command.amount}` : '';
      return `${command.type} seat=${command.seatId} action=${command.action}${suffix}`;
    }

    if (command.type === 'START_HAND') {
      return `${command.type} hand=${command.handId} seed=${command.seed ?? 'auto'}`;
    }

    return command.type;
  }

  private describeEvent(event: DomainEvent): string {
    const payloadText = truncate(JSON.stringify(event.payload));
    return `${event.type} ${payloadText}`;
  }

  private recordEventForMemory(event: DomainEvent): void {
    const trackedAction = toTrackedActionFromEventType(event.type);
    if (!trackedAction) {
      return;
    }

    const seatId = readSeatIdFromPayload(event.payload);
    if (!seatId) {
      return;
    }

    trackSeatAction(this.seatActionMemoryBySeatId, seatId, trackedAction);
  }

  private resetBotRandomSource(seed: number): void {
    this.botRandomSource = createMulberry32((seed ^ BOT_RANDOM_MASK) >>> 0);
  }

  private safeExecute(action: () => void, message: string): void {
    try {
      action();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.pushLog('ERROR', `${message} ${reason}`);
    }
  }

  private pushLog(kind: TableLogKind, message: string): void {
    this.logs.push({
      id: this.nextLogId,
      timestamp: new Date().toISOString().slice(11, 19),
      kind,
      message,
    });
    this.nextLogId += 1;

    if (this.logs.length > MAX_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_LOGS);
    }
  }

  private toViewModel(): TableViewModel {
    return {
      state: this.state,
      actionState: this.actionState,
      userSeatId: this.userSeatId,
      handNumber: this.handNumber - 1,
      logs: [...this.logs],
    };
  }

  private emit(): void {
    const model = this.toViewModel();
    for (const listener of this.listeners) {
      listener(model);
    }
  }
}
