import fs from 'node:fs';
import path from 'node:path';

const fixtureRoot = path.resolve(process.cwd(), 'fixtures/texas-holdem');
const validCategories = new Set([
  'ROYAL_FLUSH',
  'STRAIGHT_FLUSH',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'FLUSH',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'PAIR',
  'HIGH_CARD',
]);

const cardPattern = /^(10|[2-9]|[JQKA])[CDHS]$/;

function readJson(fileName) {
  const fullPath = path.join(fixtureRoot, fileName);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function validateCardList(cards, context, errors) {
  if (!Array.isArray(cards) || cards.length === 0) {
    errors.push(`${context}: cards must be a non-empty array`);
    return;
  }

  const seen = new Set();
  for (const card of cards) {
    if (typeof card !== 'string' || !cardPattern.test(card)) {
      errors.push(`${context}: invalid card code '${card}'`);
      continue;
    }
    if (seen.has(card)) {
      errors.push(`${context}: duplicate card '${card}'`);
      continue;
    }
    seen.add(card);
  }
}

function validateHandRankFixtures(errors) {
  const fixtures = readJson('hand-rank-fixtures.json');

  for (const fixture of fixtures) {
    if (!fixture.id || typeof fixture.id !== 'string') {
      errors.push('hand-rank fixture missing string id');
      continue;
    }

    validateCardList(fixture.cards, `hand-rank:${fixture.id}`, errors);

    if (!validCategories.has(fixture.expectedCategory)) {
      errors.push(`hand-rank:${fixture.id}: invalid category '${fixture.expectedCategory}'`);
    }

    if (Array.isArray(fixture.cards) && fixture.cards.length !== 5) {
      errors.push(`hand-rank:${fixture.id}: expected exactly 5 cards`);
    }
  }

  return fixtures.length;
}

function validateShowdownFixtures(errors) {
  const fixtures = readJson('showdown-fixtures.json');

  for (const fixture of fixtures) {
    if (!fixture.id || typeof fixture.id !== 'string') {
      errors.push('showdown fixture missing string id');
      continue;
    }

    validateCardList(fixture.board, `showdown:${fixture.id}:board`, errors);

    if (!Array.isArray(fixture.board) || fixture.board.length !== 5) {
      errors.push(`showdown:${fixture.id}: board must contain exactly 5 cards`);
    }

    if (!Array.isArray(fixture.players) || fixture.players.length < 2) {
      errors.push(`showdown:${fixture.id}: players must contain at least 2 entries`);
      continue;
    }

    const seenCards = new Set(fixture.board ?? []);

    for (const player of fixture.players) {
      if (typeof player.seatId !== 'number') {
        errors.push(`showdown:${fixture.id}: player seatId must be a number`);
      }

      validateCardList(player.hole, `showdown:${fixture.id}:seat:${player.seatId}`, errors);

      if (!Array.isArray(player.hole) || player.hole.length !== 2) {
        errors.push(`showdown:${fixture.id}: seat ${player.seatId} must have exactly 2 hole cards`);
        continue;
      }

      for (const card of player.hole) {
        if (seenCards.has(card)) {
          errors.push(`showdown:${fixture.id}: duplicate card across board/players '${card}'`);
        } else {
          seenCards.add(card);
        }
      }
    }

    if (!Array.isArray(fixture.expectedWinnerSeatIds) || fixture.expectedWinnerSeatIds.length === 0) {
      errors.push(`showdown:${fixture.id}: expectedWinnerSeatIds must be non-empty`);
    }
  }

  return fixtures.length;
}

const errors = [];
const handRankCount = validateHandRankFixtures(errors);
const showdownCount = validateShowdownFixtures(errors);

if (errors.length > 0) {
  console.error('Fixture validation failed.');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exitCode = 1;
} else {
  console.info(`Fixture validation passed (${handRankCount} hand-rank, ${showdownCount} showdown fixtures).`);
}
