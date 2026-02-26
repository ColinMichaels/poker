import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const sourcePath = path.resolve(workspaceRoot, 'firebase.json');
const outputRelativePath = process.env.FIREBASE_DEPLOY_CONFIG_PATH?.trim() || '.firebase.deploy.json';
const outputPath = path.resolve(workspaceRoot, outputRelativePath);

const requireBackendTarget = process.env.FIREBASE_REQUIRE_BACKEND_TARGET === '1';
const backendServiceId = process.env.FIREBASE_BACKEND_SERVICE_ID?.trim() || '';
const backendRegion = process.env.FIREBASE_BACKEND_REGION?.trim() || '';
const hostingSite = process.env.FIREBASE_HOSTING_SITE?.trim();

if (requireBackendTarget && (!backendServiceId || !backendRegion)) {
  console.error(
    'Missing backend target. Set FIREBASE_BACKEND_SERVICE_ID and FIREBASE_BACKEND_REGION when FIREBASE_REQUIRE_BACKEND_TARGET=1.',
  );
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing Firebase config: ${path.relative(workspaceRoot, sourcePath)}`);
  process.exit(1);
}

const rawConfig = fs.readFileSync(sourcePath, 'utf8');
let parsedConfig;
try {
  parsedConfig = JSON.parse(rawConfig);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to parse firebase.json: ${message}`);
  process.exit(1);
}

if (typeof parsedConfig !== 'object' || parsedConfig === null || Array.isArray(parsedConfig)) {
  console.error('firebase.json must contain an object root.');
  process.exit(1);
}

const config = parsedConfig;
const hosting = config.hosting;
if (!hosting || typeof hosting !== 'object' || Array.isArray(hosting)) {
  console.error('firebase.json is missing a valid hosting configuration object.');
  process.exit(1);
}

const rewrites = Array.isArray(hosting.rewrites) ? hosting.rewrites : [];
const apiRewrite = rewrites.find((rewrite) => {
  if (!rewrite || typeof rewrite !== 'object' || Array.isArray(rewrite)) {
    return false;
  }
  return rewrite.source === '/api/**' && rewrite.run && typeof rewrite.run === 'object' && !Array.isArray(rewrite.run);
});

if (!apiRewrite || !apiRewrite.run) {
  console.error('firebase.json hosting.rewrites must include /api/** Cloud Run rewrite.');
  process.exit(1);
}

if (backendServiceId) {
  apiRewrite.run.serviceId = backendServiceId;
}
if (backendRegion) {
  apiRewrite.run.region = backendRegion;
}

if (hostingSite) {
  hosting.site = hostingSite;
}

fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

const relativeOutputPath = path.relative(workspaceRoot, outputPath);
const effectiveServiceId = apiRewrite.run.serviceId ?? 'unset';
const effectiveRegion = apiRewrite.run.region ?? 'unset';
console.info(`Prepared Firebase deploy config: ${relativeOutputPath}`);
console.info(`API rewrite target: service=${effectiveServiceId} region=${effectiveRegion}`);
if (hostingSite) {
  console.info(`Hosting site override: ${hostingSite}`);
}
