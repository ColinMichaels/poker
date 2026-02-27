# Client Animation Roadmap (Mobile-First)

Purpose: improve gameplay clarity with motion that communicates game state, not decoration.

## Goals

- Make "who acts next" obvious in under 300ms on mobile.
- Make card/bet transitions feel physical and ordered.
- Keep motion performance stable at 60fps on mid-tier mobile devices.
- Respect accessibility:
  - full support for `prefers-reduced-motion: reduce`
  - no required information conveyed only by animation.

## Current Baseline

- Existing phase/board/acting-seat transitions are class-based in `apps/client/src/main.ts` + `styles.css`.
- Play + multi-table action docks are fixed-bottom controller surfaces with compact action grids.
- Action dock has state transitions and confirmation cues.
- Multi-table screen has thumb-reach action control with pending-turn emphasis, with additional motion orchestration still pending.

## Current Status (Implemented)

- Phase 1 groundwork is in place:
  - centralized event-to-motion cue mapper in `apps/client/src/main.ts`
  - shared cue-class projection across play + multi-table screens
  - motion tokens/easing variables in `apps/client/src/styles.css`
- Phase 2 is partially implemented for board dealing in play view:
  - `DEAL_FLOP/TURN/RIVER` event-driven board deal plan
  - flop stagger timing
  - turn/river emphasis pulse styling
- Phase 3 is partially implemented for chip/pot readability:
  - event-burst chip flow planning (prevents replay on resize/view toggles)
  - blind/call/bet/raise/all-in contribution trails to pot
  - payout trails from pot to winners
  - multi-table activity feed cue for chip-flow moments
- Phase 4 is partially implemented for urgency/feedback:
  - multi-table pending-decision urgency state in the table rail
  - urgency state now reads live per-table runtime turn ownership (not static mock counters)
  - on-turn action-bar emphasis for pending decisions
  - short-lived confirmation pulse on confirmed multi-table actions
- Phase 5 has initial hardening coverage:
  - client regression tests now protect multi-table legal-action mapping and pending-turn controls
  - integration-style tests now cover submit-time legality/turn checks and amount clamping behavior

Remaining roadmap phases below are still pending implementation.

## Phase 1: Motion Tokens + Event Mapping

1. Define animation tokens in CSS variables:
   - `--motion-fast`, `--motion-mid`, `--motion-slow`
   - `--easing-emphasis`, `--easing-soft`
2. Create an event-to-motion map in client render logic:
   - `HAND_STARTED`
   - `DEAL_FLOP`, `DEAL_TURN`, `DEAL_RIVER`
   - `PLAYER_ACTION`
   - `HAND_COMPLETE`
3. Centralize transition class toggles into one "motion state" builder so timing is consistent across play and multi-table views.

## Phase 2: Card + Board Dealing Sequences

1. Add staged board reveal sequence:
   - flop cards staggered by ~70ms each
   - turn/river single-card emphasis.
2. Add card origin transforms from dealer center to seat/board targets.
3. Add subtle depth/parallax during card settle for tactile feel (small translate/scale only).

## Phase 3: Chip + Pot Movement

1. Add chip flow animation for:
   - blind posting to pot
   - call/raise contributions
   - showdown payouts to winners.
2. Use lightweight DOM overlays for chips (no layout thrashing; transform-only animations).
3. Fall back to static pot/stack updates when reduced-motion is enabled.

## Phase 4: Action Feedback + Urgency

1. Add "turn pulse" ring around acting seat and active action bar.
2. Add brief confirmation motion on chosen action button (press + settle).
3. Add pending-action micro-state in multi-table rail so users can spot urgent tables quickly.

## Phase 5: Hardening + Budgets

1. Performance guardrails:
   - animate `transform`/`opacity` only
   - avoid paint-heavy blur/shadow animations during active hands.
2. Add simple frame-time logging in dev mode during hand progression.
3. Add QA checklist:
   - mobile portrait/landscape
   - desktop keyboard flow
   - reduced-motion mode
   - low battery / throttled CPU behavior.

## Implementation Order Recommendation

1. Phase 1 (shared motion system) before adding more effects.
2. Phase 2 (cards) to improve core gameplay readability first.
3. Phase 4 (urgency/feedback) for decision speed.
4. Phase 3 (chips/pot) after motion primitives are stable.
5. Phase 5 continuously during each phase.
