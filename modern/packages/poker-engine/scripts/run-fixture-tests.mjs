import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  parseCardCodes,
  evaluateFiveCardHand,
  resolveShowdown,
  createTexasHoldemState,
  applyTexasHoldemCommand,
  getLegalActions,
  buildTableActionStateDTO,
} from '../src/index.ts';

const fixtureRoot = path.resolve(process.cwd(), 'fixtures/texas-holdem');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, fileName), 'utf8'));
}

function runHandRankFixtureTests() {
  const fixtures = readJson('hand-rank-fixtures.json');

  for (const fixture of fixtures) {
    const cards = parseCardCodes(fixture.cards);
    const result = evaluateFiveCardHand(cards);

    assert.equal(
      result.category,
      fixture.expectedCategory,
      `hand-rank fixture '${fixture.id}' expected ${fixture.expectedCategory} but got ${result.category}`,
    );
  }

  return fixtures.length;
}

function runShowdownFixtureTests() {
  const fixtures = readJson('showdown-fixtures.json');

  for (const fixture of fixtures) {
    const result = resolveShowdown(fixture.board, fixture.players);

    const winners = [...result.winners].sort((a, b) => a - b);
    const expected = [...fixture.expectedWinnerSeatIds].sort((a, b) => a - b);

    assert.deepEqual(
      winners,
      expected,
      `showdown fixture '${fixture.id}' expected winners ${expected.join(',')} but got ${winners.join(',')}`,
    );
  }

  return fixtures.length;
}

function createThreeSeatState() {
  const baseState = createTexasHoldemState({
    handId: 'hand-0',
    dealerSeatId: 1,
    seed: 100,
    config: {
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 100,
      maxBuyIn: 10000,
    },
    seats: [
      { seatId: 1, playerId: 'p1', stack: 1000 },
      { seatId: 2, playerId: 'p2', stack: 1000 },
      { seatId: 3, playerId: 'p3', stack: 1000 },
    ],
  });

  const started = applyTexasHoldemCommand(baseState, {
    type: 'START_HAND',
    handId: 'hand-1',
    seed: 1234,
  });

  const posted = applyTexasHoldemCommand(started.state, { type: 'POST_BLINDS' });
  const dealt = applyTexasHoldemCommand(posted.state, { type: 'DEAL_HOLE' });

  return dealt.state;
}

function runReducerFlowSmokeTests() {
  const state = createThreeSeatState();

  assert.equal(state.phase, 'BETTING_PRE_FLOP');
  assert.equal(state.deck.length, 46);
  assert.equal(state.pot, 15);
  assert.equal(state.actingSeatId, 1);

  for (const seat of state.seats) {
    assert.equal(seat.holeCards.length, 2, `seat ${seat.seatId} should have 2 hole cards`);
  }

  return 1;
}

function runActionLegalityAndProgressionTests() {
  let state = createThreeSeatState();

  const legalAtStart = getLegalActions(state, state.actingSeatId).map((item) => item.action).sort();
  assert.deepEqual(
    legalAtStart,
    ['ALL_IN', 'CALL', 'FOLD', 'RAISE'],
    'UTG should have fold/call/raise/all-in facing big blind',
  );

  state = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: state.actingSeatId,
    action: 'RAISE',
    amount: 30,
  }).state;

  assert.equal(state.currentBet, 30);
  assert.equal(state.minRaise, 20);
  assert.equal(state.actingSeatId, 2);

  state = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: 2,
    action: 'CALL',
  }).state;

  assert.equal(state.actingSeatId, 3);

  state = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: 3,
    action: 'FOLD',
  }).state;

  assert.equal(state.phase, 'DEAL_FLOP');
  assert.equal(state.currentBet, 0);

  state = applyTexasHoldemCommand(state, { type: 'DEAL_FLOP' }).state;
  assert.equal(state.phase, 'BETTING_FLOP');

  state = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: state.actingSeatId,
    action: 'CHECK',
  }).state;

  state = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: state.actingSeatId,
    action: 'CHECK',
  }).state;

  assert.equal(state.phase, 'DEAL_TURN');

  return 1;
}

function runTableActionDtoTests() {
  const state = createThreeSeatState();
  const dto = buildTableActionStateDTO(state);

  assert.equal(dto.handId, state.handId);
  assert.equal(dto.phase, state.phase);
  assert.equal(dto.actingSeatId, state.actingSeatId);
  assert.equal(dto.seats.length, 3);

  const acting = dto.seats.find((seat) => seat.seatId === state.actingSeatId);
  assert.ok(acting, 'acting seat DTO should be present');
  assert.equal(acting.isActingSeat, true);
  assert.equal(acting.actions.length, 6, 'each seat should expose all action entries');

  const nonActing = dto.seats.find((seat) => seat.seatId !== state.actingSeatId);
  assert.ok(nonActing, 'non-acting seat DTO should be present');

  const nonActingAllowed = nonActing.actions.filter((action) => action.allowed);
  assert.equal(nonActingAllowed.length, 0, 'non-acting seats should have no allowed actions');

  const actingRaise = acting.actions.find((action) => action.action === 'RAISE');
  assert.ok(actingRaise, 'acting raise action should exist');
  assert.equal(actingRaise.allowed, true);
  assert.ok(typeof actingRaise.minAmount === 'number');
  assert.ok(typeof actingRaise.maxAmount === 'number');

  return 1;
}

