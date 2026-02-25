# Phase 2 Engine Progress (Core Logic + Executable Tests)

## Completed

## Evaluator

Implemented full 5-card evaluator with tie-break vectors:

- `ROYAL_FLUSH`
- `STRAIGHT_FLUSH`
- `FOUR_OF_A_KIND`
- `FULL_HOUSE`
- `FLUSH`
- `STRAIGHT` (including wheel A-2-3-4-5)
- `THREE_OF_A_KIND`
- `TWO_PAIR`
- `PAIR`
- `HIGH_CARD`

Source: `packages/poker-engine/src/evaluator.ts`

## Showdown

Implemented showdown resolver for board + player hole cards:

- evaluates best 5 from 7
- compares evaluated hands
- returns winners including split-pot ties
- validates duplicate-card collisions

Source: `packages/poker-engine/src/showdown.ts`

## Engine Reducer

Implemented initial Texas Hold'em reducer flow:

- `START_HAND`
  - resets hand state
  - shuffles deterministic deck from seed
  - recalculates blind/button/action seats
- `POST_BLINDS`
  - posts small/big blinds
  - updates stack, pot, current bet, aggressor
- `DEAL_HOLE`
  - deals 2 hole cards per seat
  - transitions to `BETTING_PRE_FLOP`

Source: `packages/poker-engine/src/engine.ts`

## Supporting Modules

- card parsing and canonical code conversion: `src/card-code.ts`
- deterministic RNG: `src/rng.ts`
- deck creation/shuffle/draw: `src/deck.ts`
- combinations utility: `src/combinations.ts`

## Tests

Added executable no-install engine tests using Node strip-types:

- Script: `packages/poker-engine/scripts/run-fixture-tests.mjs`
- Command: `npm run test --workspace @poker/poker-engine`

Coverage currently includes:

- hand-rank fixtures (10)
- showdown fixtures (3)
- reducer flow smoke suite (start -> blinds -> deal)

Latest run status: PASS

