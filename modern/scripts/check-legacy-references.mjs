import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');

const scanRoots = [
  path.resolve(repoRoot, 'apps/client/src'),
  path.resolve(repoRoot, 'apps/server/src'),
];

const allowedFiles = new Set([
  path.resolve(repoRoot, 'apps/client/src/content/howto-content.ts'),
]);

const skippedDirNames = new Set(['node_modules', 'dist', '.data']);
const skippedExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.mp3', '.wav', '.ico']);
const legacyPattern = /\blegacy\//;

function walk(directoryPath, output) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (skippedDirNames.has(entry.name)) {
        continue;
      }
      walk(entryPath, output);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (skippedExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    output.push(entryPath);
  }
}

function findMatches(filePath) {
  if (allowedFiles.has(filePath)) {
    return [];
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  const lines = contents.split('\n');
  const matches = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (legacyPattern.test(lines[index])) {
      matches.push(index + 1);
    }
  }

  return matches;
}

const filesToScan = [];
for (const scanRoot of scanRoots) {
  if (!fs.existsSync(scanRoot)) {
    continue;
  }
  walk(scanRoot, filesToScan);
}

const violations = [];
for (const filePath of filesToScan) {
  const matchLines = findMatches(filePath);
  if (matchLines.length > 0) {
    violations.push({
      filePath: path.relative(repoRoot, filePath),
      lines: matchLines,
    });
  }
}

if (violations.length > 0) {
  console.error('Legacy path references detected in modern runtime source:');
  for (const violation of violations) {
    console.error(`- ${violation.filePath}: lines ${violation.lines.join(', ')}`);
  }
  console.error('Remove runtime legacy path references or extend the allowlist with explicit justification.');
  process.exit(1);
}

console.info('Legacy reference check passed for modern runtime source.');
