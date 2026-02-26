# Poker Modernization Workspace

This repository now defaults to the modern TypeScript workspace in `modern/`.

## Current Default

- Client: `modern/apps/client`
- Server: `modern/apps/server`
- Engine + contracts: `modern/packages/*`

## Quick Start

From repository root:

1. `cd modern`
2. `nvm use` (or `nvm install && nvm use`)
3. `npm install`
4. `npm run typecheck`
5. `npm run build`
6. `npm run test:engine`
7. `npm run test:server`

Or use root shortcuts:

- `npm run dev` (modern client)
- `npm run dev:server`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Docs

- Modern workspace guide: `modern/README.md`
- Developer setup/troubleshooting: `modern/docs/developer-setup.md`
- Legacy decommission + cutover status: `modern/docs/legacy-decommission-plan.md`

## Legacy Codebase

The Laravel/Vue2 implementation remains in place for controlled migration and historical reference.

- Legacy archive location: `legacy/`
- Legacy framework notes: `legacy/laravel-readme.md`
- Legacy archive README: `legacy/README.md`
- Legacy archive guard workflow: `.github/workflows/legacy-archive-guard.yml`
