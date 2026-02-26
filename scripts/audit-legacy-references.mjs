import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const ignoredDirectories = new Set([
  '.git',
  '.idea',
  'node_modules',
  'dist',
  'legacy',
]);

const textExtensions = new Set([
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.d.ts',
  '.css',
  '.html',
  '.txt',
  '.sh',
  '.xml',
]);

const legacyPattern = /\blegacy\//;

function shouldSkipDirectory(name) {
  return ignoredDirectories.has(name);
}

function shouldScanFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return textExtensions.has(extension);
}

function walk(directoryPath, output) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      walk(entryPath, output);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!shouldScanFile(entryPath)) {
      continue;
    }

    output.push(entryPath);
  }
}

const files = [];
walk(repoRoot, files);

const matches = [];
for (const filePath of files) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const hitLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (legacyPattern.test(lines[index])) {
      hitLines.push(index + 1);
    }
  }

  if (hitLines.length > 0) {
    matches.push({
      filePath: path.relative(repoRoot, filePath),
      lines: hitLines,
    });
  }
}

if (matches.length === 0) {
  console.info('No legacy path references found outside the legacy archive.');
  process.exit(0);
}

console.info('Legacy path reference audit (outside legacy archive):');
for (const match of matches) {
  console.info(`- ${match.filePath}: lines ${match.lines.join(', ')}`);
}
console.info(`Total files with legacy references: ${matches.length}`);
