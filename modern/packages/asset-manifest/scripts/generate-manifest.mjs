import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../');
const sourceRoot = path.resolve(repoRoot, 'public/Poker');
const generatedRoot = path.resolve(__dirname, '../generated');
const normalizedOutputRoot = path.resolve(repoRoot, 'modern/apps/client/public/assets');

const normalizeOutput = process.argv.includes('--normalize-output');

const cardsSource = path.join(sourceRoot, 'cards');
const chipsSource = path.join(sourceRoot, 'chips');
const avatarsSource = path.join(sourceRoot, 'avatars');
const soundsSource = path.join(sourceRoot, 'sounds');
const logosSource = path.join(sourceRoot, 'logos');

const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const suits = ['C', 'D', 'H', 'S'];
const canonicalCards = suits.flatMap((suit) => ranks.map((rank) => `${rank}${suit}`));

const avatarRenameMap = new Map([
  ['traditiona-japanese-man', 'traditional-japanese-man'],
]);

const tableSoundIds = new Set(['card', 'chip', 'chip2', 'chip3', 'chips', 'shuffle']);
const uiSoundIds = new Set(['cha-ching', 'tada']);
const voiceSoundIds = new Set(['im-batman', 'robot-2', 'robot-blip', 'we_have_losers']);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listFiles(dirPath, extension) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((entry) => {
      const fullPath = path.join(dirPath, entry);
      if (!fs.statSync(fullPath).isFile()) {
        return false;
      }
      return extension ? entry.toLowerCase().endsWith(extension.toLowerCase()) : true;
    })
    .sort((a, b) => a.localeCompare(b));
}

function categoryForSound(id) {
  if (tableSoundIds.has(id)) return 'table';
  if (uiSoundIds.has(id)) return 'ui';
  if (voiceSoundIds.has(id)) return 'voice';
  return 'misc';
}

