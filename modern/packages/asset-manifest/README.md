# Asset Manifest Package

Generates a normalized manifest from legacy assets located at `legacy/public/Poker`.

## Scripts

- `npm run generate --workspace @poker/asset-manifest`
  - scans legacy assets and writes generated manifest files
- `npm run generate:normalize --workspace @poker/asset-manifest`
  - scans assets, writes manifest files, and copies normalized assets to:
    - `modern/apps/client/public/assets`

## Outputs

- `generated/asset-manifest.json`
- `generated/asset-manifest.ts`
- `generated/asset-manifest-report.md`
