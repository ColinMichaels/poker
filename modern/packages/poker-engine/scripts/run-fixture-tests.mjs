import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  parseCardCodes,
  evaluateFiveCardHand,
  resolveShowdown,
  createTexasHoldemState,
  applyTexasHoldemCommand,
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

function runReducerFlowTests() {
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

  assert.equal(started.state.handId, 'hand-1');
  assert.equal(started.state.phase, 'SEATED');
  assert.equal(started.state.pot, 0);
  assert.equal(started.state.deck.length, 52);

  const posted = applyTexasHoldemCommand(started.state, { type: 'POST_BLINDS' });

  assert.equal(posted.state.phase, 'BLINDS_POSTED');
  assert.equal(posted.state.pot, 15);
  assert.equal(posted.state.currentBet, 10);

  const sbSeat = posted.state.seats.find((seat) => seat.seatId === posted.state.smallBlindSeatId);
  const bbSeat = posted.state.seats.find((seat) => seat.seatId === posted.state.bigBlindSeatId);

  assert.ok(sbSeat, 'small blind seat should exist');
  assert.ok(bbSeat, 'big blind seat should exist');
  assert.equal(sbSeat.currentBet, 5);
  assert.equal(bbSeat.currentBet, 10);

  const dealt = applyTexasHoldemCommand(posted.state, { type: 'DEAL_HOLE' });

  assert.equal(dealt.state.phase, 'BETTING_PRE_FLOP');
  assert.equal(dealt.state.deck.length, 46);

  const allHoleCards = [];
  for (const seat of dealt.state.seats) {
    assert.equal(seat.holeCards.length, 2, `seat ${seat.seatId} should have 2 hole cards`);
    for (const card of seat.holeCards) {
      allHoleCards.push(card.code);
    }
  }

  const uniqueCardCount = new Set(allHoleCards).size;
  assert.equal(uniqueCardCount, allHoleCards.length, 'dealt hole cards should be unique');

  return 1;
}

function main() {
  const handRankCount = runHandRankFixtureTests();
  const showdownCount = runShowdownFixtureTests();
  const reducerCount = runReducerFlowTests();

  console.info(
    `Engine tests passed (${handRankCount} hand-rank fixtures, ${showdownCount} showdown fixtures, ${reducerCount} reducer flow suite).`,
  );
}

main();