function copyFileSafe(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function generateManifest() {
  const warnings = [];

  const sourceCardFiles = listFiles(cardsSource, '.svg');
  const sourceCardSet = new Set(sourceCardFiles);

  const cardFaces = {};
  const cardAliases = {};
  const missingCards = [];
  const usedCardSourceFiles = new Set();

  for (const cardCode of canonicalCards) {
    const canonicalFile = `${cardCode}.svg`;
    const aliasFile = `${cardCode.replace(/^J/, '11')}.svg`;

    if (sourceCardSet.has(canonicalFile)) {
      cardFaces[cardCode] = `/assets/cards/${canonicalFile}`;
      usedCardSourceFiles.add(canonicalFile);
      continue;
    }

    if (sourceCardSet.has(aliasFile)) {
      cardFaces[cardCode] = `/assets/cards/${canonicalFile}`;
      cardAliases[aliasFile.replace('.svg', '')] = cardCode;
      usedCardSourceFiles.add(aliasFile);
      warnings.push(`Used alias ${aliasFile} for missing canonical ${canonicalFile}.`);
      continue;
    }

    missingCards.push(cardCode);
  }

  const cardBackFiles = sourceCardFiles.filter((file) => /^Card_back_.*\.svg$/i.test(file));
  for (const backFile of cardBackFiles) {
    usedCardSourceFiles.add(backFile);
  }

  const extraCardFiles = sourceCardFiles.filter((file) => !usedCardSourceFiles.has(file));

  const cardBacks = Object.fromEntries(
    cardBackFiles.map((file) => [file.replace('.svg', ''), `/assets/cards/${file}`]),
  );

  const chipFiles = listFiles(chipsSource, '.svg');
  const chipPairs = chipFiles
    .map((file) => {
      const denomination = Number(file.replace('.svg', ''));
      if (!Number.isFinite(denomination)) {
        warnings.push(`Skipping chip file with non-numeric name: ${file}`);
        return null;
      }
      return [denomination, `/assets/chips/${file}`];
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);

  const chips = {
    denominations: chipPairs.map(([denomination]) => denomination),
    assets: Object.fromEntries(chipPairs.map(([denomination, url]) => [String(denomination), url])),
  };

  const avatarFiles = listFiles(avatarsSource, '.svg');
  const avatarItems = [];
  const avatarRenames = [];
  const avatarDuplicates = [];
  const seenAvatarIds = new Set();

  for (const file of avatarFiles) {
    const originalId = file.replace('.svg', '');
    const normalizedId = avatarRenameMap.get(originalId) ?? originalId;

    if (seenAvatarIds.has(normalizedId)) {
      avatarDuplicates.push({
        id: normalizedId,
        file,
      });
      warnings.push(`Avatar duplicate after normalization: ${file} -> ${normalizedId}`);
      continue;
    }

    seenAvatarIds.add(normalizedId);

    if (originalId !== normalizedId) {
      avatarRenames.push({ from: originalId, to: normalizedId });
    }

    avatarItems.push({
      id: normalizedId,
      src: `/assets/avatars/${normalizedId}.svg`,
      originalId,
      originalFile: file,
    });
  }

  const soundFiles = listFiles(soundsSource, '.mp3');
  const sounds = {};
  const soundCategories = {
    table: [],
    ui: [],
    voice: [],
    misc: [],
  };

  for (const file of soundFiles) {
    const id = file.replace('.mp3', '');
    const category = categoryForSound(id);

    sounds[id] = {
      src: `/assets/sounds/${file}`,
      category,
    };

    soundCategories[category].push(id);
  }

  const logoFiles = listFiles(logosSource);
  const logos = {};
  for (const file of logoFiles) {
    const parsed = path.parse(file);
    let id = parsed.name;

    // Keep both png/svg variants if they share a stem.
    if (Object.prototype.hasOwnProperty.call(logos, id)) {
      id = `${parsed.name}_${parsed.ext.replace('.', '')}`;
      warnings.push(`Logo id collision detected. Using '${id}' for ${file}.`);
    }

    logos[id] = `/assets/logos/${file}`;
  }

  if (normalizeOutput) {
    fs.rmSync(normalizedOutputRoot, { recursive: true, force: true });
    ensureDir(normalizedOutputRoot);

    for (const cardCode of Object.keys(cardFaces)) {
      const preferredFile = `${cardCode}.svg`;
      const aliasFile = `${cardCode.replace(/^J/, '11')}.svg`;
      const srcFile = sourceCardSet.has(preferredFile) ? preferredFile : aliasFile;
      const src = path.join(cardsSource, srcFile);
      const dest = path.join(normalizedOutputRoot, 'cards', `${cardCode}.svg`);
      copyFileSafe(src, dest);
    }

    for (const backFile of cardBackFiles) {
      copyFileSafe(path.join(cardsSource, backFile), path.join(normalizedOutputRoot, 'cards', backFile));
    }

    for (const [denomination] of chipPairs) {
      const file = `${denomination}.svg`;
      copyFileSafe(path.join(chipsSource, file), path.join(normalizedOutputRoot, 'chips', file));
    }

    for (const avatar of avatarItems) {
      copyFileSafe(
        path.join(avatarsSource, avatar.originalFile),
        path.join(normalizedOutputRoot, 'avatars', `${avatar.id}.svg`),
      );
    }

    for (const file of soundFiles) {
      copyFileSafe(path.join(soundsSource, file), path.join(normalizedOutputRoot, 'sounds', file));
    }

    for (const file of logoFiles) {
      copyFileSafe(path.join(logosSource, file), path.join(normalizedOutputRoot, 'logos', file));
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceRoot: 'public/Poker',
    normalizedOutputRoot: 'modern/apps/client/public/assets',
    normalization: {
      enabled: normalizeOutput,
      avatarRenames,
      warnings,
    },
    cards: {
      expectedFaces: canonicalCards.length,
      faces: cardFaces,
      missingFaces: missingCards,
      aliases: cardAliases,
      backs: cardBacks,
      extras: extraCardFiles,
    },
    chips,
    avatars: {
      items: avatarItems,
      duplicates: avatarDuplicates,
    },
    sounds: {
      items: sounds,
      categories: soundCategories,
    },
    logos: {
      items: logos,
    },
    stats: {
      cards: {
        sourceFiles: sourceCardFiles.length,
        normalizedFaces: Object.keys(cardFaces).length,
        normalizedBacks: Object.keys(cardBacks).length,
        missingFaces: missingCards.length,
        extras: extraCardFiles.length,
      },
      chips: {
        sourceFiles: chipFiles.length,
        normalized: chips.denominations.length,
      },
      avatars: {
        sourceFiles: avatarFiles.length,
        normalized: avatarItems.length,
        renames: avatarRenames.length,
        duplicates: avatarDuplicates.length,
      },
      sounds: {
        sourceFiles: soundFiles.length,
        normalized: Object.keys(sounds).length,
      },
      logos: {
        sourceFiles: logoFiles.length,
        normalized: Object.keys(logos).length,
      },
    },
  };

  ensureDir(generatedRoot);

  const manifestJsonPath = path.join(generatedRoot, 'asset-manifest.json');
  const manifestTsPath = path.join(generatedRoot, 'asset-manifest.ts');
  const reportPath = path.join(generatedRoot, 'asset-manifest-report.md');

  writeJson(manifestJsonPath, manifest);

  fs.writeFileSync(
    manifestTsPath,
    [
      'export const assetManifest = ',
      JSON.stringify(manifest, null, 2),
      ' as const;',
      '',
      'export type AssetManifest = typeof assetManifest;',
      '',
    ].join('\n'),
    'utf8',
  );

  const reportLines = [
    '# Asset Manifest Report',
    '',
    `Generated: ${manifest.generatedAt}`,
    `Normalization output written: ${normalizeOutput ? 'yes' : 'no'}`,
    '',
    '## Cards',
    `- Source files: ${manifest.stats.cards.sourceFiles}`,
    `- Normalized faces: ${manifest.stats.cards.normalizedFaces}`,
    `- Normalized backs: ${manifest.stats.cards.normalizedBacks}`,
    `- Missing faces: ${manifest.stats.cards.missingFaces}`,
    `- Extra files: ${manifest.stats.cards.extras}`,
    '',
    '## Avatars',
    `- Source files: ${manifest.stats.avatars.sourceFiles}`,
    `- Normalized: ${manifest.stats.avatars.normalized}`,
    `- Renamed: ${manifest.stats.avatars.renames}`,
    `- Duplicates after normalization: ${manifest.stats.avatars.duplicates}`,
    '',
    '## Warnings',
    ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- none']),
    '',
  ];

  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');

  return {
    manifestJsonPath,
    manifestTsPath,
    reportPath,
    normalizedOutputRoot,
    manifest,
  };
}

const result = generateManifest();

console.info('Asset manifest generated successfully.');
console.info(`- JSON: ${path.relative(repoRoot, result.manifestJsonPath)}`);
console.info(`- TS:   ${path.relative(repoRoot, result.manifestTsPath)}`);
console.info(`- MD:   ${path.relative(repoRoot, result.reportPath)}`);

if (normalizeOutput) {
  console.info(`- Normalized assets: ${path.relative(repoRoot, result.normalizedOutputRoot)}`);
}

if (result.manifest.cards.missingFaces.length > 0) {
  process.exitCode = 1;
  console.error('Missing canonical cards detected.');
}
