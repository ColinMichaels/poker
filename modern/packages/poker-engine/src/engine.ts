import type { CommandResult, DomainEvent, PlayerAction, TableCommand } from './commands.ts';
import { drawCards, createShuffledDeck } from './deck.ts';
import { compareEvaluatedHands } from './evaluator.ts';
import { resolveShowdown } from './showdown.ts';
import type { EngineConfig, Payout, SeatDefinition, SeatState, SidePot, TablePhase, TexasHoldemState } from './state.ts';
import type { ActionOptionDTO, PokerAction, SeatActionStateDTO, TableActionStateDTO } from '../../game-contracts/src/index.ts';

export interface CreateStateParams {
  handId: string;
  dealerSeatId: number;
  seed: number;
  config: EngineConfig;
  seats: SeatDefinition[];
}

export interface ActionLegality {
  action: PlayerAction;
  minAmount?: number;
  maxAmount?: number;
  semantics: 'TARGET_BET' | 'ALL_IN' | 'NO_AMOUNT';
}

const bettingPhases: TablePhase[] = ['BETTING_PRE_FLOP', 'BETTING_FLOP', 'BETTING_TURN', 'BETTING_RIVER'];
const allActions: PokerAction[] = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'];

function cloneSeat(seat: SeatState): SeatState {
  return {
    ...seat,
    holeCards: seat.holeCards.map((card) => ({ ...card })),
  };
}

function sortSeatsById<T extends { seatId: number }>(seats: readonly T[]): T[] {
  return [...seats].sort((left, right) => left.seatId - right.seatId);
}

function assertAtLeastTwoActiveSeats(seats: readonly SeatState[]): void {
  const active = seats.filter((seat) => seat.stack > 0);
  if (active.length < 2) {
    throw new Error('At least two active seats with chips are required to start a hand.');
  }
}

function toSeatState(definition: SeatDefinition): SeatState {
  return {
    seatId: definition.seatId,
    playerId: definition.playerId,
    stack: definition.stack,
    folded: false,
    allIn: definition.stack <= 0,
    holeCards: [],
    currentBet: 0,
    totalCommitted: 0,
  };
}

function seatExists(seats: readonly SeatState[], seatId: number): boolean {
  return seats.some((seat) => seat.seatId === seatId);
}

function getSeatById(seats: readonly SeatState[], seatId: number): SeatState {
  const seat = seats.find((candidate) => candidate.seatId === seatId);
  if (!seat) {
    throw new Error(`Seat ${seatId} was not found.`);
  }
  return seat;
}

function getEligibleOrderedSeatIds(
  seats: readonly SeatState[],
  startAfterSeatId: number,
  predicate: (seat: SeatState) => boolean,
): number[] {
  const sorted = sortSeatsById(seats);
  const anchorIndex = sorted.findIndex((seat) => seat.seatId === startAfterSeatId);

  if (anchorIndex < 0) {
    throw new Error(`Anchor seat ${startAfterSeatId} was not found while building seat order.`);
  }

  const ordered: number[] = [];
  let index = anchorIndex;

  for (let steps = 0; steps < sorted.length; steps += 1) {
    index = (index + 1) % sorted.length;
    const seat = sorted[index];
    if (predicate(seat)) {
      ordered.push(seat.seatId);
    }
  }

  return ordered;
}

function determineBlindSeats(seats: readonly SeatState[], dealerSeatId: number): { smallBlindSeatId: number; bigBlindSeatId: number } {
  const activeSeats = sortSeatsById(seats.filter((seat) => seat.stack > 0));

  if (activeSeats.length < 2) {
    throw new Error('Cannot determine blinds with fewer than two active seats.');
  }

  const dealerIndex = activeSeats.findIndex((seat) => seat.seatId === dealerSeatId);
  if (dealerIndex < 0) {
    throw new Error(`Dealer seat ${dealerSeatId} is not active.`);
  }

  if (activeSeats.length === 2) {
    const smallBlindSeatId = dealerSeatId;
    const bigBlindSeatId = activeSeats[(dealerIndex + 1) % activeSeats.length].seatId;
    return { smallBlindSeatId, bigBlindSeatId };
  }

  const smallBlindSeatId = activeSeats[(dealerIndex + 1) % activeSeats.length].seatId;
  const bigBlindSeatId = activeSeats[(dealerIndex + 2) % activeSeats.length].seatId;
  return { smallBlindSeatId, bigBlindSeatId };
}

