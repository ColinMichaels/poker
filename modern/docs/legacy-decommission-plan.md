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

1. Authoritative backend/session service is still scaffold-only (`modern/apps/server/src/index.ts`).
2. Legacy auth/wallet/user CRUD flows do not yet have modern replacements.
3. Root repository still reflects legacy project shape and README messaging.

## Completed in PR A

- Legacy `HowTo` variant content was extracted into modern typed guide data:
  - `modern/apps/client/src/content/howto-content.ts`
  - generator: `modern/scripts/generate-howto-content.mjs`
- Modern client now includes a dedicated `How To` view driven by migrated content.

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

## Cutover Go/No-Go Checklist

- `npm run typecheck` passes in `modern/`.
- `npm run build` passes in `modern/`.
- `npm run test:engine` passes in `modern/`.
- Required user journeys validated in modern app.
- Deployment runbook updated for modern runtime.
- Rollback path documented before legacy removal PR merges.
