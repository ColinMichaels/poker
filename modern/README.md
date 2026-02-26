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
See `docs/legacy-removal-execution.md` for the final legacy removal runbook.
See `docs/deployment-runbook.md` for modern runtime deployment entrypoints/checks.
See `docs/client-animation-roadmap.md` for planned gameplay animation improvements.

## Commands

From `modern/`:

- `nvm use` - switch to the workspace Node version
- `npm install` - install all workspace dependencies
- `npm run dev:client` - run client dev server
- `npm run dev:server` - run authoritative server in watch mode
- `npm run ci` - run typecheck + build + client tests + engine tests + server tests
- `npm run check:legacy-refs` - verify modern runtime source does not introduce new `legacy/` path references
- `npm run check:server-env-template` - verify `apps/server/.env.example` includes required server env keys
- `npm run typecheck` - run TypeScript checks across all workspaces
- `npm run test:client` - run client unit + browser-level UI regression tests
- `npm run test:browser-ui --workspace @poker/client` - run browser-level UI assertions against built client output
- `npm run build:server` - compile the server workspace
- `npm run test:server` - run server hand lifecycle + auth/wallet tests
- `npm run generate:howto-content` - extract legacy `HowTo` Vue content into modern typed guide data
- `npm run generate:assets` - generate asset manifest only
- `npm run generate:assets:normalize` - generate manifest and write normalized assets to `apps/client/public/assets`
- `npm run validate:fixtures` - validate Texas Hold'em fixtures
- `npm run test --workspace @poker/poker-engine` - run evaluator/showdown/reducer tests
- `npm run firebase:prepare:hosting` - create `.firebase.deploy.json` with optional backend rewrite overrides
- `npm run firebase:deploy:hosting` - build client and deploy Firebase Hosting with current `firebase.json` rewrite target
- `npm run firebase:deploy:hosting:backend-target` - deploy Hosting with backend rewrite target from env (`FIREBASE_BACKEND_SERVICE_ID`, `FIREBASE_BACKEND_REGION`)

## CI

- Workflow: `.github/workflows/modern-ci.yml`
- Runs on changes under `modern/**` (plus manual dispatch)
- Executes:
  - `npm run ci`

## Notes

- This workspace is wired for npm workspaces.
- Run all workspace install/build commands from `modern/`.
- Server API details: `apps/server/README.md`.
- Server env template: `apps/server/.env.example`.
- Client env template: `apps/client/.env.example`.
- Firebase Hosting config: `firebase.json` (`.firebaserc.example` template).
- To run play view against authoritative server runtime, set `VITE_TABLE_RUNTIME_MODE=server` in `apps/client/.env.local`.