function postBlindToSeat(seat: SeatState, amount: number): { seat: SeatState; posted: number } {
  const posted = Math.min(amount, seat.stack);

  return {
    posted,
    seat: {
      ...seat,
      stack: seat.stack - posted,
      allIn: seat.stack - posted === 0,
      currentBet: seat.currentBet + posted,
      totalCommitted: seat.totalCommitted + posted,
    },
  };
}

function resetSeatForHand(seat: SeatState): SeatState {
  return {
    ...seat,
    folded: false,
    allIn: seat.stack <= 0,
    holeCards: [],
    currentBet: 0,
    totalCommitted: 0,
  };
}

function isActionable(seat: SeatState): boolean {
  return !seat.folded && !seat.allIn && seat.stack > 0;
}

function sumPotFromSeats(seats: readonly SeatState[]): number {
  return seats.reduce((sum, seat) => sum + seat.totalCommitted, 0);
}

function clearStreetBets(seats: readonly SeatState[]): SeatState[] {
  return seats.map((seat) => ({
    ...seat,
    currentBet: 0,
  }));
}

function getNextDealPhase(phase: TablePhase): TablePhase {
  switch (phase) {
    case 'BETTING_PRE_FLOP':
      return 'DEAL_FLOP';
    case 'BETTING_FLOP':
      return 'DEAL_TURN';
    case 'BETTING_TURN':
      return 'DEAL_RIVER';
    case 'BETTING_RIVER':
      return 'SHOWDOWN';
    default:
      throw new Error(`No next deal phase for phase ${phase}.`);
  }
}

function applyPayoutsToState(state: TexasHoldemState, payouts: readonly Payout[], reason: 'SOLE_SURVIVOR' | 'SHOWDOWN'): TexasHoldemState {
  const payoutMap = new Map<number, number>();
  for (const payout of payouts) {
    payoutMap.set(payout.seatId, (payoutMap.get(payout.seatId) ?? 0) + payout.amount);
  }

  const seats = state.seats.map((seat) => {
    const payout = payoutMap.get(seat.seatId) ?? 0;
    return {
      ...seat,
      stack: seat.stack + payout,
    };
  });

  return {
    ...state,
    seats,
    pot: 0,
    phase: 'HAND_COMPLETE',
    actionQueue: [],
    actingSeatId: -1,
    canRaiseSeatIds: [],
    payouts: payouts.map((payout) => ({ ...payout, reason })),
  };
}

function buildSidePots(seats: readonly SeatState[]): SidePot[] {
  const commitments = new Map<number, number>();

  for (const seat of seats) {
    if (seat.totalCommitted > 0) {
      commitments.set(seat.seatId, seat.totalCommitted);
    }
  }

  const sidePots: SidePot[] = [];

  while (true) {
    const participants = Array.from(commitments.entries()).filter(([, amount]) => amount > 0);
    if (participants.length === 0) {
      break;
    }

    const minCommitment = Math.min(...participants.map(([, amount]) => amount));
    const participantSeatIds = participants.map(([seatId]) => seatId).sort((a, b) => a - b);
    const eligibleSeatIds = participantSeatIds.filter((seatId) => {
      const seat = getSeatById(seats, seatId);
      return !seat.folded;
    });

    const amount = minCommitment * participants.length;

    sidePots.push({
      amount,
      participantSeatIds,
      eligibleSeatIds,
    });

    for (const [seatId, contribution] of participants) {
      commitments.set(seatId, contribution - minCommitment);
    }
  }

  return sidePots;
}

function resolveSoleSurvivor(state: TexasHoldemState): CommandResult<TexasHoldemState> {
  const contenders = state.seats.filter((seat) => !seat.folded && (seat.totalCommitted > 0 || seat.stack > 0));

  if (contenders.length !== 1) {
    throw new Error('resolveSoleSurvivor requires exactly one remaining contender.');
  }

  const winner = contenders[0];
  const payout: Payout = {
    seatId: winner.seatId,
    amount: state.pot,
    reason: 'SOLE_SURVIVOR',
  };

  const nextState = applyPayoutsToState(state, [payout], 'SOLE_SURVIVOR');

  return {
    state: nextState,
    events: [
      {
        type: 'HAND_WON_UNCONTESTED',
        payload: {
          seatId: winner.seatId,
          amount: payout.amount,
        },
      },
    ],
  };
}

