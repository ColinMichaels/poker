# Phase 2 Engine Progress (Core Logic + Betting + Payouts)

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

## Showdown + Winners

Implemented showdown resolver for board + player hole cards:

- evaluates best 5 from 7
- compares evaluated hands
- returns winner seat IDs including ties
- validates duplicate-card collisions

Source: `packages/poker-engine/src/showdown.ts`

## Engine Reducer

Implemented command-driven Texas Hold'em flow with legality checks:

- `START_HAND`
- `POST_BLINDS`
- `DEAL_HOLE`
- `DEAL_FLOP`
- `DEAL_TURN`
- `DEAL_RIVER`
- `PLAYER_ACTION`:
  - `FOLD`
  - `CHECK`
  - `CALL`
  - `BET`
  - `RAISE`
  - `ALL_IN`
- `RESOLVE_SHOWDOWN`

Key behavior:

- turn-order and action-queue validation
- per-round raise-right tracking (`canRaiseSeatIds`) to support short all-in non-reopen behavior
- per-seat legal action generation (`getLegalActions`)
- min-raise enforcement
- full-raise queue reset semantics
- street transitions (`BETTING_*` -> `DEAL_*` -> `SHOWDOWN`)
- uncontested hand settlement (sole survivor)

Source: `packages/poker-engine/src/engine.ts`

## Client Control DTO Contract

Added explicit client-facing per-seat action DTO types in `@poker/game-contracts`:

- `ActionOptionDTO`
- `SeatActionStateDTO`
- `TableActionStateDTO`

Added engine projection:

- `buildTableActionStateDTO(state)` returns per-seat:
  - `isActingSeat`
  - `toCall`
  - `canRaise`
  - action list with `allowed`, `amountSemantics`, `minAmount`, `maxAmount`

Sources:

- `packages/game-contracts/src/index.ts`
- `packages/poker-engine/src/engine.ts`

## Side Pots + Payouts

Implemented side-pot construction from total commitments and payout splitting:

- layered side pots by committed stack depth
- folded players contribute to pots but are ineligible to win
- each side pot resolved by best eligible showdown hand
- split-pot payouts with odd-chip remainder allocation (seat-id order)

State now records:

- `sidePots`
- `payouts`

Source: `packages/poker-engine/src/state.ts`, `packages/poker-engine/src/engine.ts`

## Tests

Executable no-install engine tests using Node strip-types:

- Script: `packages/poker-engine/scripts/run-fixture-tests.mjs`
- Command: `npm run test --workspace @poker/poker-engine`

Coverage currently includes:

- hand-rank fixtures (10)
- showdown fixtures (3)
- reducer flow smoke suite
- action legality/progression suite
- side-pot payout suite
- uncontested winner suite
- short all-in reopen behavior suite
- odd-chip assignment order policy suite
- heads-up blind/button transition suite

Latest run status: PASS
