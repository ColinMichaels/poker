# Developer Setup (Modern Workspace)

This setup is for the `modern/` npm workspace.

## Prerequisites

- `nvm` installed and loaded in your shell
- Node `22` LTS (see `modern/.nvmrc`)
- npm `10+`
- repository install uses engine enforcement (`.npmrc`: `engine-strict=true`)

## Quick Start

From repository root:

1. `nvm use` (or `nvm install && nvm use`) from repository root
2. `npm run doctor`
3. `cd modern`
4. `nvm use` (or `nvm install && nvm use`)
5. `npm install`
6. `npm run test:engine`
7. `npm run build:client`

## Common Commands

- `npm run dev:client` - start Vite client dev server
- `npm run dev:server` - start authoritative table server (watch mode)
- `npm run ci` - run full modern CI verification locally (typecheck/build/client browser + unit tests/engine/server tests)
- `npm run check:legacy-refs` - ensure runtime source stays independent from `legacy/` paths
- `npm run check:server-env-template` - verify server env template includes required keys
- `npm run typecheck` - run TypeScript checks in all workspaces
- `npm run test:client` - run client unit tests and browser-level UI checks
- `npm run test:browser-ui --workspace @poker/client` - run browser-level UI assertions against built client output (`apps/client/dist`)
- `npm run test:engine` - run poker-engine fixtures + reducer tests
- `npm run test:server` - run server lifecycle + auth/wallet parity tests
- `npm run generate:howto-content` - regenerate migrated legacy HowTo content
- `npm run generate:assets:normalize` - regenerate normalized asset pack + manifest
- `npm run firebase:prepare:hosting` - generate `.firebase.deploy.json` from `firebase.json` with optional backend overrides
- `npm run firebase:deploy:hosting` - build client and deploy hosting
- `npm run firebase:deploy:hosting:backend-target` - build client and deploy hosting with required backend rewrite target env

Root shortcut scripts are also available:

- `npm run dev` (modern client)
- `npm run doctor` (root environment check for modern workspace requirements)
- `npm run ci` (root doctor + modern full verification)
- `npm run build` (modern workspace build)
- `npm run test` (modern engine + server tests)

## Server Smoke Check

1. `npm run dev:server`
2. `curl http://127.0.0.1:8787/health`
3. `curl http://127.0.0.1:8787/api/table/state`

Server env template:

- `apps/server/.env.example`

## Auth/Wallet Smoke Check

1. Login:
   `curl -s -X POST http://127.0.0.1:8787/api/auth/login -H 'content-type: application/json' -d '{"email":"colin@example.com","password":"demo"}'`
2. Use returned `session.token` as bearer token.
3. Read wallet:
   `curl -s http://127.0.0.1:8787/api/wallet -H 'authorization: Bearer <TOKEN>'`
4. Adjust wallet:
   `curl -s -X PATCH http://127.0.0.1:8787/api/wallet -H 'authorization: Bearer <TOKEN>' -H 'content-type: application/json' -d '{"method":"add","amount":25,"reason":"smoke-check"}'`

If demo users are disabled (`POKER_AUTH_ALLOW_DEMO_USERS=0`), set `POKER_AUTH_BOOTSTRAP_USERS_FILE` to a valid JSON seed file first (see `apps/server/bootstrap-users.example.json`).

External auth smoke check (optional):

1. Enable external auth in env:
   `POKER_EXTERNAL_AUTH_ENABLED=1`, `POKER_EXTERNAL_AUTH_MODE=signed_assertion`, `POKER_EXTERNAL_AUTH_ISSUER=<issuer>`, `POKER_EXTERNAL_AUTH_SHARED_SECRET=<secret>`
   Optional rotation fallback:
   `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS=<old-secret>`
2. Create a signed assertion using `createExternalAuthAssertion` in `apps/server/src/external-auth.ts` (or any equivalent HMAC-SHA256 signer that matches the payload format).
3. Login with assertion:
   `curl -s -X POST http://127.0.0.1:8787/api/auth/external/login -H 'content-type: application/json' -d '{"assertion":"<ASSERTION>"}'`

