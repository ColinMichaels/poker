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

- No remaining extraction-adjacent blockers are open.

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

## Completed in PR AL

- Hardened mobile tray auto-open behavior:
  - now auto-opens on meaningful transitions (user turn starts, new hand, or entering play view)
  - no longer force-opens on every render, allowing manual collapse while still on turn
- Added viewport/orientation responsiveness for dock behavior:
  - client now re-renders on resize/orientation changes so mobile/desktop dock mode updates immediately
- Added motion/accessibility polish:
  - safe-area bottom inset support for mobile dock spacing
  - reduced-motion media-query support to minimize animation/transition intensity

## Completed in PR AM

- Hardened action amount input UX in play view:
  - target-bet draft amount is now preserved across render cycles instead of resetting to min on each update
  - target-bet draft resets cleanly on hand transitions and seat remounts
- Added action amount input semantics for mobile numeric entry:
  - `inputmode="numeric"` and number-pattern hinting for quicker keypad access
- Improved interaction accessibility state signaling:
  - added pressed-state semantics on view tabs, lobby table/seat selectors, and How To guide tabs
  - added richer action/preset button aria labels for amount-aware controls

## Completed in PR AN

- Added a new mobile-first multi-table gameplay UI screen in the modern client:
  - open-table rail for quick table switching
  - live table stage with board preview + seat ring status chips
  - in-context activity feed for recent actions
- Added thumb-reachable mobile action bar behavior:
  - fixed bottom action bar with large-touch action targets
  - raise amount controls with range + numeric input + step buttons
- Added desktop (`>=1024px`) layout behavior for the new screen:
  - action bar moves to a sticky side rail
  - stage/feed composition expands for wider viewports
- Added basic desktop keyboard accessibility for multi-table actions:
  - action shortcuts (`F/K/C/R/A`)
  - arrow-key action selection
  - Enter to confirm selected action

## Completed in PR AO

- Improved local gameplay randomness in the modern client table controller:
  - replaced sequential hand seeds (`seed + 1`) with runtime entropy-based 32-bit seeds
  - randomized initial dealer seat during local table bootstrap
  - added per-hand seeded bot RNG stream so bot choices vary naturally with each hand
- Improved seat-role mapping during local table bootstrap:
  - selected user seat now maps to `you` at creation time (instead of fixed Seat 1 identity)
- Added a dedicated client animation roadmap doc:
  - phased plan for card dealing, chip movement, action urgency, and performance/accessibility hardening
  - file: `modern/docs/client-animation-roadmap.md`

## Completed in PR AP

- Implemented Phase 1 animation-system groundwork in modern client UI:
  - added centralized event-to-motion cue mapping (`HAND_STARTED`, `BOARD_DEALT`, `PLAYER_ACTION`, `TURN_CHANGED`, `HAND_COMPLETE`)
  - applied cue-class projection for both play-table and multi-table screens from one mapper
- Added reusable motion tokens to client styles:
  - `--motion-fast`, `--motion-mid`, `--motion-slow`
  - `--easing-emphasis`, `--easing-soft`
- Added motion cue styling hooks:
  - shell-level start/complete cue styling
  - multi-table feed/action cue pulses
  - unified timing updates for key existing gameplay transitions

## Completed in PR AQ

- Implemented Phase 2 board/card dealing motion in the modern play-table view:
  - board-deal animation plan now keys off actual latest deal events (`DEAL_FLOP`, `DEAL_TURN`, `DEAL_RIVER`)
  - flop deals now use staggered per-card timing (~70ms intervals)
  - turn/river deals now add single-card street emphasis styling
- Added board/card motion classes and keyframes:
  - `is-flop-deal`, `is-street-deal`
  - card-level deal delay via `--deal-delay`
  - street emphasis pulse (`street-pop`)

## Completed in PR AR

- Added event-burst animation consumption in modern client render flow so animation-only cues are driven by newly-arrived domain events rather than replaying on every re-render.
- Added chip/pot transfer animation planning in play view:
  - contributions to pot for `BLIND_POSTED`, `PLAYER_CALLED`, `PLAYER_BET`, `PLAYER_RAISED`, and `PLAYER_ALL_IN`
  - payouts from pot for `HAND_WON_UNCONTESTED` and `SHOWDOWN_RESOLVED`
