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

Auth/session behavior:

- Passwords are stored as salted `scrypt` hashes.
- Session tokens are HMAC-signed and expire by ttl.

## HTTP API

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/audit?limit=100`
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

Bootstrap users file:

- Used when no persisted auth state is available.
- File can be either an array of user records or `{ "users": [...] }`.
- Example file: `modern/apps/server/bootstrap-users.example.json`
- Record fields:
  - required: `email` and one of `password` or `passwordHash`
  - `passwordHash` must be a salted `scrypt$<salt-hex>$<digest-hex>` value
  - optional: `id`, `firstName`, `lastName`, `walletBalance`, `wins`, `gamesPlayed`, `walletUpdatedAt`, `walletLedger`