function resolveShowdownPayouts(state: TexasHoldemState): CommandResult<TexasHoldemState> {
  if (state.board.length !== 5) {
    throw new Error(`Showdown requires 5 board cards. Received: ${state.board.length}`);
  }

  const contenders = state.seats.filter((seat) => !seat.folded);
  if (contenders.length === 0) {
    throw new Error('Showdown cannot run with zero contenders.');
  }

  if (contenders.length === 1) {
    return resolveSoleSurvivor(state);
  }

  const showdown = resolveShowdown(
    state.board,
    contenders.map((seat) => ({
      seatId: seat.seatId,
      hole: seat.holeCards,
      folded: false,
    })),
  );

  const sidePots = buildSidePots(state.seats);
  const payoutBySeat = new Map<number, number>();

  for (const sidePot of sidePots) {
    const eligibleRankings = showdown.rankings.filter((ranking) => sidePot.eligibleSeatIds.includes(ranking.seatId));

    if (eligibleRankings.length === 0) {
      continue;
    }

    let best = eligibleRankings[0];
    for (let i = 1; i < eligibleRankings.length; i += 1) {
      const current = eligibleRankings[i];
      if (compareEvaluatedHands(current.hand, best.hand) > 0) {
        best = current;
      }
    }

    const winners = eligibleRankings
      .filter((ranking) => compareEvaluatedHands(ranking.hand, best.hand) === 0)
      .map((ranking) => ranking.seatId)
      .sort((a, b) => a - b);

    const splitAmount = Math.floor(sidePot.amount / winners.length);
    let remainder = sidePot.amount % winners.length;

    for (const seatId of winners) {
      const bonusChip = remainder > 0 ? 1 : 0;
      if (remainder > 0) {
        remainder -= 1;
      }
      const amount = splitAmount + bonusChip;
      payoutBySeat.set(seatId, (payoutBySeat.get(seatId) ?? 0) + amount);
    }
  }

  const payouts: Payout[] = Array.from(payoutBySeat.entries())
    .map(([seatId, amount]) => ({ seatId, amount, reason: 'SHOWDOWN' as const }))
    .sort((a, b) => a.seatId - b.seatId);

  const nextState = applyPayoutsToState(
    {
      ...state,
      sidePots,
    },
    payouts,
    'SHOWDOWN',
  );

  return {
    state: nextState,
    events: [
      {
        type: 'SHOWDOWN_RESOLVED',
        payload: {
          winners: showdown.winners,
          rankings: showdown.rankings,
          sidePots,
          payouts,
        },
      },
    ],
  };
}

function buildActionQueueForBettingRound(state: TexasHoldemState, phase: TablePhase): number[] {
  if (!bettingPhases.includes(phase)) {
    throw new Error(`Cannot build action queue for non-betting phase ${phase}.`);
  }

  const startAfterSeatId = phase === 'BETTING_PRE_FLOP' ? state.bigBlindSeatId : state.buttonSeatId;

  return getEligibleOrderedSeatIds(state.seats, startAfterSeatId, (seat) => isActionable(seat));
}

function startBettingRound(state: TexasHoldemState, phase: TablePhase): TexasHoldemState {
  const queue = buildActionQueueForBettingRound(state, phase);

  if (queue.length === 0) {
    return {
      ...state,
      phase: getNextDealPhase(phase),
      actionQueue: [],
      actingSeatId: -1,
      canRaiseSeatIds: [],
      currentBet: 0,
      minRaise: state.config.bigBlind,
      seats: clearStreetBets(state.seats),
    };
  }

  return {
    ...state,
    phase,
    actionQueue: queue,
    actingSeatId: queue[0],
    canRaiseSeatIds: [...queue],
  };
}

function completeBettingRound(state: TexasHoldemState): CommandResult<TexasHoldemState> {
  const contenders = state.seats.filter((seat) => !seat.folded);
  if (contenders.length === 1) {
    return resolveSoleSurvivor(state);
  }

  const nextPhase = getNextDealPhase(state.phase);

  return {
    state: {
      ...state,
      phase: nextPhase,
      actionQueue: [],
      actingSeatId: -1,
      canRaiseSeatIds: [],
      currentBet: 0,
      minRaise: state.config.bigBlind,
      seats: clearStreetBets(state.seats),
    },
    events: [
      {
        type: 'BETTING_ROUND_COMPLETED',
        payload: {
          fromPhase: state.phase,
          nextPhase,
        },
      },
    ],
  };
}