- Added felt overlay chip-transfer trails and staged timing for transfer readability.
- Added multi-table chip-flow feed cue and contextual activity line integration for transfer events.

## Completed in PR AS

- Restored legacy-style How To card examples in modern client docs flow:
  - extracted card rows from legacy How To Vue `rounds` slot markup
  - preserved per-card visibility semantics from legacy `is_flipped` usage (hidden back vs face-up front)
- Extended generated How To contract to include per-guide `cardExamples`.
- Updated modern How To screen composition to render card example rows using normalized SVG card assets.
- Added responsive styling for How To example rows so card strips remain readable on mobile and desktop.

## Completed in PR AT

- Added flip-card interaction parity for modern How To examples:
  - per-card tap/click toggle between front and back faces
  - default face orientation respects legacy `is_flipped` semantics captured during extraction
- Added keyboard-accessible interactive card controls and visible focus treatment for desktop users.
- Added modern 3D flip-card visual treatment for How To examples using existing normalized card SVG assets.

## Completed in PR AU

- Extended legacy How To extraction to preserve in-row visual sequence tokens for examples:
  - card tokens
  - explicit `+` separator tokens
- Improved extracted example labeling by normalizing/de-duplicating legacy deck/list labels (`Flop`, `Turn`, `River`, `Hole Cards`, `Door Card`).
- Updated modern How To rendering to display separators between interactive flip cards so round examples match legacy visual composition more closely.

## Completed in PR AV

- Added deck-container metadata extraction for legacy How To examples:
  - per-example parent list-item grouping id
  - legacy deck class names
- Updated modern How To example rendering to preserve multi-deck group composition from legacy rounds by grouping examples per parent list item.
- Added deck-pattern styling hooks so grouped examples better reflect legacy street/pocket/stud visual blocks.

## Completed in PR AW

- Removed cross-example de-duplication in How To card-example extraction so repeated legacy deck rows are preserved in source order.
- Restored full repeated-example parity for Seven Card Stud round visuals (all legacy `div.cards` rows now flow into modern generated `cardExamples`).
- Retained prior grouping/sequence metadata (`groupId`, `deckClass`, separator-aware `items`) while expanding output completeness.

## Completed in PR AX

- Added supplemental hand examples for game types with no legacy card-example markup:
  - Lowball
  - Mississippi Stud
  - Razz
  - Jacks or Better
  - Draw High
- Kept extraction behavior legacy-first: supplemental examples are only used when a guide has zero extracted card rows from legacy `rounds` content.
- Added generation-time card code validation for supplemental examples to prevent invalid card references from entering generated How To data.

## Completed in PR AY

- Upgraded local client gameplay bots with hand-aware action mechanics:
  - preflop strength scoring from hole-card structure (pairs/suited/connectivity/high-card pressure)
  - postflop strength scoring from evaluated best hand + draw-potential context
- Added deterministic per-bot behavior profiles (tightness/aggression/bluff/gamble) for more varied but reproducible table personalities.
- Added pot-pressure and pot-odds-aware action thresholds to improve fold/call/raise realism across streets.
- Updated bet/raise sizing selection to scale with evaluated strength and bot profile tendencies.

## Completed in PR AZ

- Added board-texture-aware local bot mechanics:
  - wetness scoring from suit concentration/rank connectivity/high-card texture
  - paired-board awareness
- Integrated board texture signals into action thresholds:
  - aggression/value pressure increases for strong hands on wet textures
  - weaker hands fold/call less often under wet-board pressure
  - bluff pressure shifts toward drier textures
- Added preflop short-stack push/fold logic based on stack depth in big blinds and strength thresholds.
- Updated bet/raise sizing logic to include board texture intensity as an input.

## Completed in PR BA

- Added position-aware local bot mechanics:
  - relative seat-position scoring from button order among active contesting seats
  - tighter early-position and wider late-position action tendencies
- Added preflop raise-pressure mechanics:
  - explicit open-raise and 3-bet pressure detection
  - pressure-aware adjustments to fold/call/raise thresholds
- Added heads-up adaptation for aggression and defend behavior when one opponent remains.
- Applied position/pressure factors to short-stack push/fold gates and sizing curves.

