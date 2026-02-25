# Modern Workspace

This directory contains the modernization scaffold for rebuilding the legacy poker project.

## Layout

- `apps/client`: Babylon.js game client shell
- `apps/server`: multiplayer/session service shell
- `packages/poker-engine`: framework-agnostic poker rules + fixtures
- `packages/game-contracts`: shared command/event contracts
- `packages/asset-manifest`: asset normalization + manifest generator

## Commands

From `modern/`:

- `npm run generate:assets` - generate asset manifest only
- `npm run generate:assets:normalize` - generate manifest and write normalized assets to `apps/client/public/assets`
- `npm run validate:fixtures` - validate Texas Hold'em fixtures

## Notes

- `pnpm` is not available in this environment, so this scaffold is wired with npm workspaces.
- Dependencies are declared but not installed yet.
