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

## Client Integration Slice (Phase 2 MVP Progress)

Added a playable local simulation client wired directly to `@poker/poker-engine`:

- new `LocalTableController` to own state + command application
- automated phase progression (`DEAL_*` + `RESOLVE_SHOWDOWN`)
- simple bot policy for non-user seats
- user HUD actions driven strictly by legal action DTOs
- board + hole card rendering using normalized `/assets/cards/*` assets
- seat avatars wired from normalized `/assets/avatars/*` assets
- event/command log surface for transition debugging

Sources:

- `apps/client/src/table-controller.ts`
- `apps/client/src/main.ts`
- `apps/client/src/styles.css`

Validation notes:

- Engine fixture suite passes: `npm run test --workspace @poker/poker-engine`.
- Client typecheck/build passes: `npm run typecheck` and `npm run build:client`.
- See `./developer-setup.md` for npm/nvm troubleshooting and workspace command conventions.

## PR A Progress: Legacy HowTo Content Migration

- Added generated typed guide data from legacy `resources/js/Pages/HowTo/games/*.vue` sources.
- Added generator script: `modern/scripts/generate-howto-content.mjs`.
- Added modern client `How To` view with game variant tabs and migrated rounds/rules sections.

## PR B Progress: Authoritative Server Hand Lifecycle MVP

- Replaced server scaffold with an HTTP service that owns a single in-memory table state.
- Added authoritative command endpoint (`POST /api/table/command`) that applies only `TableCommand` transitions via `@poker/poker-engine`.
- Added per-hand history capture:
  - start snapshot
  - ordered command log
  - ordered event log
  - final snapshot on `HAND_COMPLETE`
- Added deterministic hand replay verification from snapshot + command stream (`GET /api/table/hands/:handId/replay`).
- Added server lifecycle/replay tests:
  - `apps/server/src/table-service.test.ts`
  - `npm run test:server`

Sources:

- `apps/server/src/table-service.ts`
- `apps/server/src/index.ts`
- `apps/server/src/table-service.test.ts`
