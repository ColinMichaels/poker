import type { CommandResult, DomainEvent, TableCommand } from './commands.ts';
import { createShuffledDeck, drawCards } from './deck.ts';
import type { EngineConfig, SeatDefinition, SeatState, TexasHoldemState } from './state.ts';

export interface CreateStateParams {
  handId: string;
  dealerSeatId: number;
  seed: number;
  config: EngineConfig;
  seats: SeatDefinition[];
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

function getActiveSeats(seats: readonly SeatState[]): SeatState[] {
  return sortSeatsById(seats.filter((seat) => seat.stack > 0));
}

function findNextSeatId(
  seats: readonly SeatState[],
  fromSeatId: number,
  predicate: (seat: SeatState) => boolean = (seat) => seat.stack > 0,
): number {
  const eligible = sortSeatsById(seats.filter(predicate));

  if (eligible.length === 0) {
    throw new Error('Unable to find next seat. No eligible seats found.');
  }

  const next = eligible.find((seat) => seat.seatId > fromSeatId);
  return next ? next.seatId : eligible[0].seatId;
}

function determineBlindSeats(seats: readonly SeatState[], dealerSeatId: number): { smallBlindSeatId: number; bigBlindSeatId: number } {
  const active = getActiveSeats(seats);

  if (active.length === 2) {
    const smallBlindSeatId = dealerSeatId;
    const bigBlindSeatId = findNextSeatId(seats, dealerSeatId, (seat) => seat.stack > 0);
    return { smallBlindSeatId, bigBlindSeatId };
  }

  const smallBlindSeatId = findNextSeatId(seats, dealerSeatId, (seat) => seat.stack > 0);
  const bigBlindSeatId = findNextSeatId(seats, smallBlindSeatId, (seat) => seat.stack > 0);

  return { smallBlindSeatId, bigBlindSeatId };
}

function postBlindToSeat(seat: SeatState, amount: number): { seat: SeatState; posted: number } {
  const posted = Math.min(amount, seat.stack);
  const remainingStack = seat.stack - posted;

  return {
    posted,
    seat: {
      ...seat,
      stack: remainingStack,
      allIn: remainingStack === 0,
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
  const actingSeatId = findNextSeatId(
    seats,
    bigBlindSeatId,
    (seat) => seat.stack > 0 && !seat.folded && !seat.allIn,
  );

  return {
    handId: params.handId,
    phase: 'SEATED',
    config: { ...params.config },
    dealerSeatId: params.dealerSeatId,
    buttonSeatId: params.dealerSeatId,
    smallBlindSeatId,
    bigBlindSeatId,
    actingSeatId,
    currentBet: 0,
    pot: 0,
    board: [],
    burnCards: [],
    deck: createShuffledDeck(params.seed),
    seats,
    lastAggressorSeatId: null,
    rngSeed: params.seed,
  };
}

function startHand(state: TexasHoldemState, handId: string, seed: number): CommandResult<TexasHoldemState> {
  const seats = sortSeatsById(state.seats.map((seat) => resetSeatForHand(seat)));
  assertAtLeastTwoActiveSeats(seats);

  const { smallBlindSeatId, bigBlindSeatId } = determineBlindSeats(seats, state.dealerSeatId);
  const actingSeatId = findNextSeatId(
    seats,
    bigBlindSeatId,
    (seat) => seat.stack > 0 && !seat.folded && !seat.allIn,
  );

  return {
    state: {
      ...state,
      handId,
      phase: 'SEATED',
      buttonSeatId: state.dealerSeatId,
      smallBlindSeatId,
      bigBlindSeatId,
      actingSeatId,
      currentBet: 0,
      pot: 0,
      board: [],
      burnCards: [],
      deck: createShuffledDeck(seed),
      seats,
      lastAggressorSeatId: null,
      rngSeed: seed,
    },
    events: [
      {
        type: 'HAND_STARTED',
        payload: {
          handId,
          seed,
        },
      },
    ],
  };
}

function postBlinds(state: TexasHoldemState): CommandResult<TexasHoldemState> {
  if (state.phase !== 'SEATED') {
    throw new Error(`POST_BLINDS only allowed in SEATED phase. Current phase: ${state.phase}`);
  }

  const seats = sortSeatsById(state.seats.map((seat) => ({ ...seat, holeCards: [...seat.holeCards] })));

  const sbIndex = seats.findIndex((seat) => seat.seatId === state.smallBlindSeatId);
  const bbIndex = seats.findIndex((seat) => seat.seatId === state.bigBlindSeatId);

  if (sbIndex < 0 || bbIndex < 0) {
    throw new Error('Unable to locate blind seats while posting blinds.');
  }

  const sb = postBlindToSeat(seats[sbIndex], state.config.smallBlind);
  seats[sbIndex] = sb.seat;

  const bb = postBlindToSeat(seats[bbIndex], state.config.bigBlind);
  seats[bbIndex] = bb.seat;

  const pot = sb.posted + bb.posted;
  const currentBet = Math.max(sb.posted, bb.posted);

  const actingSeatId = findNextSeatId(
    seats,
    state.bigBlindSeatId,
    (seat) => seat.stack > 0 && !seat.folded && !seat.allIn,
  );

  const nextState: TexasHoldemState = {
    ...state,
    phase: 'BLINDS_POSTED',
    seats,
    pot,
    currentBet,
    actingSeatId,
    lastAggressorSeatId: state.bigBlindSeatId,
  };

  const events: DomainEvent[] = [
    {
      type: 'BLIND_POSTED',
      payload: {
        seatId: state.smallBlindSeatId,
        amount: sb.posted,
        blind: 'SMALL',
      },
    },
    {
      type: 'BLIND_POSTED',
      payload: {
        seatId: state.bigBlindSeatId,
        amount: bb.posted,
        blind: 'BIG',
      },
    },
  ];

  return {
    state: nextState,
    events,
  };
}

function dealHole(state: TexasHoldemState): CommandResult<TexasHoldemState> {
  if (state.phase !== 'BLINDS_POSTED') {
    throw new Error(`DEAL_HOLE only allowed in BLINDS_POSTED phase. Current phase: ${state.phase}`);
  }

  const seats = sortSeatsById(state.seats.map((seat) => ({ ...seat, holeCards: [...seat.holeCards] })));
  const activeSeatIds: number[] = [];

  let seatId = findNextSeatId(seats, state.buttonSeatId, (seat) => seat.stack >= 0 && !seat.folded);

  do {
    activeSeatIds.push(seatId);
    seatId = findNextSeatId(seats, seatId, (seat) => seat.stack >= 0 && !seat.folded);
  } while (seatId !== activeSeatIds[0]);

  let deck = state.deck.map((card) => ({ ...card }));

  for (let round = 0; round < 2; round += 1) {
    for (const activeSeatId of activeSeatIds) {
      const seatIndex = seats.findIndex((seat) => seat.seatId === activeSeatId);
      if (seatIndex < 0) {
        throw new Error(`Unable to locate seat ${activeSeatId} during hole-card dealing.`);
      }

      const drawResult = drawCards(deck, 1);
      deck = drawResult.remaining;
      seats[seatIndex] = {
        ...seats[seatIndex],
        holeCards: [...seats[seatIndex].holeCards, drawResult.drawn[0]],
      };
    }
  }

  const nextState: TexasHoldemState = {
    ...state,
    phase: 'BETTING_PRE_FLOP',
    seats,
    deck,
  };

  const events: DomainEvent[] = activeSeatIds.map((activeSeatId) => ({
    type: 'HOLE_CARDS_DEALT',
    payload: {
      seatId: activeSeatId,
      count: 2,
    },
  }));

  return {
    state: nextState,
    events,
  };
}

export function applyTexasHoldemCommand(
  state: TexasHoldemState,
  command: TableCommand,
): CommandResult<TexasHoldemState> {
  switch (command.type) {
    case 'START_HAND': {
      const nextSeed = command.seed ?? state.rngSeed + 1;
      return startHand(state, command.handId, nextSeed);
    }

    case 'POST_BLINDS':
      return postBlinds(state);

    case 'DEAL_HOLE':
      return dealHole(state);

    case 'PLAYER_ACTION':
      throw new Error(`PLAYER_ACTION is not implemented yet. Received action: ${command.action}`);

    default: {
      const _never: never = command;
      return _never;
    }
  }
}
