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

## Health + Readiness Checks

- `GET /health` (liveness)
- `GET /api/table/state` (authoritative table snapshot)

Auth/wallet sanity checks:

1. `POST /api/auth/login`
2. `GET /api/auth/session` with bearer token
3. `GET /api/wallet` with bearer token

## Deployment Notes

- Current auth/wallet service is intentionally in-memory MVP parity for migration continuity.
- For production hardening, replace in-memory auth/session/wallet data with persistent storage and real auth controls.