function normalizeActionQueueAfterSimpleAction(state: TexasHoldemState): TexasHoldemState {
  const actingSeatId = state.actionQueue[0] ?? -1;
  const [, ...rest] = state.actionQueue;

  return {
    ...state,
    actionQueue: rest,
    actingSeatId: rest[0] ?? -1,
    canRaiseSeatIds: state.canRaiseSeatIds.filter((seatId) => seatId !== actingSeatId),
  };
}

function queueAfterFullRaise(state: TexasHoldemState, raiserSeatId: number): number[] {
  return getEligibleOrderedSeatIds(
    state.seats,
    raiserSeatId,
    (seat) => isActionable(seat) && seat.seatId !== raiserSeatId,
  );
}

function queueAfterShortAllIn(state: TexasHoldemState, allInSeatId: number, newCurrentBet: number): number[] {
  return getEligibleOrderedSeatIds(
    state.seats,
    allInSeatId,
    (seat) => isActionable(seat) && seat.seatId !== allInSeatId && seat.currentBet < newCurrentBet,
  );
}

function seatToCallAmount(state: TexasHoldemState, seat: SeatState): number {
  return Math.max(0, state.currentBet - seat.currentBet);
}

function isBettingPhase(phase: TablePhase): boolean {
  return bettingPhases.includes(phase);
}

export function getLegalActions(state: TexasHoldemState, seatId: number): ActionLegality[] {
  if (!isBettingPhase(state.phase)) {
    return [];
  }

  if (state.actingSeatId !== seatId) {
    return [];
  }

  const seat = getSeatById(state.seats, seatId);
  if (!isActionable(seat)) {
    return [];
  }

  const toCall = seatToCallAmount(state, seat);
  const canRaise = state.canRaiseSeatIds.includes(seatId);
  const legal: ActionLegality[] = [];

  legal.push({ action: 'FOLD', semantics: 'NO_AMOUNT' });
  legal.push({ action: 'ALL_IN', semantics: 'ALL_IN', minAmount: seat.stack, maxAmount: seat.stack });

  if (toCall === 0) {
    legal.push({ action: 'CHECK', semantics: 'NO_AMOUNT' });

    if (state.currentBet === 0 && seat.stack > 0 && canRaise) {
      const minAmount = Math.min(state.config.bigBlind, seat.stack);
      legal.push({
        action: 'BET',
        semantics: 'TARGET_BET',
        minAmount,
        maxAmount: seat.currentBet + seat.stack,
      });
    }
  } else {
    legal.push({ action: 'CALL', semantics: 'NO_AMOUNT' });

    if (seat.stack > toCall && canRaise) {
      const minRaiseTarget = state.currentBet + state.minRaise;
      const maxRaiseTarget = seat.currentBet + seat.stack;

      if (maxRaiseTarget >= minRaiseTarget) {
        legal.push({
          action: 'RAISE',
          semantics: 'TARGET_BET',
          minAmount: minRaiseTarget,
          maxAmount: maxRaiseTarget,
        });
      }
    }
  }

  return legal;
}

function toActionOptionDTO(legalActions: readonly ActionLegality[], action: PokerAction): ActionOptionDTO {
  const legal = legalActions.find((item) => item.action === action);

  if (!legal) {
    const fallbackSemantics = action === 'ALL_IN' ? 'ALL_IN' : action === 'BET' || action === 'RAISE' ? 'TARGET_BET' : 'NO_AMOUNT';
    return {
      action,
      allowed: false,
      amountSemantics: fallbackSemantics,
      minAmount: null,
      maxAmount: null,
    };
  }

  return {
    action: legal.action,
    allowed: true,
    amountSemantics: legal.semantics,
    minAmount: legal.minAmount ?? null,
    maxAmount: legal.maxAmount ?? null,
  };
}

