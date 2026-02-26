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

## PR J Progress: CI Guardrail Expansion

- Expanded modern GitHub Actions workflow to run:
  - `npm run test:engine`
  - `npm run test:server`
- Expanded CI path triggers to include root modern entrypoint updates:
  - `package.json`
  - `readme.md`

Sources:

- `.github/workflows/modern-ci.yml`
- `README.md`
- `docs/developer-setup.md`

## PR K Progress: Legacy Archive Guardrail

- Added legacy archive CI guard workflow:
  - blocks non-doc edits under `legacy/**` during PR checks
  - allows documentation-only updates (`legacy/README.md`, `legacy/laravel-readme.md`)
- Added explicit emergency bypass convention:
  - apply PR label `allow-legacy-change`

Sources:

- `.github/workflows/legacy-archive-guard.yml`
- `README.md`
- `docs/legacy-decommission-plan.md`

## PR L Progress: Legacy Command Acknowledgement Gate

- Added root wrapper script for legacy command execution:
  - `scripts/run-legacy-archive-command.mjs`
- Updated root `package.json` legacy scripts to require explicit acknowledgement:
  - `legacy:dev`
  - `legacy:build`
- Added documentation for acknowledgement env usage:
  - `LEGACY_ARCHIVE_ACK=1`

Sources:

- `scripts/run-legacy-archive-command.mjs`
- `package.json`
- `README.md`
- `legacy/README.md`

## PR M Progress: Canonical CI Script Alignment

- Added canonical modern verification script:
  - `modern/package.json` -> `ci`
- Added root wrapper for the same verification flow:
  - root `package.json` -> `ci`
- Updated modern GitHub Actions workflow to execute:
  - `npm run ci`

Sources:

- `modern/package.json`
- `package.json`
- `.github/workflows/modern-ci.yml`
- `docs/developer-setup.md`

## PR N Progress: Runtime Legacy Reference Guard

- Added script to detect `legacy/` path references in modern runtime source:
  - `scripts/check-legacy-references.mjs`
- Added workspace command:
  - `npm run check:legacy-refs`
- Integrated guard into canonical CI verification flow:
  - `npm run ci`

Sources:

- `scripts/check-legacy-references.mjs`
- `package.json`

## PR O Progress: Legacy Removal Execution Runbook

- Added explicit final removal runbook for `legacy/` deletion with:
  - preconditions
  - pre-removal snapshot/tag workflow
  - ordered removal tasks
  - verification checklist
  - rollback procedure
- Linked the runbook from root and modern workspace readmes.

Sources:

- `docs/legacy-removal-execution.md`
- `README.md`

## PR P Progress: Password Hash Format Hardening

- Added password-hash format validation during auth user normalization:
  - accepts only `scrypt$<salt-hex>$<digest-hex>` for hash inputs
- Added compatibility migration for legacy plaintext values found in `passwordHash`.
- Added rejection path for unsupported hash formats to fail fast on startup.
- Added auth regression tests:
  - legacy plaintext `passwordHash` migration
  - unsupported `passwordHash` format rejection

Sources:

- `apps/server/src/auth-wallet-service.ts`
- `apps/server/src/auth-wallet-service.test.ts`
- `apps/server/README.md`
- `docs/deployment-runbook.md`

## PR Q Progress: Legacy Wallet Route Toggle

- Added environment control for legacy wallet compatibility routes:
  - `POKER_ENABLE_LEGACY_WALLET_ROUTES`
- Updated server route handling to enforce this toggle.
- Added production-safe default behavior (`NODE_ENV=production` disables legacy wallet routes unless explicitly enabled).

Sources:

- `apps/server/src/index.ts`
- `apps/server/README.md`
- `docs/deployment-runbook.md`

## PR R Progress: Startup Config Module + Tests

- Extracted startup/env parsing and bootstrap-user file validation from server entrypoint into:
  - `apps/server/src/startup-config.ts`
- Added focused regression tests for:
  - default/prod-safe toggles
  - env override parsing
  - bootstrap users file parsing/validation failures
- Updated server test script to include startup-config tests.

Sources:

- `apps/server/src/startup-config.ts`
- `apps/server/src/startup-config.test.ts`
- `apps/server/src/index.ts`
- `apps/server/package.json`

## PR S Progress: Root Environment Doctor

- Added root Node/npm environment checks:
  - `scripts/doctor-modern-env.mjs`
  - `npm run doctor`
- Added root toolchain metadata:
  - `.nvmrc`
  - root `package.json` engines (`node >=22 <25`, `npm >=10`)
- Updated onboarding/developer setup docs to run doctor early in setup.

Sources:

- `scripts/doctor-modern-env.mjs`
- `package.json`
- `.nvmrc`
- `README.md`

## PR T Progress: CI Trigger Coverage for Toolchain Guardrails

- Updated modern CI workflow path filters to trigger on root toolchain guardrail updates:
  - `.nvmrc`
  - `scripts/doctor-modern-env.mjs`

Sources:

- `.github/workflows/modern-ci.yml`

## PR U Progress: Graceful Shutdown Runtime Handling

- Added signal-based shutdown handling to server entrypoint:
  - `SIGINT`
  - `SIGTERM`
- Shutdown flow now:
  - persists runtime state snapshot
  - closes HTTP server gracefully
  - enforces timeout fallback to avoid hanging process

Sources:

- `apps/server/src/index.ts`
- `docs/deployment-runbook.md`

## PR V Progress: Doctor-First Root CI

- Updated root `ci` script to run environment doctor before modern verification:
  - `npm run doctor && npm run ci --prefix modern`
- Updated root/developer setup docs to reflect doctor-first root CI behavior.

Sources:

- `package.json`
- `README.md`
- `docs/developer-setup.md`

## PR W Progress: Server Env Template

- Added canonical server environment template with current runtime/auth/compat controls:
  - `apps/server/.env.example`
- Linked template from workspace/server/deployment setup documentation.

Sources:

- `apps/server/.env.example`
- `apps/server/README.md`
- `docs/developer-setup.md`
- `docs/deployment-runbook.md`

## PR X Progress: Env Template Sync Guard

- Added script to verify required server environment keys are present in:
  - `apps/server/.env.example`
- Added workspace command:
  - `npm run check:server-env-template`
- Integrated env-template verification into canonical modern CI command.

Sources:

- `scripts/check-server-env-template.mjs`
- `apps/server/.env.example`
- `package.json`

## PR Y Progress: Health Runtime Diagnostics

- Extended `/health` response with runtime mode fields:
  - `runtime.persistenceEnabled`
  - `runtime.authDemoUsersEnabled`
  - `runtime.legacyWalletRoutesEnabled`
- Updated server/deployment docs to include the new health payload details.

Sources:

- `apps/server/src/index.ts`
- `apps/server/README.md`
- `docs/deployment-runbook.md`

## PR Z Progress: Production Secret Fail-Fast

- Added startup validation that fails when:
  - `NODE_ENV=production`
  - `POKER_AUTH_TOKEN_SECRET` is missing/empty
- Added startup-config test coverage for production secret requirement.
- Updated server/deployment docs to reflect fail-fast production startup behavior.

Sources:

- `apps/server/src/startup-config.ts`
- `apps/server/src/startup-config.test.ts`
- `apps/server/README.md`
- `docs/deployment-runbook.md`
