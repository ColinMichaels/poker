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
- CI coverage for modern workspace: added (`.github/workflows/modern-ci.yml`) with typecheck/build/engine and server tests.

## Remaining Gaps Before Full Legacy Removal

These are not extraction failures, but they are blockers to deleting the legacy app:

1. External identity integration is still pending (current auth is local account/session management only).
2. Operational role/authorization boundaries are still pending for broader audit visibility requirements.

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

## Completed in PR I

- Added configurable demo-user behavior:
  - `POKER_AUTH_ALLOW_DEMO_USERS` (defaults off in production via `NODE_ENV=production`)
- Added bootstrap user seeding support:
  - `POKER_AUTH_BOOTSTRAP_USERS_FILE` (JSON array or `{ users: [...] }`)
- Added bootstrap/default-user guardrails and tests to prevent unconfigured auth startup.

## Completed in PR J

- Expanded modern CI workflow coverage to include server regression tests:
  - `npm run test:server`
- Expanded CI trigger scope to include root modern entrypoint docs/scripts changes:
  - `package.json`
  - `readme.md`

## Completed in PR K

- Added legacy archive guard workflow to block non-documentation edits under `legacy/**` by default:
  - `.github/workflows/legacy-archive-guard.yml`
- Added explicit emergency override path:
  - PR label: `allow-legacy-change`

## Completed in PR L

- Added root legacy command acknowledgement wrapper:
  - `scripts/run-legacy-archive-command.mjs`
- Root legacy scripts now require explicit opt-in:
  - `LEGACY_ARCHIVE_ACK=1 npm run legacy:dev`
  - `LEGACY_ARCHIVE_ACK=1 npm run legacy:build`

## Completed in PR M

- Added canonical modern CI verification script:
  - `modern/package.json` -> `npm run ci`
- Updated root wrapper to expose same verification entrypoint:
  - `npm run ci`
- Updated modern CI workflow to use canonical verification script to reduce drift.

## Completed in PR N

- Added automated guard against new runtime legacy path dependencies:
  - `modern/scripts/check-legacy-references.mjs`
- Added modern workspace script:
  - `npm run check:legacy-refs`
- Integrated legacy reference guard into canonical modern CI script:
  - `npm run ci`

## Completed in PR O

- Added final-step execution runbook for removing `legacy/` from default branch:
  - `modern/docs/legacy-removal-execution.md`
- Linked removal runbook from root + modern workspace documentation.

## Completed in PR P

- Hardened bootstrap credential handling in auth service:
  - validates `passwordHash` format (`scrypt$<salt-hex>$<digest-hex>`)
  - migrates legacy plaintext values in `passwordHash` to salted scrypt hash
  - rejects unsupported hash formats at service startup
- Added regression tests for password-hash compatibility and format rejection.

## Completed in PR Q

- Added explicit control for legacy wallet compatibility routes:
  - `POKER_ENABLE_LEGACY_WALLET_ROUTES`
- Default behavior is now production-safe (`NODE_ENV=production` disables legacy wallet routes unless explicitly enabled).
- Updated server/deployment docs for legacy wallet route toggles.

## Completed in PR R

- Extracted server startup/env parsing into dedicated module:
  - `apps/server/src/startup-config.ts`
- Added startup config regression tests:
  - `apps/server/src/startup-config.test.ts`
- Wired server test script to run startup config checks in CI/local verification.

## Completed in PR S

- Added root environment guardrails for Node/npm toolchain consistency:
  - root `.nvmrc`
  - root `package.json` `engines` metadata
  - `npm run doctor` (`scripts/doctor-modern-env.mjs`)
- Updated onboarding docs to run environment doctor before workspace install/build flows.

## Completed in PR T

- Expanded modern CI trigger scope to include root toolchain guardrail files:
  - `.nvmrc`
  - `scripts/doctor-modern-env.mjs`

## Completed in PR U

- Added graceful shutdown handling to modern server runtime:
  - listens for `SIGINT`/`SIGTERM`
  - persists runtime state before close
  - closes HTTP server with forced-exit timeout fallback
- Updated deployment runbook with graceful shutdown behavior.

## Completed in PR V

- Updated root `npm run ci` wrapper to run environment doctor first:
  - `npm run doctor && npm run ci --prefix modern`
- Updated root/developer docs to reflect doctor-first CI flow.

## Completed in PR W

- Added canonical modern server environment template:
  - `modern/apps/server/.env.example`
- Linked env template from server/developer/deployment docs for consistent setup.

## Completed in PR X

- Added server env-template synchronization guard:
  - `modern/scripts/check-server-env-template.mjs`
  - `npm run check:server-env-template`
- Integrated env-template guard into canonical modern CI verification script.

## Completed in PR Y

- Extended `/health` payload with runtime mode visibility:
  - persistence enabled status
  - demo-user mode status
  - legacy-wallet-route mode status
- Updated server/deployment docs to reflect expanded health diagnostics.

## Completed in PR Z

- Enforced production auth secret requirements at startup:
  - `NODE_ENV=production` now requires `POKER_AUTH_TOKEN_SECRET`
- Added startup-config regression coverage for the new production secret guard.
- Updated server/deployment docs to reflect fail-fast behavior.

## Completed in PR AA

- Added repository-level npm engine enforcement:
  - `.npmrc` with `engine-strict=true`
