import { spawnSync } from 'node:child_process';

const LEGACY_ACK_ENV = 'LEGACY_ARCHIVE_ACK';
const ALLOWED_COMMANDS = new Set(['dev', 'prod']);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const legacyCommand = process.argv[2];
if (!legacyCommand || !ALLOWED_COMMANDS.has(legacyCommand)) {
  fail(
    `Unsupported legacy command "${legacyCommand ?? ''}". Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`,
  );
}

if (process.env[LEGACY_ACK_ENV] !== '1') {
  fail(
    [
      'Legacy archive command blocked by default.',
      `Set ${LEGACY_ACK_ENV}=1 to confirm you intentionally want to run legacy scripts.`,
      `Example: ${LEGACY_ACK_ENV}=1 npm run legacy:${legacyCommand === 'dev' ? 'dev' : 'build'}`,
    ].join('\n'),
  );
}

const result = spawnSync('npm', ['run', legacyCommand, '--prefix', 'legacy'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  fail(`Failed to execute npm: ${result.error.message}`);
}

process.exit(result.status ?? 1);
