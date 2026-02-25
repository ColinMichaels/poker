# Phase 1 Deliverables (Scaffold + Asset Pipeline + Engine Spec)

## Completed Work

## 1) Workspace Scaffold

Created npm workspace scaffold under `modern/`:

- `apps/client` (Vite + TypeScript shell)
- `apps/server` (TypeScript service shell)
- `packages/poker-engine` (domain types + spec + fixtures)
- `packages/game-contracts` (shared command/event contracts)
- `packages/asset-manifest` (asset generation + normalization)

## 2) Asset Manifest + Naming Normalization

Implemented generator script:

- Script: `modern/packages/asset-manifest/scripts/generate-manifest.mjs`
- Command: `npm run generate:assets:normalize` from `modern/`

Outputs:

- `modern/packages/asset-manifest/generated/asset-manifest.json`
- `modern/packages/asset-manifest/generated/asset-manifest.ts`
- `modern/packages/asset-manifest/generated/asset-manifest-report.md`
- normalized assets: `modern/apps/client/public/assets`

Normalization behaviors:

- Canonical card faces normalized to strict 52-card IDs (`AS`, `10D`, etc).
- Card backs copied as-is.
- Avatar typo normalized: `traditiona-japanese-man` -> `traditional-japanese-man`.
- Logo ID collisions handled with extension suffix (example: `poker_logo_svg`).

## 3) Poker Engine Spec + Fixtures

Added MVP Texas Hold'em domain draft:

- Spec: `modern/packages/poker-engine/spec/texas-holdem-mvp-spec.md`
- Hand-rank fixtures: `modern/packages/poker-engine/fixtures/texas-holdem/hand-rank-fixtures.json`
- Showdown fixtures: `modern/packages/poker-engine/fixtures/texas-holdem/showdown-fixtures.json`
- Fixture validator: `modern/packages/poker-engine/scripts/validate-fixtures.mjs`

Validation command:

- `npm run validate:fixtures` from `modern/`

## Current Asset Findings from Generator

- Cards: 60 source SVGs, 52 canonical faces + 3 backs, 5 extras
- Chips: 8/8 normalized
- Avatars: 33/33 normalized, 1 rename, 0 post-normalization duplicates
- Sounds: 12/12 normalized
- Logos: 4/4 normalized

## Extras Identified in Legacy Card Set

Non-canonical extras are currently reported but not included as canonical faces:

- `11C.svg`, `11D.svg`, `11H.svg`, `11S.svg`
- `Red_52_Faces_v.2.0.svg`

