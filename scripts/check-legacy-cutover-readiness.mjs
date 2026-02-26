import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  '.github/workflows/legacy-archive-guard.yml',
  'modern/docs/legacy-removal-execution.md',
  'modern/scripts/check-legacy-references.mjs',
  'modern/scripts/check-server-env-template.mjs',
];

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw new Error(`Failed to run ${command} ${args.join(' ')}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function assertFilesExist() {
  const missing = requiredFiles.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    console.error('Legacy cutover readiness failed: missing required files.');
    for (const filePath of missing) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
  }
}

function main() {
  console.info('Checking legacy cutover static prerequisites...');
  assertFilesExist();
  console.info('Static prerequisite files found.');

  console.info('Running runtime legacy reference check...');
  runCommand('npm', ['run', 'check:legacy-refs', '--prefix', 'modern']);

  console.info('Running server env template check...');
  runCommand('npm', ['run', 'check:server-env-template', '--prefix', 'modern']);

  console.info('Legacy cutover readiness checks passed.');
}

main();