export function buildTableActionStateDTO(state: TexasHoldemState): TableActionStateDTO {
  const seats = sortSeatsById(state.seats).map<SeatActionStateDTO>((seat) => {
    const legalActions = getLegalActions(state, seat.seatId);
    const toCall = Math.max(0, state.currentBet - seat.currentBet);

    return {
      seatId: seat.seatId,
      isActingSeat: state.actingSeatId === seat.seatId,
      folded: seat.folded,
      allIn: seat.allIn,
      stack: seat.stack,
      currentBet: seat.currentBet,
      toCall,
      canRaise: state.canRaiseSeatIds.includes(seat.seatId),
      actions: allActions.map((action) => toActionOptionDTO(legalActions, action)),
    };
  });

  return {
    handId: state.handId,
    phase: state.phase,
    actingSeatId: state.actingSeatId,
    seats,
  };
}

function assertActionAllowed(state: TexasHoldemState, seat: SeatState, action: PlayerAction, amount?: number): void {
  if (!isBettingPhase(state.phase)) {
    throw new Error(`PLAYER_ACTION only allowed in betting phases. Current phase: ${state.phase}`);
  }

  if (state.actingSeatId !== seat.seatId) {
    throw new Error(`Seat ${seat.seatId} is out of turn. Current acting seat: ${state.actingSeatId}.`);
  }

  if (state.actionQueue[0] !== seat.seatId) {
    throw new Error(`Seat ${seat.seatId} is not at the front of the action queue.`);
  }

  if (!isActionable(seat)) {
    throw new Error(`Seat ${seat.seatId} is not actionable (folded/all-in/or zero stack).`);
  }

  const legal = getLegalActions(state, seat.seatId);
  const rule = legal.find((candidate) => candidate.action === action);
  if (!rule) {
    throw new Error(`Action ${action} is not legal for seat ${seat.seatId} in phase ${state.phase}.`);
  }

  if (rule.semantics === 'TARGET_BET') {
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      throw new Error(`Action ${action} requires integer amount (target street bet).`);
    }

    if (rule.minAmount !== undefined && amount < rule.minAmount) {
      throw new Error(`Action ${action} amount ${amount} is below minimum ${rule.minAmount}.`);
    }

    if (rule.maxAmount !== undefined && amount > rule.maxAmount) {
      throw new Error(`Action ${action} amount ${amount} is above maximum ${rule.maxAmount}.`);
    }
  }
}

function updateSeatInState(state: TexasHoldemState, seatId: number, updater: (seat: SeatState) => SeatState): TexasHoldemState {
  return {
    ...state,
    seats: state.seats.map((seat) => (seat.seatId === seatId ? updater(seat) : seat)),
  };
}

