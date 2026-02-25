# Target Architecture (Babylon.js Rebuild)

## Architecture Goals

- Keep poker rules deterministic and framework-independent.
- Separate game logic from rendering and transport.
- Reuse existing assets immediately.
- Allow single-player first, multiplayer-ready design second.

## Recommended Stack

- Language: TypeScript end-to-end
- Build: Vite + pnpm workspace
- 3D/Table rendering: Babylon.js
- UI shell: React (or Vue 3) overlay for menus/lobby/settings
- State: reducer/event-sourced domain store (no ad-hoc event bus)
- Networking (phase 2+): WebSocket server with authoritative state
- Tests: Vitest + Playwright + deterministic engine fixtures

## Proposed Repository Structure

```text
/apps
  /client                # Babylon + UI overlay
  /server                # game sessions, matchmaking, persistence API
/packages
  /poker-engine          # pure TS rules, state transitions, evaluator
  /game-contracts        # shared DTOs/events/commands
  /asset-manifest        # generated card/chip/avatar/sound registry
  /tooling               # lint, tsconfig presets, build scripts
/docs
```

## Layered Design

## 1) Domain Layer (`packages/poker-engine`)

Responsibilities:

- deck creation/shuffle/draw
- betting round transitions
- action validation per phase
- hand evaluation + winner selection
- pot side-pot resolution

Strictly no UI, no HTTP/WebSocket, no Babylon imports.

## 2) Application Layer (`apps/client` + `apps/server`)

Responsibilities:

- translate user intents into domain commands
- apply domain reducer transitions
- emit domain events for rendering/audio/UI
- serialize/deserialize snapshots and events

## 3) Presentation Layer (`apps/client`)

Responsibilities:

- Babylon scene graph and animations
- asset loading/material setup
- camera presets, seat transforms, card/chip placement
- 2D HUD (bet controls, hand summary, timers)

## 4) Infrastructure Layer (`apps/server`)

Responsibilities:

- room/session lifecycle
- player auth + wallet persistence
- anti-cheat authoritative move validation
- reconnect/state resync

## Data Flow

1. UI input (`Bet 50`, `Fold`, `Deal`) -> command.
2. Command -> domain reducer (`applyCommand(state, command)`).
3. Reducer returns new state + emitted domain events.
4. Renderer consumes state/events:
   - Babylon animates table objects.
   - HUD updates values and legal actions.
5. Server (when enabled) is source of truth for multiplayer commands.

## Babylon Scene Composition

- `TableScene`: table mesh, lighting, ambience.
- `SeatNode[]`: each player seat anchor transform.
- `DeckNode`: deck pile and dealing origin.
- `BoardNode`: community card slots.
- `PotNode`: chip stacks in center.
- `AudioBus`: maps domain events to sound effects.

## Asset Strategy

- Keep legacy files under versioned asset pack.
- Build-time manifest generation (`cards`, `chips`, `avatars`, `sounds`, `logos`).
- Lazy-load noncritical avatars/sounds.
- Preload only required assets for first hand.

## Multiplayer Readiness Rules

- Client never decides legal move validity in final architecture.
- Domain reducer code shared by client and server for consistency checks.
- Seeded RNG per hand for reproducibility/debugging.
- All game commands timestamped and sequence-numbered.

## Non-Goals for Initial Milestone

- Do not port Laravel/Inertia UI as-is.
- Do not re-implement Spotify integration until core gameplay is stable.
- Do not optimize advanced shaders before gameplay correctness.

