# Developer Setup (Modern Workspace)

This setup is for the `modern/` npm workspace.

## Prerequisites

- `nvm` installed and loaded in your shell
- Node `22` LTS (see `modern/.nvmrc`)
- npm `10+`

## Quick Start

From repository root:

1. `cd modern`
2. `nvm use` (or `nvm install && nvm use`)
3. `npm install`
4. `npm run test:engine`
5. `npm run build:client`

## Common Commands

- `npm run dev:client` - start Vite client dev server
- `npm run dev:server` - start authoritative table server (watch mode)
- `npm run typecheck` - run TypeScript checks in all workspaces
- `npm run test:engine` - run poker-engine fixtures + reducer tests
- `npm run test:server` - run server lifecycle + auth/wallet parity tests
- `npm run generate:howto-content` - regenerate migrated legacy HowTo content
- `npm run generate:assets:normalize` - regenerate normalized asset pack + manifest

Root shortcut scripts are also available:

- `npm run dev` (modern client)
- `npm run build` (modern workspace build)
- `npm run test` (modern engine + server tests)

## Server Smoke Check

1. `npm run dev:server`
2. `curl http://127.0.0.1:8787/health`
3. `curl http://127.0.0.1:8787/api/table/state`

## Auth/Wallet Smoke Check

1. Login:
   `curl -s -X POST http://127.0.0.1:8787/api/auth/login -H 'content-type: application/json' -d '{"email":"colin@example.com","password":"demo"}'`
2. Use returned `session.token` as bearer token.
3. Read wallet:
   `curl -s http://127.0.0.1:8787/api/wallet -H 'authorization: Bearer <TOKEN>'`
4. Adjust wallet:
   `curl -s -X PATCH http://127.0.0.1:8787/api/wallet -H 'authorization: Bearer <TOKEN>' -H 'content-type: application/json' -d '{"method":"add","amount":25,"reason":"smoke-check"}'`

If demo users are disabled (`POKER_AUTH_ALLOW_DEMO_USERS=0`), set `POKER_AUTH_BOOTSTRAP_USERS_FILE` to a valid JSON seed file first (see `apps/server/bootstrap-users.example.json`).

## CI Parity

GitHub Actions workflow: `.github/workflows/modern-ci.yml`

CI runs the following from `modern/`:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test:engine`
5. `npm run test:server`

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

### DNS/network install failures

If npm cannot resolve `registry.npmjs.org` (`ENOTFOUND`), this is a network/DNS/proxy issue outside project config.
