# Legacy Laravel/Vue2 Archive

This directory contains the archived pre-modernization codebase.

It is preserved for reference, rollback analysis, and historical diffs while `modern/` is the active default runtime.

## Contents

- Laravel backend app (`app/`, `routes/`, `config/`, `bootstrap/`, etc.)
- Legacy frontend sources (`resources/`) and static assets (`public/`)
- Legacy npm/composer entrypoints and config files

## Running Legacy App (Reference)

Node frontend build commands run from `legacy/`:

- `npm install`
- `npm run dev`
- `npm run prod`

Root shortcut wrappers:

- `npm run legacy:dev`
- `npm run legacy:build`

PHP/composer runtime remains legacy and is intentionally not part of the modern default flow.