function applyPlayerAction(state: TexasHoldemState, command: Extract<TableCommand, { type: 'PLAYER_ACTION' }>): CommandResult<TexasHoldemState> {
  const seat = getSeatById(state.seats, command.seatId);
  assertActionAllowed(state, seat, command.action, command.amount);

  const toCall = seatToCallAmount(state, seat);

  let nextState = { ...state };
  const events: DomainEvent[] = [];

  switch (command.action) {
    case 'FOLD': {
      nextState = updateSeatInState(nextState, seat.seatId, (currentSeat) => ({
        ...currentSeat,
        folded: true,
      }));

      nextState = normalizeActionQueueAfterSimpleAction(nextState);

      events.push({
        type: 'PLAYER_FOLDED',
        payload: { seatId: seat.seatId },
      });
      break;
    }

    case 'CHECK': {
      nextState = normalizeActionQueueAfterSimpleAction(nextState);

      events.push({
        type: 'PLAYER_CHECKED',
        payload: { seatId: seat.seatId },
      });
      break;
    }

    case 'CALL': {
      const callAmount = Math.min(toCall, seat.stack);

      nextState = updateSeatInState(nextState, seat.seatId, (currentSeat) => {
        const stack = currentSeat.stack - callAmount;
        return {
          ...currentSeat,
          stack,
          allIn: stack === 0,
          currentBet: currentSeat.currentBet + callAmount,
          totalCommitted: currentSeat.totalCommitted + callAmount,
        };
      });

      nextState = {
        ...normalizeActionQueueAfterSimpleAction(nextState),
        pot: sumPotFromSeats(nextState.seats),
      };

      events.push({
        type: 'PLAYER_CALLED',
        payload: {
          seatId: seat.seatId,
          amount: callAmount,
        },
      });
      break;
    }

    case 'BET': {
      const targetBet = command.amount as number;
      const wager = targetBet - seat.currentBet;

      nextState = updateSeatInState(nextState, seat.seatId, (currentSeat) => {
        const stack = currentSeat.stack - wager;
        return {
          ...currentSeat,
          stack,
          allIn: stack === 0,
          currentBet: currentSeat.currentBet + wager,
          totalCommitted: currentSeat.totalCommitted + wager,
        };
      });

      const queue = queueAfterFullRaise(nextState, seat.seatId);

      nextState = {
        ...nextState,
        actionQueue: queue,
        actingSeatId: queue[0] ?? -1,
        canRaiseSeatIds: [...queue],
        currentBet: targetBet,
        minRaise: targetBet,
        pot: sumPotFromSeats(nextState.seats),
        lastAggressorSeatId: seat.seatId,
      };

      events.push({
        type: 'PLAYER_BET',
        payload: {
          seatId: seat.seatId,
          targetBet,
          wager,
        },
      });
      break;
    }

    case 'RAISE': {
      const targetBet = command.amount as number;
      const wager = targetBet - seat.currentBet;
      const raiseSize = targetBet - state.currentBet;

      nextState = updateSeatInState(nextState, seat.seatId, (currentSeat) => {
        const stack = currentSeat.stack - wager;
        return {
          ...currentSeat,
          stack,
          allIn: stack === 0,
          currentBet: currentSeat.currentBet + wager,
          totalCommitted: currentSeat.totalCommitted + wager,
        };
      });

      const queue = queueAfterFullRaise(nextState, seat.seatId);

      nextState = {
        ...nextState,
        actionQueue: queue,
        actingSeatId: queue[0] ?? -1,
        canRaiseSeatIds: [...queue],
        currentBet: targetBet,
        minRaise: raiseSize,
        pot: sumPotFromSeats(nextState.seats),
        lastAggressorSeatId: seat.seatId,
      };

      events.push({
        type: 'PLAYER_RAISED',
        payload: {
          seatId: seat.seatId,
          targetBet,
          wager,
          raiseSize,
        },
      });
      break;
    }

    case 'ALL_IN': {
      const wager = seat.stack;
      const newSeatBet = seat.currentBet + wager;
      const raiseSize = newSeatBet - state.currentBet;
      const isFullRaise = newSeatBet > state.currentBet && raiseSize >= state.minRaise;

      nextState = updateSeatInState(nextState, seat.seatId, (currentSeat) => ({
        ...currentSeat,
        stack: 0,
        allIn: true,
        currentBet: currentSeat.currentBet + wager,
        totalCommitted: currentSeat.totalCommitted + wager,
      }));

      if (newSeatBet > state.currentBet) {
        if (isFullRaise) {
          const queue = queueAfterFullRaise(nextState, seat.seatId);
          nextState = {
            ...nextState,
            actionQueue: queue,
            actingSeatId: queue[0] ?? -1,
            canRaiseSeatIds: [...queue],
            currentBet: newSeatBet,
            minRaise: raiseSize,
            lastAggressorSeatId: seat.seatId,
          };
        } else {
          const queue = queueAfterShortAllIn(nextState, seat.seatId, newSeatBet);
          nextState = {
            ...nextState,
            actionQueue: queue,
            actingSeatId: queue[0] ?? -1,
            canRaiseSeatIds: nextState.canRaiseSeatIds.filter((candidateSeatId) => candidateSeatId !== seat.seatId),
            currentBet: newSeatBet,
          };
        }
      } else {
        nextState = normalizeActionQueueAfterSimpleAction(nextState);
      }

      nextState = {
        ...nextState,
        pot: sumPotFromSeats(nextState.seats),
      };

      events.push({
        type: 'PLAYER_ALL_IN',
        payload: {
          seatId: seat.seatId,
          wager,
          newSeatBet,
          isFullRaise,
        },
      });
      break;
    }

    default: {
      const _never: never = command.action;
      return _never;
    }
  }

  const contenders = nextState.seats.filter((candidate) => !candidate.folded);
  if (contenders.length === 1) {
    const payoutResolution = resolveSoleSurvivor(nextState);
    return {
      state: payoutResolution.state,
      events: [...events, ...payoutResolution.events],
    };
  }

  if (nextState.actionQueue.length === 0) {
    const completedRound = completeBettingRound(nextState);
    return {
      state: completedRound.state,
      events: [...events, ...completedRound.events],
    };
  }

  return {
    state: nextState,
    events,
  };
}

