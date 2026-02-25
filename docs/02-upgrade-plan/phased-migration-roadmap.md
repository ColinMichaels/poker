# Phased Migration Roadmap

This plan is intentionally incremental so you can ship working value early while reducing rewrite risk.

## Phase 0: Stabilize Inputs and Security

Deliverables:

- Rotate compromised credentials and remove secrets from repository history.
- Snapshot current assets and generate initial manifest.
- Freeze legacy repo as reference baseline.

Acceptance criteria:

- No active secrets in tracked files.
- Asset manifest committed and validated.

## Phase 1: Domain Specification and Tests

Deliverables:

- Written game rules spec (Texas Hold'em MVP).
- Pure TypeScript `poker-engine` scaffolding.
- Unit tests for deck, betting rounds, evaluator, showdown, split pots.

Acceptance criteria:

- Deterministic tests pass with seeded RNG.
- Hand evaluator passes fixture corpus.

## Phase 2: Babylon.js Visual MVP (Single Table, Local Simulation)

Deliverables:

- Babylon scene with deck, board, seats, chips.
- Local single-player/simulated opponents using domain engine.
- Card dealing, betting UI, showdown animation.

Acceptance criteria:

- Complete end-to-end hand playable in browser.
- No direct business logic in scene components.

## Phase 3: UX and Content Reuse

Deliverables:

- Integrate avatar selection + sound categories.
- Reuse and modernize `HowTo` rules content pages.
- Add settings: sound volume, animation speed, accessibility controls.

Acceptance criteria:

- Existing asset pack fully integrated via manifest.
- Rules/help screens available in-app.

## Phase 4: Backend Session Service (Multiplayer Foundation)

Deliverables:

- Authoritative game session service.
- WebSocket command/event protocol.
- Persistence for users, wallets, hand history.

Acceptance criteria:

- Two+ clients can join and complete a hand with synchronized state.
- Server rejects illegal actions.

## Phase 5: Competitive Features and Hardening

Deliverables:

- Matchmaking/lobby, reconnection, timeout handling.
- Anti-cheat audit trail and replay logs.
- Performance pass (asset loading, draw calls, animation budgets).

Acceptance criteria:

- Stable multi-hand sessions under load test.
- Replay diagnostics available for dispute/debug.

## Suggested Backlog Slices per Phase

1. Engine core
2. Evaluator correctness
3. Command pipeline
4. Scene primitives
5. Game HUD
6. Audio integration
7. Content/rules reuse
8. Multiplayer transport
9. Persistence
10. QA/observability

## Risk Controls Across All Phases

- Keep a strict definition of done per slice.
- Require tests before merging evaluator/betting logic.
- Use feature flags for unfinished table mechanics.
- Preserve backwards-compatible asset IDs where possible.

