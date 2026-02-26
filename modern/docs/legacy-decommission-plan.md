# Legacy Decommission + Modern Cutover Plan

Purpose: make `modern/` the primary codebase without losing reusable legacy functionality.

## Audit Snapshot (2026-02-26)

## Extraction Completeness

- Core engine extraction: complete (deck, evaluator, showdown, command reducer, side pots/payouts).
- Engine validation: passing (`npm run test:engine`).
- Asset extraction: complete for target pack categories:
  - cards: 52 faces + 3 backs normalized, 0 missing faces
  - chips: 8/8 normalized
  - avatars: 33/33 normalized (1 typo rename normalized)
  - sounds: 12/12 normalized with categories
  - logos: 4/4 normalized (1 ID collision handled via alias)
- CI coverage for modern workspace: added (`.github/workflows/modern-ci.yml`) with typecheck/build/engine tests.

## Remaining Gaps Before Full Legacy Removal

These are not extraction failures, but they are blockers to deleting the legacy app:

1. Real auth hardening is not yet complete (current auth/session still uses demo credentials and no external identity provider).

## Completed in PR A

- Legacy `HowTo` variant content was extracted into modern typed guide data:
  - `modern/apps/client/src/content/howto-content.ts`
  - generator: `modern/scripts/generate-howto-content.mjs`
- Modern client now includes a dedicated `How To` view driven by migrated content.

## Completed in PR B

- Added an authoritative single-table server runtime in `modern/apps/server`:
  - command pipeline endpoint: `POST /api/table/command`
  - state snapshot endpoint: `GET /api/table/state`
  - logs endpoints: `GET /api/table/logs/commands`, `GET /api/table/logs/events`
- Added one-hand snapshot + replay support:
  - hand history endpoints: `GET /api/table/hands/:handId`
  - replay verification endpoint: `GET /api/table/hands/:handId/replay`
- Added server lifecycle/replay tests:
  - `modern/apps/server/src/table-service.test.ts`

## Completed in PR C

- Added minimal auth/profile/wallet contracts in `modern/packages/game-contracts/src/index.ts`.
- Added in-memory auth + wallet parity service in `modern/apps/server/src/auth-wallet-service.ts`.
- Added API endpoints for auth/session/profile/wallet in `modern/apps/server/src/index.ts`.
- Added legacy wallet compatibility routes (`GET /wallet`, `PATCH /wallet/:id`) to support migration continuity.
- Added auth/wallet tests:
  - `modern/apps/server/src/auth-wallet-service.test.ts`

## Completed in PR D

- Updated root repository onboarding to default to modern workspace:
  - `readme.md`
  - root `package.json` modern entrypoint scripts (`dev`, `dev:server`, `typecheck`, `build`, `test`)
- Added modern deployment runbook:
  - `modern/docs/deployment-runbook.md`
- Linked modern deployment docs from workspace README:
  - `modern/README.md`

## Completed in PR E

- Archived legacy Laravel/Vue2 codebase into `legacy/` from repository root.
- Added archive orientation doc:
  - `legacy/README.md`
- Updated modern extraction tooling to use archived legacy paths:
  - `modern/scripts/generate-howto-content.mjs`
  - `modern/packages/asset-manifest/scripts/generate-manifest.mjs`
- Updated root + modern docs to reflect new archive location and modern-first defaults.

## Completed in PR F

- Added durable runtime persistence for modern server:
  - table state/logs/history snapshot persistence
  - auth/wallet users + sessions + ledger persistence
  - restore-on-boot from persisted runtime snapshot
- Added persistence regression tests:
  - `modern/apps/server/src/runtime-state-store.test.ts`
- Added persistence environment controls:
  - `POKER_STATE_PERSIST` (default enabled)
  - `POKER_STATE_FILE`

## Completed in PR G

- Added auth/session hardening primitives:
  - salted `scrypt` password hashing (including restore-time migration from legacy plaintext user records)
  - HMAC-signed bearer session tokens
  - session expiration with configurable ttl
- Added auth hardening environment controls:
  - `POKER_AUTH_TOKEN_SECRET`
  - `POKER_SESSION_TTL_MS`

## Completed in PR H

- Added auth operational controls:
  - revoke all other active sessions for current user
  - per-user auth audit log query endpoint support
- Persisted auth audit logs alongside auth/table runtime snapshot.
- Added auth audit/revocation tests.

## Known Intentional Asset Exceptions

- Non-canonical card extras remain excluded from canonical face set:
  - `11C.svg`, `11D.svg`, `11H.svg`, `11S.svg`
  - `Red_52_Faces_v.2.0.svg`

## Cutover Strategy

Use a staged cutover, not a one-shot delete.

## Phase 0: Freeze + Guardrails

1. Freeze legacy feature development (critical fixes only).
2. Require modern CI checks on PRs touching `modern/**`.
3. Keep legacy routes running while modern reaches parity.

Exit criteria:
- Modern CI is stable for at least one sprint.

## Phase 1: Parity for Must-Keep Product Surface

1. Port `HowTo` content into modern client help pages.
2. Implement minimum server features required for target launch mode:
   - single-table authoritative command pipeline
   - snapshot + event replay for one hand
3. Recreate only required wallet/profile flows (exclude legacy PingCRM leftovers).

Exit criteria:
- All required user journeys can be performed without Laravel UI.

## Phase 2: Promote Modern as Primary

1. Update root docs and onboarding to default to `modern/`.
2. Promote modern runtime entrypoints in deployment config.
3. Keep legacy in read-only compatibility mode for one release window.

Exit criteria:
- Production/staging uses modern app as default.
- Legacy is no longer on critical request paths.

## Phase 3: Archive Legacy, Then Remove

1. Move Laravel/Vue2 app into `legacy/` (or separate archive branch/repo).
2. Keep static snapshot for reference + historical diff.
3. After soak period, remove archived code from default branch if no rollback need remains.

Exit criteria:
- No active dependencies on legacy code paths.
- Rollback plan documented and tested.

## Recommended PR Breakdown

1. PR A: Help/rules content migration.
2. PR B: Server authoritative hand lifecycle MVP.
3. PR C: Minimal auth/wallet parity and contracts.
4. PR D: Root documentation + deployment cutover.
5. PR E: Legacy archive/removal.
6. PR F: Server runtime persistence.
7. PR G: Auth/session hardening primitives.
8. PR H: Auth audit + session revocation controls.

## Cutover Go/No-Go Checklist

- `npm run typecheck` passes in `modern/`.
- `npm run build` passes in `modern/`.
- `npm run test:engine` passes in `modern/`.
- Required user journeys validated in modern app.
- Deployment runbook updated for modern runtime.
- Rollback path documented before legacy removal PR merges.