function runSidePotPayoutTests() {
  let state = createTexasHoldemState({
    handId: 'side-pot-test',
    dealerSeatId: 1,
    seed: 1,
    config: {
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 100,
      maxBuyIn: 10000,
    },
    seats: [
      { seatId: 1, playerId: 'p1', stack: 1000 },
      { seatId: 2, playerId: 'p2', stack: 1000 },
      { seatId: 3, playerId: 'p3', stack: 1000 },
    ],
  });

  state = {
    ...state,
    phase: 'SHOWDOWN',
    board: parseCardCodes(['AS', 'QH', '7D', '8H', '9S']),
    pot: 350,
    seats: [
      {
        ...state.seats[0],
        holeCards: parseCardCodes(['AH', 'AD']),
        totalCommitted: 50,
        currentBet: 0,
        stack: 950,
      },
      {
        ...state.seats[1],
        holeCards: parseCardCodes(['KH', 'KD']),
        totalCommitted: 100,
        currentBet: 0,
        stack: 900,
      },
      {
        ...state.seats[2],
        holeCards: parseCardCodes(['2C', '3C']),
        totalCommitted: 200,
        currentBet: 0,
        stack: 800,
      },
    ],
  };

  const resolved = applyTexasHoldemCommand(state, { type: 'RESOLVE_SHOWDOWN' });

  assert.equal(resolved.state.phase, 'HAND_COMPLETE');
  assert.equal(resolved.state.pot, 0);

  const payoutBySeat = new Map(resolved.state.payouts.map((payout) => [payout.seatId, payout.amount]));

  assert.equal(payoutBySeat.get(1), 150, 'seat 1 should win main pot');
  assert.equal(payoutBySeat.get(2), 100, 'seat 2 should win first side pot');
  assert.equal(payoutBySeat.get(3), 100, 'seat 3 should win final uncontested side pot');

  const sidePotAmounts = resolved.state.sidePots.map((pot) => pot.amount);
  assert.deepEqual(sidePotAmounts, [150, 100, 100], 'expected three side-pot layers');

  return 1;
}

function runUncontestedWinnerTests() {
  let state = createThreeSeatState();

  state = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: 1,
    action: 'RAISE',
    amount: 40,
  }).state;

  state = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: 2,
    action: 'FOLD',
  }).state;

  const settled = applyTexasHoldemCommand(state, {
    type: 'PLAYER_ACTION',
    seatId: 3,
    action: 'FOLD',
  }).state;

  assert.equal(settled.phase, 'HAND_COMPLETE');
  assert.equal(settled.payouts.length, 1);
  assert.equal(settled.payouts[0].seatId, 1);
  assert.equal(settled.payouts[0].reason, 'SOLE_SURVIVOR');

  return 1;
}

function runShortAllInReopenBehaviorTests() {
  let state = createTexasHoldemState({
    handId: 'short-all-in-reopen',
    dealerSeatId: 1,
    seed: 8,
    config: {
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 100,
      maxBuyIn: 10000,
    },
    seats: [
      { seatId: 1, playerId: 'p1', stack: 1000 },
      { seatId: 2, playerId: 'p2', stack: 35 },
      { seatId: 3, playerId: 'p3', stack: 1000 },
      { seatId: 4, playerId: 'p4', stack: 1000 },
    ],
  });

  state = applyTexasHoldemCommand(state, { type: 'START_HAND', handId: 'short-all-in-reopen-1', seed: 9 }).state;
  state = applyTexasHoldemCommand(state, { type: 'POST_BLINDS' }).state;
  state = applyTexasHoldemCommand(state, { type: 'DEAL_HOLE' }).state;

  assert.equal(state.actingSeatId, 4, 'preflop should begin left of big blind');

  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 4, action: 'CALL' }).state;
  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 1, action: 'RAISE', amount: 30 }).state;

  assert.equal(state.currentBet, 30);
  assert.equal(state.minRaise, 20);
  assert.equal(state.actingSeatId, 2);

  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 2, action: 'ALL_IN' }).state;

  assert.equal(state.currentBet, 35, 'short all-in should increase current bet target');
  assert.deepEqual(state.actionQueue, [3, 4, 1], 'queue should include seats that still owe chips');

  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 3, action: 'CALL' }).state;
  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 4, action: 'CALL' }).state;

  assert.equal(state.actingSeatId, 1);

  const seat1Actions = getLegalActions(state, 1).map((action) => action.action).sort();
  assert.deepEqual(
    seat1Actions,
    ['ALL_IN', 'CALL', 'FOLD'],
    'short all-in should not reopen raising for a player who already acted',
  );

  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 1, action: 'CALL' }).state;
  assert.equal(state.phase, 'DEAL_FLOP', 'round should complete after final call');

  return 1;
}

