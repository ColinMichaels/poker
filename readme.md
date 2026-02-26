# Poker Modernization Workspace

This repository now defaults to the modern TypeScript workspace in `modern/`.

## Current Default

- Client: `modern/apps/client`
- Server: `modern/apps/server`
- Engine + contracts: `modern/packages/*`

## Quick Start

From repository root:

1. `nvm use` (or `nvm install && nvm use`)
2. `npm run doctor`
3. `cd modern`
4. `nvm use` (or `nvm install && nvm use`)
5. `npm install`
6. `npm run typecheck`
7. `npm run build`
8. `npm run test:engine`
9. `npm run test:server`

Note: installs are engine-enforced (`.npmrc` with `engine-strict=true`), so use Node 22-24 and npm 10+.

Or use root shortcuts:

- `npm run dev` (modern client)
- `npm run dev:server`
- `npm run ci` (doctor + modern typecheck/build/engine/server tests)
- `npm run readiness:legacy-cutover` (legacy-removal static readiness checks)
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Docs

- Modern workspace guide: `modern/README.md`
- Developer setup/troubleshooting: `modern/docs/developer-setup.md`
- Legacy decommission + cutover status: `modern/docs/legacy-decommission-plan.md`
- Final legacy removal runbook: `modern/docs/legacy-removal-execution.md`

## Legacy Codebase

The Laravel/Vue2 implementation remains in place for controlled migration and historical reference.

- Legacy archive location: `legacy/`
- Legacy framework notes: `legacy/laravel-readme.md`
- Legacy archive README: `legacy/README.md`
- Legacy archive guard workflow: `.github/workflows/legacy-archive-guard.yml`
- Root legacy scripts require explicit acknowledgement:
  - `LEGACY_ARCHIVE_ACK=1 npm run legacy:dev`
  - `LEGACY_ARCHIVE_ACK=1 npm run legacy:build`
