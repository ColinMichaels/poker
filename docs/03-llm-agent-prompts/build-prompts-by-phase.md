# Build Prompts by Phase

Each prompt assumes the agent has read the docs in this repository.

## Prompt 1: Bootstrap Modern Workspace

```text
Read docs/README.md and all files under docs/01-repo-review and docs/02-upgrade-plan.

Create a new TypeScript workspace structure:
- apps/client
- apps/server
- packages/poker-engine
- packages/game-contracts
- packages/asset-manifest

Requirements:
- Vite setup for client
- strict TypeScript configuration
- lint + format scripts
- test runner configured for packages/poker-engine

Output:
1) file tree
2) commands to run
3) short explanation of architecture boundaries
```

## Prompt 2: Implement Core Poker Engine

```text
Implement the initial poker engine in packages/poker-engine.

Scope:
- card/suit/rank models
- deck creation/shuffle/draw
- player stack model
- table state model
- command reducer for: start hand, post blinds, deal hole cards

Rules:
- deterministic RNG injection
- no rendering dependencies
- exhaustive TypeScript types

Add unit tests for all exported functions.
Return changed files and test results.
```

## Prompt 3: Add Hand Evaluator and Showdown

```text
Implement hand evaluation and showdown logic.

Minimum:
- evaluate 5-card categories
- evaluate best 5 from 7 cards
- compare hands with tie-break vectors
- return machine-readable + human-readable outputs

Use legacy ranker behavior only as a reference, not direct copy.

Add fixture-based tests including:
- royal flush
- straight flush
- four of a kind
- full house
- flush
- straight (including wheel A-2-3-4-5)
- three/two/pair/high-card
- tie and kicker scenarios

Return a coverage summary and any unresolved edge cases.
```

## Prompt 4: Build Babylon Table MVP

```text
In apps/client, implement a Babylon.js table MVP wired to the engine.

Must include:
- table scene setup
- deck position and card dealing animation
- 2-6 seat placeholders
- board slots for flop/turn/river
- pot chip stack visualization
- HUD controls for next legal actions

Use assets from legacy/public/Poker via a generated manifest.
No game rules inside scene files.

Return:
- scene architecture summary
- key files
- known visual/performance issues
```

## Prompt 5: Integrate Legacy Assets Cleanly

```text
Create an asset ingestion pipeline from legacy/public/Poker assets.

Tasks:
- copy/import assets into new public assets directory
- generate typed manifest module
- normalize card ID naming and flag invalid files
- categorize sounds (table, ui, voice)
- create avatar metadata with display names and tags

Produce:
- manifest file
- validation script
- markdown report of skipped/renamed assets
```

## Prompt 6: Build Help/Rules Experience

```text
Reuse the legacy HowTo content to create a modern rules/help section.

Requirements:
- convert game-variant text into structured content files
- render in client UI with navigation
- include at least Texas Hold'em and Seven Card Stud sections
- map card examples to current card assets

Return changed files and data format documentation.
```

## Prompt 7: Add Multiplayer Foundation

```text
Implement server-side authoritative session basics in apps/server.

Include:
- room creation/join/leave
- command validation using shared poker-engine
- websocket event broadcast
- state snapshot + incremental event stream

Demonstrate two simulated clients completing one hand.
Return protocol definitions and test/demo output.
```

## Prompt 8: Hardening and Release Prep

```text
Perform a release readiness pass.

Focus:
- engine correctness tests
- integration tests for one full hand flow
- asset load performance metrics
- error handling and reconnect behavior
- docs updates for runbooks and architecture

Return:
- prioritized bug list
- fixed items
- remaining blockers
- release recommendation (go/no-go)
```