## Completed in PR BB

- Added opponent-memory local bot mechanics:
  - rolling per-seat recent action tracking (`FOLD`, `CHECK`, `CALL`, `BET`, `RAISE`, `ALL_IN`)
  - memory-window capping to preserve recent-table-image signal
- Added memory-driven strategy influence:
  - opponent fold-rate pressure for bluff/value balancing
  - opponent aggression pressure/counter-pressure adjustments
  - self-style continuity so bot lines are less erratic hand-to-hand
- Applied memory influence across fold/call/raise/all-in thresholds and sizing gates.

## Completed in PR BC

- Added multi-table pending-decision micro-state:
  - per-table pending decision counts in the open-table rail
  - explicit `Acting now` urgency state for tables requiring immediate action
- Added action-confirmation interaction feedback in multi-table controls:
  - short-lived confirmation pulse on selected action controls
  - action-bar urgency emphasis while table is pending/acting
- Updated multi-table activity messaging to reflect live pending queue status.

## Completed in PR BD

- Wired multi-table UI to live per-table engine runtime state:
  - per-table pending/acting signals now derive from real controller state instead of mock counters
  - rail urgency and queue summaries now reflect actual legal-turn ownership
- Wired multi-table action bar to live legal-action DTOs:
  - action availability/disable states now follow current table legality
  - selected `RAISE` intent now falls back to `BET` when that is the legal target-bet action
  - target amount bounds now use live min/max from engine-projected action options
- Added live stage/feed integration:
  - board preview, seat statuses, pot display, and latest event note now come from per-table runtime models/logs
- Added auto-next-hand scheduling for multi-table background controllers after hand completion.

## Completed in PR BE

- Added client regression test coverage for multi-table legal-action/runtime behavior:
  - raise-intent mapping with `BET` fallback
  - available-action derivation for disabled-state handling
  - selected-action normalization when legality changes
  - pending-decision derivation from live phase/acting-seat state
- Extracted shared multi-table legality helpers into a dedicated client module and wired `main.ts` to consume it.
- Updated canonical modern CI script to include client tests (`npm run test:client`).

## Completed in PR BF

- Extracted multi-table action-submission execution into a dedicated helper module:
  - controller availability/turn-ownership/legality guards
  - target-bet amount clamp at submit boundary
  - action-specific activity-note generation
- Updated multi-table submit flow in client screen wiring to consume the shared helper.
- Added integration-style client tests for multi-table submit behavior:
  - legal vs illegal submit transitions
  - not-on-turn rejection
  - raise/bet amount clamping and intent mapping correctness.

## Completed in PR BG

- Added browser-level client UI regression coverage using a headless Chrome + CDP harness:
  - validates multi-table action-bar legality/disabled-state alignment in a real browser runtime
  - validates desktop keyboard submit flow (`Enter`) updates live activity feed state
- Integrated browser-level UI assertions into canonical client test script:
  - `modern/package.json` -> `test:client` now runs unit tests plus browser checks
- Enforced non-skipping browser coverage in GitHub modern CI:
  - `.github/workflows/modern-ci.yml` sets `BROWSER_UI_REQUIRED=1` during `npm run ci`
- Updated developer docs with browser test prerequisites and overrides (`BROWSER_UI_CHROME_BIN`).

## Completed in PR BH

- Expanded browser-level client UI checks for interaction and mobile ergonomics:
  - lobby seat-selection and enter-table flow assertion
  - mobile multi-table action-bar thumb-reach placement assertion
  - large touch-target minimum assertions for primary CTA/action controls
- Added viewport emulation and app-ready waiting utilities to the browser harness for stable mobile checks.
- Updated client primary CTA styling to enforce `44px` minimum touch target height.

## Completed in PR BI

- Added browser-level regression assertion for modern `How To` flip-card behavior:
  - verifies click toggle flips face state and `aria-pressed`
  - verifies second click restores the original state
- Extended browser UI harness coverage so restored HowTo card interactivity remains protected in CI/local browser verification.

## Completed in PR BJ

- Added live player-facing win-chance mechanics to modern play-table UX:
  - deterministic seeded simulations for incomplete-board win percentages
  - deterministic showdown odds when board is complete
  - payout-share rendering mode for hand-complete outcomes
