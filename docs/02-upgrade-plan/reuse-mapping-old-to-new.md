# Reuse Mapping: Legacy -> New Architecture

## Domain Logic Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `legacy/app/Poker/Deck.php` | Port concept, rewrite implementation | `packages/poker-engine/src/deck/*` |
| `legacy/app/Poker/Game.php` | Port rules intent, rewrite state model | `packages/poker-engine/src/table/*` |
| `legacy/app/Poker/Player.php` | Port player/stack concepts, rewrite model | `packages/poker-engine/src/player/*` |
| `legacy/app/Poker/Chip.php` | Reuse denomination logic | `packages/poker-engine/src/chips/split.ts` |
| `legacy/resources/js/plugins/game/GamePlugin.js` (rank logic) | Use as reference oracle, rewrite typed evaluator | `packages/poker-engine/src/evaluator/*` |
| `legacy/resources/js/plugins/game/reference.vue` | Reference-only for draw/payout flow | test fixtures/docs |

## UI/Interaction Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `legacy/resources/js/components/Poker/Card.vue` | Reuse UX concept, rewrite for Babylon mesh/card sprite | `apps/client/src/scene/entities/CardEntity.ts` |
| `legacy/resources/js/components/Poker/Deck.vue` | Reuse flow concept (shuffle/flip/deal) | `apps/client/src/scene/entities/DeckEntity.ts` |
| `legacy/resources/js/components/Poker/Chip.vue` | Reuse interaction/audio patterns | `apps/client/src/scene/entities/ChipStackEntity.ts` |
| `legacy/resources/js/components/shared/Avatar*.vue` | Reuse selection UX + metadata | `apps/client/src/ui/lobby/AvatarSelector.tsx` |
| `legacy/resources/js/Pages/HowTo/*` | Reuse textual rules content | `apps/client/src/ui/help/*` |

## Asset Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `legacy/public/Poker/cards/*` | Reuse faces/backs; normalize filenames | `apps/client/public/assets/cards/*` |
| `legacy/public/Poker/chips/*` | Reuse directly | `apps/client/public/assets/chips/*` |
| `legacy/public/Poker/avatars/*` | Reuse with metadata cleanup | `apps/client/public/assets/avatars/*` |
| `legacy/public/Poker/sounds/*` | Reuse with category tagging | `apps/client/public/assets/sounds/*` |
| `legacy/public/Poker/logos/*` | Reuse directly | `apps/client/public/assets/logos/*` |

## Backend/API Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `legacy/routes/web.php` poker routes | Replace with API + WS protocol | `apps/server/src/routes/*` + `ws/*` |
| `legacy/app/Http/Controllers/PlayerWalletController.php` | Re-specify wallet operations | `apps/server/src/modules/wallet/*` |
| `legacy/app/Providers/AppServiceProvider.php` shared auth payload | Replace with typed auth/session DTO | `packages/game-contracts/src/auth.ts` |

## Decommission Candidates (Do Not Port As-Is)

- Legacy PingCRM user-management scaffolding (`legacy/resources/js/Pages/Users/*`, `legacy/app/Http/Controllers/UsersController.php`) without schema alignment.
- PHP hand evaluator classes that rely on undefined card interfaces.
- Event-bus-only architecture from `GamePlugin.events`.

## Immediate Reuse Checklist

1. Copy `legacy/public/Poker` into new asset workspace and generate manifest.
2. Port chip denomination splitter with tests.
3. Build canonical card code list and name/suit helpers.
4. Use old `HowTo` content as markdown/JSON data source.
5. Keep original repo read-only for comparison and fixtures.