function runOddChipAssignmentPolicyTests() {
  let state = createTexasHoldemState({
    handId: 'odd-chip-assignment',
    dealerSeatId: 1,
    seed: 11,
    config: {
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 100,
      maxBuyIn: 10000,
    },
    seats: [
      { seatId: 1, playerId: 'p1', stack: 1000 },
      { seatId: 2, playerId: 'p2', stack: 1000 },
      { seatId: 3, playerId: 'p3', stack: 1000 },
    ],
  });

  state = {
    ...state,
    phase: 'SHOWDOWN',
    board: parseCardCodes(['10H', 'JH', 'QC', 'KD', 'AS']),
    pot: 3,
    seats: [
      {
        ...state.seats[0],
        holeCards: parseCardCodes(['2C', '2D']),
        totalCommitted: 1,
        currentBet: 0,
      },
      {
        ...state.seats[1],
        holeCards: parseCardCodes(['3C', '3D']),
        totalCommitted: 1,
        currentBet: 0,
      },
      {
        ...state.seats[2],
        holeCards: parseCardCodes(['4C', '4D']),
        folded: true,
        totalCommitted: 1,
        currentBet: 0,
      },
    ],
  };

  const resolved = applyTexasHoldemCommand(state, { type: 'RESOLVE_SHOWDOWN' }).state;
  const payoutBySeat = new Map(resolved.payouts.map((payout) => [payout.seatId, payout.amount]));

  assert.equal(payoutBySeat.get(1), 2, 'odd chip should go to lower seat id first');
  assert.equal(payoutBySeat.get(2), 1, 'second tied winner receives remaining even split');
  assert.equal(payoutBySeat.get(3) ?? 0, 0, 'folded seat should not receive payout');

  return 1;
}

function runHeadsUpBlindButtonTransitionTests() {
  let state = createTexasHoldemState({
    handId: 'heads-up-flow',
    dealerSeatId: 1,
    seed: 21,
    config: {
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 100,
      maxBuyIn: 10000,
    },
    seats: [
      { seatId: 1, playerId: 'p1', stack: 1000 },
      { seatId: 2, playerId: 'p2', stack: 1000 },
    ],
  });

  state = applyTexasHoldemCommand(state, { type: 'START_HAND', handId: 'heads-up-flow-1', seed: 22 }).state;
  assert.equal(state.smallBlindSeatId, 1, 'heads-up dealer should post small blind');
  assert.equal(state.bigBlindSeatId, 2, 'heads-up non-dealer should post big blind');

  state = applyTexasHoldemCommand(state, { type: 'POST_BLINDS' }).state;
  state = applyTexasHoldemCommand(state, { type: 'DEAL_HOLE' }).state;

  assert.equal(state.actingSeatId, 1, 'heads-up preflop action starts with small blind/button');

  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 1, action: 'CALL' }).state;
  state = applyTexasHoldemCommand(state, { type: 'PLAYER_ACTION', seatId: 2, action: 'CHECK' }).state;
  assert.equal(state.phase, 'DEAL_FLOP');

  state = applyTexasHoldemCommand(state, { type: 'DEAL_FLOP' }).state;
  assert.equal(state.phase, 'BETTING_FLOP');
  assert.equal(state.actingSeatId, 2, 'heads-up postflop action starts with big blind/non-button');

  return 1;
}

function main() {
  const handRankCount = runHandRankFixtureTests();
  const showdownCount = runShowdownFixtureTests();
  const reducerCount = runReducerFlowSmokeTests();
  const actionCount = runActionLegalityAndProgressionTests();
  const dtoCount = runTableActionDtoTests();
  const sidePotCount = runSidePotPayoutTests();
  const uncontestedCount = runUncontestedWinnerTests();
  const shortAllInCount = runShortAllInReopenBehaviorTests();
  const oddChipCount = runOddChipAssignmentPolicyTests();
  const headsUpCount = runHeadsUpBlindButtonTransitionTests();

  console.info(
    [
      `Engine tests passed (${handRankCount} hand-rank fixtures, ${showdownCount} showdown fixtures,`,
      `${reducerCount} reducer flow, ${actionCount} action legality,`,
      `${dtoCount} action DTO, ${sidePotCount} side-pot payout, ${uncontestedCount} uncontested winner,`,
      `${shortAllInCount} short all-in reopen, ${oddChipCount} odd-chip policy, ${headsUpCount} heads-up transition).`,
    ].join(' '),
  );
}

main();
