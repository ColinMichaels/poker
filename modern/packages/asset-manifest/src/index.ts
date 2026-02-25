export interface AssetManifestSummary {
  generatedAt: string;
  sourceRoot: string;
  normalizedOutputRoot: string;
}

export const manifestInfo: AssetManifestSummary = {
  generatedAt: 'run npm run generate:assets:normalize in modern/ to refresh',
  sourceRoot: 'public/Poker',
  normalizedOutputRoot: 'modern/apps/client/public/assets',
};
