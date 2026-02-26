# Poker Server MVP

This service is the PR B/PR C runtime for `modern/` (authoritative table + minimal auth/wallet parity).

## What It Does

- Owns one in-memory table state (`@poker/poker-engine`)
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
