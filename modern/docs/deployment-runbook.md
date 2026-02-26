# Modern Deployment Runbook (MVP)

This runbook describes the current modern runtime entrypoints for staging/production-style execution.

## Runtime Components

- `@poker/client` (static Vite build output)
- `@poker/server` (Node.js authoritative table + auth/wallet API)

## Build

From `modern/`:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test:engine`
5. `npm run test:server`

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
- `POKER_AUTH_ALLOW_DEMO_USERS` (`1`/`0`, default: `0` when `NODE_ENV=production`)
- `POKER_AUTH_BOOTSTRAP_USERS_FILE` (JSON seed file used when no persisted auth state exists)

## Health + Readiness Checks

- `GET /health` (liveness)
- `GET /api/table/state` (authoritative table snapshot)

Auth/wallet sanity checks:

1. `POST /api/auth/login`
2. `GET /api/auth/session` with bearer token
3. `GET /api/wallet` with bearer token
4. `GET /api/auth/audit?limit=20` with bearer token

## Deployment Notes

- Current runtime persists table/auth/wallet state to local JSON for restart continuity.
- Current auth/session uses signed, expiring bearer tokens and salted scrypt password hashes.
- In production (`NODE_ENV=production`), demo users are disabled by default. Set `POKER_AUTH_BOOTSTRAP_USERS_FILE` for first boot or explicitly set `POKER_AUTH_ALLOW_DEMO_USERS=1` for temporary environments.
- Bootstrap file format accepts either a JSON array of user records or `{ "users": [...] }`. Each user requires `email` and `password` (or `passwordHash`).
- Current auth API supports session revocation (`/api/auth/revoke-others`) and per-user audit logs.
- Remaining production hardening: external identity provider, secret management/rotation, and role-based audit governance.