function initializeHandStateForAction(state: TexasHoldemState, handId: string, seed: number): CommandResult<TexasHoldemState> {
  const seats = sortSeatsById(state.seats.map((seat) => resetSeatForHand(seat)));
  assertAtLeastTwoActiveSeats(seats);

  const { smallBlindSeatId, bigBlindSeatId } = determineBlindSeats(seats, state.dealerSeatId);

  return {
    state: {
      ...state,
      handId,
      phase: 'SEATED',
      buttonSeatId: state.dealerSeatId,
      smallBlindSeatId,
      bigBlindSeatId,
      actingSeatId: -1,
      actionQueue: [],
      canRaiseSeatIds: [],
      currentBet: 0,
      minRaise: state.config.bigBlind,
      pot: 0,
      board: [],
      burnCards: [],
      deck: createShuffledDeck(seed),
      seats,
      lastAggressorSeatId: null,
      sidePots: [],
      payouts: [],
      rngSeed: seed,
    },
    events: [
      {
        type: 'HAND_STARTED',
        payload: { handId, seed },
      },
    ],
  };
}

function postBlinds(state: TexasHoldemState): CommandResult<TexasHoldemState> {
  if (state.phase !== 'SEATED') {
    throw new Error(`POST_BLINDS only allowed in SEATED phase. Current phase: ${state.phase}`);
  }

  const seats = sortSeatsById(state.seats.map((seat) => cloneSeat(seat)));

  const sbIndex = seats.findIndex((seat) => seat.seatId === state.smallBlindSeatId);
  const bbIndex = seats.findIndex((seat) => seat.seatId === state.bigBlindSeatId);

  if (sbIndex < 0 || bbIndex < 0) {
    throw new Error('Unable to locate blind seats while posting blinds.');
  }

  const sb = postBlindToSeat(seats[sbIndex], state.config.smallBlind);
  seats[sbIndex] = sb.seat;

  const bb = postBlindToSeat(seats[bbIndex], state.config.bigBlind);
  seats[bbIndex] = bb.seat;

  const nextState: TexasHoldemState = {
    ...state,
    phase: 'BLINDS_POSTED',
    seats,
    currentBet: Math.max(sb.posted, bb.posted),
    minRaise: state.config.bigBlind,
    pot: sumPotFromSeats(seats),
    actingSeatId: -1,
    actionQueue: [],
    canRaiseSeatIds: [],
    lastAggressorSeatId: state.bigBlindSeatId,
  };

  return {
    state: nextState,
    events: [
      {
        type: 'BLIND_POSTED',
        payload: { seatId: state.smallBlindSeatId, amount: sb.posted, blind: 'SMALL' },
      },
      {
        type: 'BLIND_POSTED',
        payload: { seatId: state.bigBlindSeatId, amount: bb.posted, blind: 'BIG' },
      },
    ],
  };
}

function dealHole(state: TexasHoldemState): CommandResult<TexasHoldemState> {
  if (state.phase !== 'BLINDS_POSTED') {
    throw new Error(`DEAL_HOLE only allowed in BLINDS_POSTED phase. Current phase: ${state.phase}`);
  }

  const seats = sortSeatsById(state.seats.map((seat) => cloneSeat(seat)));
  const activeSeatIds = getEligibleOrderedSeatIds(seats, state.buttonSeatId, (seat) => !seat.folded);

  let deck = state.deck.map((card) => ({ ...card }));

  for (let round = 0; round < 2; round += 1) {
    for (const seatId of activeSeatIds) {
      const seatIndex = seats.findIndex((seat) => seat.seatId === seatId);
      const draw = drawCards(deck, 1);
      deck = draw.remaining;
      seats[seatIndex] = {
        ...seats[seatIndex],
        holeCards: [...seats[seatIndex].holeCards, draw.drawn[0]],
      };
    }
  }

  let nextState: TexasHoldemState = {
    ...state,
    seats,
    deck,
    phase: 'BETTING_PRE_FLOP',
  };

  nextState = startBettingRound(nextState, 'BETTING_PRE_FLOP');

  return {
    state: nextState,
    events: activeSeatIds.map((seatId) => ({
      type: 'HOLE_CARDS_DEALT',
      payload: { seatId, count: 2 },
    })),
  };
}