- Added winner-forward visual UX in play table:
  - prominent hand outcome winner/split banner
  - turn-panel per-seat win probability bars
  - seat-card odds leader/winner highlights and outcome pills
  - player HUD win-percent and best-hand context
- Added dedicated client win-odds module (`apps/client/src/win-odds.ts`) to isolate odds logic from rendering concerns.

## Completed in PR BK

- Added role primitives to modern auth profile/session contracts (`PLAYER`, `OPERATOR`, `ADMIN`).
- Added server-side role normalization + validation for bootstrap/restored users.
- Added role-aware audit visibility boundaries:
  - `PLAYER`: own auth-audit records only
  - `OPERATOR`/`ADMIN`: cross-user or unscoped auth-audit visibility
- Added dedicated auth-authorization regression tests and integrated them into `test:server`.
- Updated server bootstrap-user documentation/examples to include role fields.

## Completed in PR BL

- Added external identity assertion verification module for signed auth assertions:
  - payload validation (`iss`, `sub`, `email`, `exp`)
  - HMAC signature verification
  - issuer and expiration enforcement
- Added external identity login endpoint:
  - `POST /api/auth/external/login`
- Added external identity user linking in auth wallet service:
  - links provider/subject to existing user when email matches
  - creates new user when no match exists
  - rejects provider/subject email mismatches for existing links
- Added startup/env configuration controls:
  - `POKER_EXTERNAL_AUTH_ENABLED`
  - `POKER_EXTERNAL_AUTH_ISSUER`
  - `POKER_EXTERNAL_AUTH_SHARED_SECRET`
- Added runtime diagnostics for external auth in `/health` and startup logs.
- Added regression coverage for external assertion verification and external identity login flows.

## Completed in PR BM

- Added external auth secret-rotation verification support:
  - assertions now verify against active secret and optional previous secret
- Added rotation-safe env configuration controls:
  - `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS`
  - validation guardrails (minimum length, requires primary secret, must differ from primary)
- Added rotation runtime diagnostics:
  - `/health` includes `runtime.externalAuthSecretRotationEnabled`
  - startup logs show when previous verification secret is active
- Updated server and deployment docs with rotation procedure and no-downtime rollout sequence.
- Added regression tests for multi-secret verification and startup-config rotation validation.

## Completed in PR BN

- Added route-level server regression coverage for external auth routes without opening network sockets:
  - `GET /health` verifies external auth runtime diagnostics including rotation flag
  - `POST /api/auth/external/login` verifies previous-secret rotation fallback succeeds
  - `POST /api/auth/external/login` verifies disabled-mode response (`EXTERNAL_AUTH_DISABLED`)
- Exported shared server request handler for direct route test harness execution.
- Added explicit test-only listen guard:
  - `POKER_SERVER_NO_LISTEN=1` disables HTTP listen during direct handler tests.

## Completed in PR BO

- Added external provider integration mode for auth-proxy deployments:
  - `POKER_EXTERNAL_AUTH_MODE=trusted_headers`
  - validates trusted proxy secret and `x-external-auth-*` identity headers
- Kept signed-assertion mode as default while adding explicit mode selection:
  - `signed_assertion` (existing)
  - `trusted_headers` (new)
- Added startup/env guardrails for trusted-header mode:
  - `POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET` requirement and minimum-length validation
- Extended runtime diagnostics:
  - `/health` now includes `runtime.externalAuthMode`
- Added regression coverage for trusted-header mode success + invalid proxy-secret paths.

## Completed in PR BP

- Added Firebase-native external auth mode with decoupled verification module:
  - `POKER_EXTERNAL_AUTH_MODE=firebase_id_token`
  - standalone Firebase ID token verifier (`firebase-id-token.ts`)
- Added Firebase verification config controls:
  - `POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID`
  - `POKER_EXTERNAL_AUTH_FIREBASE_AUDIENCE`
  - `POKER_EXTERNAL_AUTH_FIREBASE_ISSUER`
  - `POKER_EXTERNAL_AUTH_FIREBASE_CERTS_URL`
- Wired `/api/auth/external/login` for Firebase bearer token flow while preserving existing modes:
  - signed assertions
  - trusted headers
  - Firebase ID token
