# Modern Workspace

This directory contains the modernization workspace for rebuilding the legacy poker project.

## Layout

- `apps/client`: Babylon.js game client shell
- `apps/server`: multiplayer/session service shell
- `packages/poker-engine`: framework-agnostic poker rules + fixtures
- `packages/game-contracts`: shared command/event contracts
- `packages/asset-manifest`: asset normalization + manifest generator

## Prerequisites

- `nvm`
- Node `22` LTS (`.nvmrc`)
- npm `10+`

See `docs/developer-setup.md` for full setup/troubleshooting.
See `docs/legacy-decommission-plan.md` for the staged plan to make modern the primary codebase.
See `docs/deployment-runbook.md` for modern runtime deployment entrypoints/checks.

## Commands

From `modern/`:

- `nvm use` - switch to the workspace Node version
- `npm install` - install all workspace dependencies
- `npm run dev:client` - run client dev server
- `npm run dev:server` - run authoritative server in watch mode
- `npm run ci` - run typecheck + build + engine tests + server tests
- `npm run check:legacy-refs` - verify modern runtime source does not introduce new `legacy/` path references
- `npm run typecheck` - run TypeScript checks across all workspaces
- `npm run build:server` - compile the server workspace
- `npm run test:server` - run server hand lifecycle + auth/wallet tests
- `npm run generate:howto-content` - extract legacy `HowTo` Vue content into modern typed guide data
- `npm run generate:assets` - generate asset manifest only
- `npm run generate:assets:normalize` - generate manifest and write normalized assets to `apps/client/public/assets`
- `npm run validate:fixtures` - validate Texas Hold'em fixtures
- `npm run test --workspace @poker/poker-engine` - run evaluator/showdown/reducer tests

## CI

- Workflow: `.github/workflows/modern-ci.yml`
- Runs on changes under `modern/**` (plus manual dispatch)
- Executes:
  - `npm run ci`

## Notes

- This workspace is wired for npm workspaces.
- Run all workspace install/build commands from `modern/`.
- Server API details: `apps/server/README.md`.
