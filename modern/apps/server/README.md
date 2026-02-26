# Poker Server MVP

This service is the PR B/PR C runtime for `modern/` (authoritative table + minimal auth/wallet parity).

## What It Does

- Owns one authoritative table state (`@poker/poker-engine`) with file-backed persistence
- Applies only validated `TableCommand` inputs
- Records command/event logs with sequence numbers
- Stores per-hand snapshots and replay history
- Replays a hand from start snapshot + command stream for deterministic verification

## Run

From `modern/`:

- `npm run dev:server` (watch mode)
- `npm run build:server`
- `npm run test:server`

Server defaults:

- host: `127.0.0.1`
- port: `8787`
- table id: `table-1`

Environment overrides:

- `HOST`
- `PORT`
- `TABLE_ID`
- `POKER_STATE_PERSIST` (`1`/`0`, default `1`)
- `POKER_STATE_FILE` (absolute path to JSON runtime state file)
- `POKER_AUTH_TOKEN_SECRET` (HMAC signing secret for bearer sessions; required when `NODE_ENV=production`)
- `POKER_SESSION_TTL_MS` (session ttl in milliseconds, default `28800000`)
- `POKER_EXTERNAL_AUTH_ENABLED` (`1`/`0`, default `0`)
- `POKER_EXTERNAL_AUTH_MODE` (`signed_assertion`, `trusted_headers`, or `firebase_id_token`, default `signed_assertion`)
- `POKER_EXTERNAL_AUTH_ISSUER` (expected issuer for signed assertions, default `external-idp`)
- `POKER_EXTERNAL_AUTH_SHARED_SECRET` (HMAC verification secret for signed assertions; required when external auth is enabled)
- `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS` (optional previous verification secret for key rotation)
- `POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET` (required in `trusted_headers` mode; shared secret expected in `x-external-auth-proxy-secret`)
- `POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID` (required in `firebase_id_token` mode)
- `POKER_EXTERNAL_AUTH_FIREBASE_AUDIENCE` (optional Firebase audience override; defaults to project id)
- `POKER_EXTERNAL_AUTH_FIREBASE_ISSUER` (optional Firebase issuer override; defaults to `https://securetoken.google.com/<projectId>`)
- `POKER_EXTERNAL_AUTH_FIREBASE_CERTS_URL` (optional Firebase signing cert endpoint override)
- `POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER` (`jwt` or `admin_sdk`, default `jwt`)
- `POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE` (optional service-account JSON path for `admin_sdk` verifier)
- `POKER_AUTH_ALLOW_DEMO_USERS` (`1`/`0`, default `1` unless `NODE_ENV=production`)
- `POKER_AUTH_BOOTSTRAP_USERS_FILE` (path to JSON file with bootstrap auth users)
- `POKER_ENABLE_LEGACY_WALLET_ROUTES` (`1`/`0`, default `1` unless `NODE_ENV=production`)

Environment template:

- `modern/apps/server/.env.example`

Runtime persistence:

- Enabled by default.
- Persists table/auth state after mutating requests.
- Default file: `modern/apps/server/.data/runtime-state.json`
- `/health` includes runtime mode flags:
  - `runtime.persistenceEnabled`
  - `runtime.authDemoUsersEnabled`
  - `runtime.legacyWalletRoutesEnabled`
  - `runtime.externalAuthEnabled`
- `runtime.externalAuthMode`
- `runtime.externalAuthIssuer`
- `runtime.externalAuthFirebaseProjectId`
- `runtime.externalAuthFirebaseIssuer`
- `runtime.externalAuthFirebaseVerifier`
  - `runtime.externalAuthSecretRotationEnabled`

Auth/session behavior:

- Passwords are stored as salted `scrypt` hashes.
- Session tokens are HMAC-signed and expire by ttl.
- User profiles include a role (`PLAYER`, `OPERATOR`, or `ADMIN`).

## HTTP API

