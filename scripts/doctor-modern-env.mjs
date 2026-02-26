import { spawnSync } from 'node:child_process';

const MIN_NODE_MAJOR = 22;
const MAX_NODE_MAJOR = 24;
const MIN_NPM_MAJOR = 10;

function parseMajor(versionText) {
  const trimmed = versionText.trim().replace(/^v/, '');
  const majorText = trimmed.split('.')[0];
  const major = Number.parseInt(majorText, 10);
  return Number.isInteger(major) ? major : null;
}

function readNpmVersion() {
  const result = spawnSync('npm', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new Error(`Unable to execute npm: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderrText = result.stderr?.trim() ?? '';
    throw new Error(`npm --version failed: ${stderrText || `exit ${result.status}`}`);
  }

  return result.stdout.trim();
}

const nodeVersion = process.version;
const nodeMajor = parseMajor(nodeVersion);
const npmVersion = readNpmVersion();
const npmMajor = parseMajor(npmVersion);
const usingNvmPath = process.execPath.includes('/.nvm/versions/node/');

let failed = false;
const messages = [];

if (nodeMajor === null || nodeMajor < MIN_NODE_MAJOR || nodeMajor > MAX_NODE_MAJOR) {
  failed = true;
  messages.push(
    `Node ${nodeVersion} is unsupported. Required range: >=${MIN_NODE_MAJOR} <${MAX_NODE_MAJOR + 1}.`,
  );
}

if (npmMajor === null || npmMajor < MIN_NPM_MAJOR) {
  failed = true;
  messages.push(`npm ${npmVersion} is unsupported. Required major: >=${MIN_NPM_MAJOR}.`);
}

if (!usingNvmPath) {
  messages.push(
    `Warning: node binary is not from nvm (${process.execPath}). If workspace installs fail, run "nvm use".`,
  );
}

console.info(`Node: ${nodeVersion}`);
console.info(`npm: ${npmVersion}`);
console.info(`execPath: ${process.execPath}`);

for (const message of messages) {
  if (message.startsWith('Warning:')) {
    console.warn(message);
  } else {
    console.error(message);
  }
}

if (failed) {
  console.error('Environment check failed. Run "nvm install && nvm use" and retry.');
  process.exit(1);
}

console.info('Environment check passed for modern workspace requirements.');