- Kept provider wiring uncoupled by injecting verifier function into route runtime context for testability/future replacement.
- Added regression tests for Firebase verifier and route-level Firebase mode login flow.
- Added Firebase Hosting starter config template for modern SPA + `/api/**` backend rewrite:
  - `modern/firebase.hosting.example.json`
  - `modern/firebase.json`
  - `modern/.firebaserc.example`

## Completed in PR BQ

- Added pluggable Firebase verifier selection with stable runtime interface:
  - `POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER=jwt|admin_sdk`
- Added Firebase Admin SDK adapter module for ID token verification (optional runtime path):
  - dynamic SDK loading to avoid hard coupling in route layer
  - optional service-account file support
- Added startup/env validation for Admin SDK path:
  - `POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE`
- Kept `/api/auth/external/login` provider-agnostic by injecting verifier implementation through runtime context.
- Added regression coverage for Admin SDK adapter, verifier-factory selection, and startup config verifier/credential validation.

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
38. PR AL: Mobile tray auto-open/resize hardening + reduced-motion/safe-area support.
39. PR AM: Action amount draft persistence + accessibility semantics for selection and action controls.
40. PR AN: Mobile-first multi-table screen with thumb action bar and desktop keyboard shortcuts.
41. PR AO: Runtime-entropy hand randomization + seeded bot randomness + client animation roadmap.
42. PR AP: Centralized event-to-motion cue mapping and Phase 1 animation tokens/hook wiring.
43. PR AQ: Event-driven staged board dealing animation with flop stagger and turn/river emphasis.
44. PR AR: Event-burst chip/pot transfer animation layer and multi-table chip-flow cues.
45. PR AS: How To card-example extraction and flip-card visual parity restoration.
46. PR AT: How To interactive flip-card behavior and keyboard-accessible parity.
47. PR AU: How To visual-sequence extraction for separators and normalized deck labels.
48. PR AV: How To deck-container grouping extraction and grouped rendering parity.
49. PR AW: How To repeated-example preservation by removing cross-row de-duplication.
50. PR AX: Supplemental hand examples for game types without legacy card markup.
51. PR AY: Hand-aware local bot decision mechanics (strength, pressure, and sizing profiles).
52. PR AZ: Board-texture-aware and short-stack push/fold bot mechanics.
53. PR BA: Position-aware and raise-pressure-aware local bot decision mechanics.
54. PR BB: Opponent-memory-aware local bot adaptation mechanics.
55. PR BC: Multi-table pending-decision urgency and action-confirmation feedback.
56. PR BD: Multi-table live runtime wiring for pending state and legal actions.
57. PR BE: Client regression tests for multi-table legality and pending-state controls.
58. PR BF: Multi-table action-submission integration tests and shared submit helper.
59. PR BG: Browser-level multi-table UI regression harness and CI enforcement.
60. PR BH: Mobile reachability and lobby-flow browser assertions with CTA touch-target hardening.
61. PR BI: HowTo flip-card browser regression assertions.
62. PR BJ: Winner-focused play-table UX and live win-chance mechanics.
63. PR BK: Role-based auth audit visibility boundaries and contract role support.
64. PR BL: External identity signed-assertion login integration.
65. PR BM: External auth secret-rotation verification hardening.
66. PR BN: Route-level external auth + health runtime diagnostics regression tests.
67. PR BO: Trusted-header external provider integration mode.
68. PR BP: Firebase ID token provider mode wiring.
69. PR BQ: Firebase Admin SDK adapter behind pluggable verifier interface.

## Cutover Go/No-Go Checklist

- `npm run typecheck` passes in `modern/`.
- `npm run build` passes in `modern/`.
- `npm run test:client` passes in `modern/`.
- `npm run test:engine` passes in `modern/`.
- `npm run test:server` passes in `modern/`.
- Required user journeys validated in modern app.
- Deployment runbook updated for modern runtime.
- Production auth bootstrap strategy documented (`POKER_AUTH_BOOTSTRAP_USERS_FILE` or explicit demo override).
- Legacy archive guard is active (or documented emergency override applied for approved fixes).
- Rollback path documented before legacy removal PR merges.
