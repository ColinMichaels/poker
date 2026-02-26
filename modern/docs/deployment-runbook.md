# Modern Deployment Runbook (MVP)

This runbook describes the current modern runtime entrypoints for staging/production-style execution.

## Runtime Components

- `@poker/client` (static Vite build output)
- `@poker/server` (Node.js authoritative table + auth/wallet API)

## Build

From `modern/`:

1. `npm ci`
2. `npm run ci`

## Start Server

From `modern/` after build:

- `npm run start --workspace @poker/server`

Environment variables:

- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `8787`)
- `TABLE_ID` (default: `table-1`)
- `POKER_STATE_PERSIST` (`1`/`0`, default: `1`)
- `POKER_STATE_FILE` (default: `apps/server/.data/runtime-state.json`)
- `POKER_AUTH_TOKEN_SECRET` (required for non-dev deployments; signs bearer session tokens)
- `POKER_SESSION_TTL_MS` (default: `28800000`)
- `POKER_EXTERNAL_AUTH_ENABLED` (`1`/`0`, default: `0`)
- `POKER_EXTERNAL_AUTH_ISSUER` (expected issuer for signed assertion exchange, default: `external-idp`)
- `POKER_EXTERNAL_AUTH_SHARED_SECRET` (required when external auth is enabled)
- `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS` (optional previous verification secret during rotation)
- `POKER_AUTH_ALLOW_DEMO_USERS` (`1`/`0`, default: `0` when `NODE_ENV=production`)
- `POKER_AUTH_BOOTSTRAP_USERS_FILE` (JSON seed file used when no persisted auth state exists)
- `POKER_ENABLE_LEGACY_WALLET_ROUTES` (`1`/`0`, default: `0` when `NODE_ENV=production`)

Template reference:

- `apps/server/.env.example`

## Health + Readiness Checks

- `GET /health` (liveness)
  - includes runtime flags for persistence/demo-users/legacy-wallet-route/external-auth modes, including external auth rotation fallback status
- `GET /api/table/state` (authoritative table snapshot)

Auth/wallet sanity checks:

1. `POST /api/auth/login`
2. `GET /api/auth/session` with bearer token
3. `GET /api/wallet` with bearer token
4. `GET /api/auth/audit?limit=20` with bearer token

## Deployment Notes

- Current runtime persists table/auth/wallet state to local JSON for restart continuity.
- Server handles `SIGINT`/`SIGTERM` with graceful shutdown and attempts final runtime-state persistence before exit.
- Current auth/session uses signed, expiring bearer tokens and salted scrypt password hashes.
- Server startup fails in `NODE_ENV=production` when `POKER_AUTH_TOKEN_SECRET` is missing.
- In production (`NODE_ENV=production`), demo users are disabled by default. Set `POKER_AUTH_BOOTSTRAP_USERS_FILE` for first boot or explicitly set `POKER_AUTH_ALLOW_DEMO_USERS=1` for temporary environments.
- In production (`NODE_ENV=production`), legacy wallet compatibility routes are disabled by default. Use `POKER_ENABLE_LEGACY_WALLET_ROUTES=1` only for temporary migration compatibility windows.
- If production overrides enable demo users or legacy wallet routes, server startup logs explicit warnings.
- Bootstrap file format accepts either a JSON array of user records or `{ "users": [...] }`. Each user requires `email` and `password` (or `passwordHash` in `scrypt$<salt-hex>$<digest-hex>` format).
- Current auth API supports session revocation (`/api/auth/revoke-others`) and per-user audit logs.
- External identity login is available via `POST /api/auth/external/login` (signed assertion exchange).
- External auth secret rotation can be performed without downtime:
1. Deploy with new key at `POKER_EXTERNAL_AUTH_SHARED_SECRET` and old key at `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS`.
2. Rotate the identity provider signer to the new key.
3. Remove `POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS` after old assertions expire.