function dealBoardStreet(state: TexasHoldemState, commandType: 'DEAL_FLOP' | 'DEAL_TURN' | 'DEAL_RIVER'): CommandResult<TexasHoldemState> {
  const expectedPhase: Record<typeof commandType, TablePhase> = {
    DEAL_FLOP: 'DEAL_FLOP',
    DEAL_TURN: 'DEAL_TURN',
    DEAL_RIVER: 'DEAL_RIVER',
  };

  if (state.phase !== expectedPhase[commandType]) {
    throw new Error(`${commandType} only allowed in ${expectedPhase[commandType]} phase. Current phase: ${state.phase}`);
  }

  const burnDraw = drawCards(state.deck, 1);
  let deck = burnDraw.remaining;
  const burnCards = [...state.burnCards, burnDraw.drawn[0]];

  const boardCount = commandType === 'DEAL_FLOP' ? 3 : 1;
  const boardDraw = drawCards(deck, boardCount);
  deck = boardDraw.remaining;

  const board = [...state.board, ...boardDraw.drawn];

  const bettingPhase: Record<typeof commandType, TablePhase> = {
    DEAL_FLOP: 'BETTING_FLOP',
    DEAL_TURN: 'BETTING_TURN',
    DEAL_RIVER: 'BETTING_RIVER',
  };

  let nextState: TexasHoldemState = {
    ...state,
    deck,
    burnCards,
    board,
  };

  nextState = startBettingRound(nextState, bettingPhase[commandType]);

  return {
    state: nextState,
    events: [
      {
        type: commandType,
        payload: {
          burned: burnDraw.drawn[0].code,
          dealt: boardDraw.drawn.map((card) => card.code),
          board: board.map((card) => card.code),
          nextPhase: nextState.phase,
        },
      },
    ],
  };
}

export function createTexasHoldemState(params: CreateStateParams): TexasHoldemState {
  if (params.seats.length < 2) {
    throw new Error('TexasHoldemState requires at least two seats.');
  }

  const seats = sortSeatsById(params.seats.map((seat) => toSeatState(seat)));

  if (!seatExists(seats, params.dealerSeatId)) {
    throw new Error(`Dealer seat ${params.dealerSeatId} does not exist.`);
  }

  assertAtLeastTwoActiveSeats(seats);

  const { smallBlindSeatId, bigBlindSeatId } = determineBlindSeats(seats, params.dealerSeatId);

  return {
    handId: params.handId,
    phase: 'SEATED',
    config: { ...params.config },
    dealerSeatId: params.dealerSeatId,
    buttonSeatId: params.dealerSeatId,
    smallBlindSeatId,
    bigBlindSeatId,
    actingSeatId: -1,
    actionQueue: [],
    canRaiseSeatIds: [],
    currentBet: 0,
    minRaise: params.config.bigBlind,
    pot: 0,
    board: [],
    burnCards: [],
    deck: createShuffledDeck(params.seed),
    seats,
    lastAggressorSeatId: null,
    sidePots: [],
    payouts: [],
    rngSeed: params.seed,
  };
}

export function applyTexasHoldemCommand(state: TexasHoldemState, command: TableCommand): CommandResult<TexasHoldemState> {
  switch (command.type) {
    case 'START_HAND': {
      const nextSeed = command.seed ?? state.rngSeed + 1;
      return initializeHandStateForAction(state, command.handId, nextSeed);
    }

    case 'POST_BLINDS':
      return postBlinds(state);

    case 'DEAL_HOLE':
      return dealHole(state);

    case 'DEAL_FLOP':
      return dealBoardStreet(state, 'DEAL_FLOP');

    case 'DEAL_TURN':
      return dealBoardStreet(state, 'DEAL_TURN');

    case 'DEAL_RIVER':
      return dealBoardStreet(state, 'DEAL_RIVER');

    case 'RESOLVE_SHOWDOWN': {
      if (state.phase !== 'SHOWDOWN') {
        throw new Error(`RESOLVE_SHOWDOWN only allowed in SHOWDOWN phase. Current phase: ${state.phase}`);
      }
      return resolveShowdownPayouts(state);
    }

    case 'PLAYER_ACTION':
      return applyPlayerAction(state, command);

    default: {
      const _never: never = command;
      return _never;
    }
  }
}