- `POST /api/auth/login`
- `POST /api/auth/external/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/audit?limit=100&userId=<id>`
- `POST /api/auth/revoke-others`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/wallet`
- `PATCH /api/wallet`
- `GET /api/wallet/ledger?limit=50`
- `GET /health`
- `GET /api/table/state`
- `POST /api/table/command`
- `GET /api/table/logs/commands?limit=100`
- `GET /api/table/logs/events?limit=200`
- `GET /api/table/hands`
- `GET /api/table/hands/:handId`
- `GET /api/table/hands/:handId/replay`

Legacy compatibility wallet routes:

- `GET /wallet`
- `PATCH /wallet/:id`

`POST /api/table/command` accepts either:

- `{ "command": { ...TableCommand } }`
- `{ ...TableCommand }`

Default demo login users (when enabled):

- `colin@example.com` / `demo`
- `luna@example.com` / `demo`

External auth login:

- `signed_assertion` mode (`POKER_EXTERNAL_AUTH_MODE=signed_assertion`):
  - send payload to `POST /api/auth/external/login`:
    - `{ "assertion": "<base64url(payload)>.<base64url(hmac-signature)>" }`
  - assertion payload fields:
    - required: `iss`, `sub`, `email`, `exp`
    - optional: `firstName`, `lastName`, `role`
  - server verifies:
    - HMAC signature with `POKER_EXTERNAL_AUTH_SHARED_SECRET` (or `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS` during rotation)
    - issuer match with `POKER_EXTERNAL_AUTH_ISSUER`
    - expiration (`exp`) against current server time

- `trusted_headers` mode (`POKER_EXTERNAL_AUTH_MODE=trusted_headers`):
  - request must include:
    - `x-external-auth-proxy-secret` (must match `POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET`)
    - `x-external-auth-provider`
    - `x-external-auth-subject`
    - `x-external-auth-email`
  - optional:
    - `x-external-auth-first-name`
    - `x-external-auth-last-name`
    - `x-external-auth-role` (`PLAYER`/`OPERATOR`/`ADMIN`)
    - `x-external-auth-issuer` (must match `POKER_EXTERNAL_AUTH_ISSUER` when provided)

- `firebase_id_token` mode (`POKER_EXTERNAL_AUTH_MODE=firebase_id_token`):
  - request must include Firebase ID token in `Authorization: Bearer <ID_TOKEN>` or `x-firebase-id-token`
  - required env: `POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID`
  - verifier selection:
    - `POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER=jwt` (default lightweight verifier)
    - `POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER=admin_sdk` (uses Firebase Admin SDK runtime adapter)
  - optional Admin SDK credential path:
    - `POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json`
  - if `POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER=admin_sdk`, install Firebase Admin SDK in server workspace:
    - `npm install --workspace @poker/server firebase-admin`
  - token verification enforces:
    - RS256 signature against Firebase certs
    - issuer/audience/sub/exp/iat constraints
    - email claim presence (used for local user mapping)

- On success, server links/reuses user identity and returns the same session shape as `/api/auth/login`.

External auth secret rotation:

1. Deploy server with new active secret in `POKER_EXTERNAL_AUTH_SHARED_SECRET` and old secret in `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS`.
2. Update external identity signer to issue assertions with the new active secret.
3. After rollout, remove `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS`.

Bootstrap users file:

- Used when no persisted auth state is available.
- File can be either an array of user records or `{ "users": [...] }`.
- Example file: `modern/apps/server/bootstrap-users.example.json`
- Record fields:
  - required: `email` and one of `password` or `passwordHash`
  - `passwordHash` must be a salted `scrypt$<salt-hex>$<digest-hex>` value
  - optional: `id`, `firstName`, `lastName`, `role`, `walletBalance`, `wins`, `gamesPlayed`, `walletUpdatedAt`, `walletLedger`
  - when provided, `role` must be one of `PLAYER`, `OPERATOR`, or `ADMIN`

Auth audit authorization:

- `PLAYER` sessions can only read their own auth-audit records.
- `OPERATOR` and `ADMIN` sessions can read cross-user records (`userId`) or all records (no `userId` filter).

Firebase hosting starter template:

- `modern/firebase.hosting.example.json` provides a baseline SPA hosting config with `/api/**` rewrite to a Cloud Run service.