- Updated setup docs to clarify required Node/npm versions are enforced during install.

## Completed in PR AB

- Expanded modern CI trigger scope to include npm engine-enforcement config changes:
  - `.npmrc`

## Completed in PR AC

- Added production-mode startup warnings when compatibility overrides are enabled:
  - demo users enabled in production
  - legacy wallet routes enabled in production
- Added startup-config `isProduction` signal for explicit runtime-mode handling.

## Completed in PR AD

- Added cutover readiness command at repository root:
  - `npm run readiness:legacy-cutover`
- Added script:
  - `scripts/check-legacy-cutover-readiness.mjs`
- Linked readiness command from root and legacy-removal execution docs.

## Completed in PR AE

- Added root legacy-reference inventory command:
  - `npm run audit:legacy-references`
- Added script:
  - `scripts/audit-legacy-references.mjs`
- Linked command from root and legacy-removal execution docs.

## Completed in PR AF

- Started the mobile-first modern client redesign for post-cutover gameplay UX:
  - refactored the play table into a felt-table stage, turn summary panel, and action dock
  - added quick amount presets for target-bet actions
- Replaced client styling with a mobile-first responsive table theme and desktop breakpoints.

## Completed in PR AG

- Added a mobile-first in-hand HUD pass in the modern client:
  - player seat HUD with visible hole cards, stack/commit metrics, and legal-action summary
  - felt-table seat radar overlay for at-a-glance opponent state and turn position
- Restructured play layout into `play-main` + `play-side` regions for clearer desktop/tablet composition.

## Completed in PR AH

- Added state-driven gameplay motion in the modern client play view:
  - phase and board transition animations during hand progression
  - acting-seat transition emphasis for both radar and seat cards
  - live/waiting action-dock state styling for faster mobile turn recognition
- Added transition snapshot tracking in client rendering to animate only on real game-state changes.

## Completed in PR AI

- Added a first-pass modern client lobby shell in front of table gameplay:
  - table list with selectable table cards
  - seat selection panel and explicit enter-table action
- Added seat-based session handoff: entering with a different seat now remounts the local table controller for that user seat.
- Updated client styling with responsive lobby layouts for mobile/tablet/desktop.

## Completed in PR AJ

- Added mobile bottom-sheet action tray behavior for in-hand controls:
  - explicit show/hide tray handle with swipe-up hint when collapsed
  - collapsed/expanded dock content transitions for action controls
- Added viewport-aware dock state handling:
  - mobile uses toggleable tray state
  - tablet/desktop keeps dock content persistently open.

## Completed in PR AK

- Added touch-swipe gesture support on the action tray handle:
  - swipe up opens the tray
  - swipe down closes the tray
- Added fast-gesture thresholds and click suppression so swipe gestures do not trigger accidental double-toggles.
- Added swipe affordance polish to the handle (`Swipe` label + animated grip hint in collapsed mobile state).

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
9. PR I: Bootstrap users + production demo-user controls.
10. PR J: CI server-test coverage + root entrypoint trigger expansion.
11. PR K: Legacy archive read-only CI guardrail.
12. PR L: Explicit acknowledgement wrapper for root legacy commands.
13. PR M: Canonical modern CI script and workflow alignment.
14. PR N: Runtime legacy-reference guard in modern CI.
15. PR O: Legacy removal execution runbook and doc linkage.
16. PR P: Password-hash format validation and legacy credential migration hardening.
17. PR Q: Legacy wallet route toggle with production-safe defaults.
18. PR R: Extracted startup config parsing + dedicated regression tests.
19. PR S: Root Node/npm environment doctor and engine alignment.
20. PR T: Modern CI trigger coverage for root toolchain guardrails.
21. PR U: Graceful shutdown and final-persist handling for modern server.
22. PR V: Root CI now enforces doctor-first verification.
23. PR W: Server environment template and doc alignment.
24. PR X: CI guard for server env-template key coverage.
25. PR Y: Health endpoint runtime mode diagnostics.
26. PR Z: Production auth token secret fail-fast enforcement.
27. PR AA: Repository-level npm engine enforcement.
28. PR AB: Modern CI trigger coverage for `.npmrc` changes.
29. PR AC: Production compatibility-override startup warnings.
30. PR AD: Legacy cutover readiness command.
31. PR AE: Legacy-reference inventory command for cutover planning.
32. PR AF: Mobile-first client table redesign kickoff.
33. PR AG: Mobile HUD and felt-radar layout pass.
34. PR AH: State-driven gameplay transitions and action-dock emphasis.
35. PR AI: Lobby shell and seat-based table entry flow.
36. PR AJ: Mobile bottom-sheet action tray interaction.
37. PR AK: Touch-swipe gesture controls for mobile action tray.

## Cutover Go/No-Go Checklist

- `npm run typecheck` passes in `modern/`.
- `npm run build` passes in `modern/`.
- `npm run test:engine` passes in `modern/`.
- `npm run test:server` passes in `modern/`.
- Required user journeys validated in modern app.
- Deployment runbook updated for modern runtime.
- Production auth bootstrap strategy documented (`POKER_AUTH_BOOTSTRAP_USERS_FILE` or explicit demo override).
- Legacy archive guard is active (or documented emergency override applied for approved fixes).
- Rollback path documented before legacy removal PR merges.