Trusted-headers mode smoke check (for auth-proxy integration):

1. Set env:
   `POKER_EXTERNAL_AUTH_ENABLED=1`, `POKER_EXTERNAL_AUTH_MODE=trusted_headers`, `POKER_EXTERNAL_AUTH_ISSUER=<issuer>`, `POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET=<proxy-secret>`
2. Call login route with trusted headers:
   `curl -s -X POST http://127.0.0.1:8787/api/auth/external/login -H 'x-external-auth-proxy-secret: <proxy-secret>' -H 'x-external-auth-provider: <provider>' -H 'x-external-auth-subject: <subject>' -H 'x-external-auth-email: <email>'`

Firebase ID token mode smoke check:

1. Set env:
   `POKER_EXTERNAL_AUTH_ENABLED=1`, `POKER_EXTERNAL_AUTH_MODE=firebase_id_token`, `POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID=<firebase-project-id>`, `POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER=jwt`
2. Call login route with Firebase ID token:
   `curl -s -X POST http://127.0.0.1:8787/api/auth/external/login -H 'authorization: Bearer <FIREBASE_ID_TOKEN>'`

To use Firebase Admin SDK adapter instead of JWT verifier:

- set `POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER=admin_sdk`
- optionally set `POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json`
- ensure `firebase-admin` is installed for `@poker/server` (`npm install --workspace @poker/server firebase-admin`)

Client Firebase auth bridge setup (automatic `/api/auth/external/login` exchange):

1. Copy `apps/client/.env.example` to `apps/client/.env.local`.
2. Set Firebase web keys:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
3. Optional:
   `VITE_EXTERNAL_AUTH_MODE=firebase_id_token` (auto-detected when Firebase keys are present),
   `VITE_FIREBASE_AUTH_EMULATOR_URL`,
   `VITE_FIREBASE_AUTH_CUSTOM_TOKEN`,
   `VITE_API_BASE_URL` (only needed for non-proxied API setups).
4. Start `npm run dev:server` and `npm run dev:client`.
5. When Firebase auth has a signed-in user, the client automatically exchanges the Firebase ID token for a server session via `/api/auth/external/login`.

The Vite dev server proxies `/api` and `/health` to `http://127.0.0.1:8787` by default.

Firebase hosting starter config:

- `firebase.hosting.example.json` shows SPA hosting for `apps/client/dist` and `/api/**` rewrite to a Cloud Run backend.
- `firebase.json` is the active baseline config; `.firebaserc.example` provides project binding template.
- `FIREBASE_BACKEND_SERVICE_ID` and `FIREBASE_BACKEND_REGION` can override `/api/**` Cloud Run rewrite in generated deploy config.

## CI Parity

GitHub Actions workflow: `.github/workflows/modern-ci.yml`

CI runs the following from `modern/`:

1. `npm ci`
2. `npm run ci`

## Troubleshooting

### `EUNSUPPORTEDPROTOCOL workspace:*`

If you see:

- `Unsupported URL Type "workspace:": workspace:*`

Use the current workspace package references already defined in this repo (`file:../../packages/...`) and run installs from `modern/`, not from `modern/apps/*`.

### Wrong Node/npm binary

Check:

- `which node`
- `which npm`

They should point to `~/.nvm/versions/node/...`, not `/usr/local/bin` or `/opt/homebrew/bin`.

If they do not:

1. Ensure `nvm` is loaded in `~/.zshrc`
2. Open a new terminal
3. Run `nvm use`

If install still fails with engine constraints, run:

- `npm run doctor`

### DNS/network install failures

If npm cannot resolve `registry.npmjs.org` (`ENOTFOUND`), this is a network/DNS/proxy issue outside project config.

### Browser UI test skips or fails

- `test:browser-ui` requires a Chrome/Chromium binary plus built client output (`apps/client/dist/index.html`).
- If Chrome is not auto-detected, set:
  - `BROWSER_UI_CHROME_BIN=/absolute/path/to/chrome`
- In CI, `BROWSER_UI_REQUIRED=1` is enabled so missing browser binaries fail fast instead of skipping.
