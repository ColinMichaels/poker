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
- `POKER_AUTH_TOKEN_SECRET` (HMAC signing secret for bearer sessions)
- `POKER_SESSION_TTL_MS` (session ttl in milliseconds, default `28800000`)

Runtime persistence:

- Enabled by default.
- Persists table/auth state after mutating requests.
- Default file: `modern/apps/server/.data/runtime-state.json`

Auth/session behavior:

- Passwords are stored as salted `scrypt` hashes.
- Session tokens are HMAC-signed and expire by ttl.

## HTTP API

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
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

Demo login users:

- `colin@example.com` / `demo`
- `luna@example.com` / `demo`
