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

- Added generated typed guide data from legacy `legacy/resources/js/Pages/HowTo/games/*.vue` sources.
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

## PR C Progress: Minimal Auth/Wallet Parity + Contracts

- Added shared auth/wallet DTO contracts in `@poker/game-contracts`:
  - `AuthSessionDTO`, `UserProfileDTO`, `PlayerWalletDTO`
  - `WalletAdjustmentRequestDTO`, `WalletAdjustmentResponseDTO`, `WalletLedgerEntryDTO`
- Added in-memory auth/wallet service in server:
  - login/logout/session lifecycle
  - profile read/update (`/api/users/me`)
  - wallet balance adjust + ledger (`/api/wallet`, `/api/wallet/ledger`)
- Added legacy wallet compatibility routes:
  - `GET /wallet`
  - `PATCH /wallet/:id`
- Added auth/wallet test coverage:
  - `apps/server/src/auth-wallet-service.test.ts`

Sources:

- `packages/game-contracts/src/index.ts`
- `apps/server/src/auth-wallet-service.ts`
- `apps/server/src/index.ts`
- `apps/server/src/auth-wallet-service.test.ts`

## PR D Progress: Root Docs + Runtime Entry Point Promotion

- Updated root onboarding/readme to point contributors to `modern/` first.
- Added root npm entrypoints that execute modern workflows by default:
  - `dev`, `dev:server`, `typecheck`, `build`, `test`
- Added modern deployment runbook with build/start/health-check sequence.

Sources:

- `readme.md`
- `package.json`
- `modern/docs/deployment-runbook.md`

## PR E Progress: Legacy Archive Move + Repository Cleanup

- Moved Laravel/Vue2 legacy code from repository root into `legacy/`.
- Added `legacy/README.md` for archive context and legacy execution notes.
- Updated modern extraction scripts to read legacy sources from `legacy/`:
  - HowTo content generator source path
  - asset manifest legacy source root
- Updated root and workspace docs to reflect archived legacy pathing.

Sources:

- `legacy/README.md`
- `modern/scripts/generate-howto-content.mjs`
- `modern/packages/asset-manifest/scripts/generate-manifest.mjs`

## PR F Progress: Server Runtime Persistence

- Added file-backed runtime state persistence for `apps/server`:
  - table snapshot/logs/hand-history persistence
  - auth/wallet user/session/ledger persistence
  - restore-on-boot behavior for persisted state
- Added runtime persistence store tests:
  - `apps/server/src/runtime-state-store.test.ts`
- Added server env controls:
  - `POKER_STATE_PERSIST`
  - `POKER_STATE_FILE`

Sources:

- `apps/server/src/runtime-state-store.ts`
- `apps/server/src/index.ts`
- `apps/server/src/runtime-state-store.test.ts`

## PR G Progress: Auth/Session Hardening Primitives

- Replaced plaintext password handling with salted `scrypt` password hashes.
- Added restore-time migration path for legacy plaintext persisted user records.
- Replaced unsigned bearer sessions with HMAC-signed session tokens.
- Added session expiration enforcement with configurable ttl.
- Added auth hardening env controls:
  - `POKER_AUTH_TOKEN_SECRET`
  - `POKER_SESSION_TTL_MS`
- Added auth hardening test coverage:
  - tampered token rejection
  - session expiry behavior
  - legacy user credential migration

Sources:

- `apps/server/src/auth-wallet-service.ts`
- `apps/server/src/auth-wallet-service.test.ts`
- `apps/server/src/index.ts`

## PR H Progress: Auth Audit + Session Revocation Controls

- Added auth audit trail capture for:
  - login success/failure
  - logout
  - invalid/expired session usage
  - restored-session drops
  - revoke-others operations
- Added session revocation operation for current user:
  - revoke all sessions except current token
- Added auth API routes:
  - `GET /api/auth/audit`
  - `POST /api/auth/revoke-others`
- Added persistence + test coverage for auth audit behavior.

Sources:

- `apps/server/src/auth-wallet-service.ts`
- `apps/server/src/auth-wallet-service.test.ts`
- `apps/server/src/runtime-state-store.test.ts`
- `apps/server/src/index.ts`

## PR I Progress: Bootstrap Auth Users + Demo User Controls

- Added explicit auth startup controls:
  - `POKER_AUTH_ALLOW_DEMO_USERS` (defaults to enabled except in `NODE_ENV=production`)
  - `POKER_AUTH_BOOTSTRAP_USERS_FILE` (bootstrap users JSON path)
- Added auth bootstrap seed support:
  - accepts array format or `{ users: [...] }` wrapper format
  - supports plaintext password seeds (stored as salted `scrypt` hash on initialization)
  - assigns fallback ids and profile defaults for minimal seed records
- Added constructor guardrail when demo users are disabled and no users are configured.
- Added auth test coverage for demo-user disablement and bootstrap seed normalization.

Sources:

- `apps/server/src/index.ts`
- `apps/server/src/auth-wallet-service.ts`
- `apps/server/src/auth-wallet-service.test.ts`
- `apps/server/bootstrap-users.example.json`
