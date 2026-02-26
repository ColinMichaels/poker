import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const envTemplatePath = path.resolve(repoRoot, 'apps/server/.env.example');

const requiredKeys = [
  'NODE_ENV',
  'HOST',
  'PORT',
  'TABLE_ID',
  'POKER_STATE_PERSIST',
  'POKER_STATE_FILE',
  'POKER_AUTH_TOKEN_SECRET',
  'POKER_SESSION_TTL_MS',
  'POKER_EXTERNAL_AUTH_ENABLED',
  'POKER_EXTERNAL_AUTH_MODE',
  'POKER_EXTERNAL_AUTH_ISSUER',
  'POKER_EXTERNAL_AUTH_SHARED_SECRET',
  'POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS',
  'POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET',
  'POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID',
  'POKER_EXTERNAL_AUTH_FIREBASE_AUDIENCE',
  'POKER_EXTERNAL_AUTH_FIREBASE_ISSUER',
  'POKER_EXTERNAL_AUTH_FIREBASE_CERTS_URL',
  'POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER',
  'POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE',
  'POKER_AUTH_ALLOW_DEMO_USERS',
  'POKER_AUTH_BOOTSTRAP_USERS_FILE',
  'POKER_ENABLE_LEGACY_WALLET_ROUTES',
];

if (!fs.existsSync(envTemplatePath)) {
  console.error(`Missing env template: ${path.relative(repoRoot, envTemplatePath)}`);
  process.exit(1);
}

const lines = fs.readFileSync(envTemplatePath, 'utf8').split('\n');
const declaredKeys = new Set();

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    continue;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) {
    continue;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  if (key.length > 0) {
    declaredKeys.add(key);
  }
}

const missing = requiredKeys.filter((key) => !declaredKeys.has(key));
if (missing.length > 0) {
  console.error('Server env template is missing required keys:');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.info('Server env template check passed.');
