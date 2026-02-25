# Reuse Mapping: Legacy -> New Architecture

## Domain Logic Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `app/Poker/Deck.php` | Port concept, rewrite implementation | `packages/poker-engine/src/deck/*` |
| `app/Poker/Game.php` | Port rules intent, rewrite state model | `packages/poker-engine/src/table/*` |
| `app/Poker/Player.php` | Port player/stack concepts, rewrite model | `packages/poker-engine/src/player/*` |
| `app/Poker/Chip.php` | Reuse denomination logic | `packages/poker-engine/src/chips/split.ts` |
| `resources/js/plugins/game/GamePlugin.js` (rank logic) | Use as reference oracle, rewrite typed evaluator | `packages/poker-engine/src/evaluator/*` |
| `resources/js/plugins/game/reference.vue` | Reference-only for draw/payout flow | test fixtures/docs |

## UI/Interaction Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `resources/js/components/Poker/Card.vue` | Reuse UX concept, rewrite for Babylon mesh/card sprite | `apps/client/src/scene/entities/CardEntity.ts` |
| `resources/js/components/Poker/Deck.vue` | Reuse flow concept (shuffle/flip/deal) | `apps/client/src/scene/entities/DeckEntity.ts` |
| `resources/js/components/Poker/Chip.vue` | Reuse interaction/audio patterns | `apps/client/src/scene/entities/ChipStackEntity.ts` |
| `resources/js/components/shared/Avatar*.vue` | Reuse selection UX + metadata | `apps/client/src/ui/lobby/AvatarSelector.tsx` |
| `resources/js/Pages/HowTo/*` | Reuse textual rules content | `apps/client/src/ui/help/*` |

## Asset Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `public/Poker/cards/*` | Reuse faces/backs; normalize filenames | `apps/client/public/assets/cards/*` |
| `public/Poker/chips/*` | Reuse directly | `apps/client/public/assets/chips/*` |
| `public/Poker/avatars/*` | Reuse with metadata cleanup | `apps/client/public/assets/avatars/*` |
| `public/Poker/sounds/*` | Reuse with category tagging | `apps/client/public/assets/sounds/*` |
| `public/Poker/logos/*` | Reuse directly | `apps/client/public/assets/logos/*` |

## Backend/API Mapping

| Legacy Source | Reuse Decision | New Target |
|---|---|---|
| `routes/web.php` poker routes | Replace with API + WS protocol | `apps/server/src/routes/*` + `ws/*` |
| `PlayerWalletController.php` | Re-specify wallet operations | `apps/server/src/modules/wallet/*` |
| `AppServiceProvider` shared auth payload | Replace with typed auth/session DTO | `packages/game-contracts/src/auth.ts` |

## Decommission Candidates (Do Not Port As-Is)

- Legacy PingCRM user-management scaffolding (`resources/js/Pages/Users/*`, `UsersController.php`) without schema alignment.
- PHP hand evaluator classes that rely on undefined card interfaces.
- Event-bus-only architecture from `GamePlugin.events`.

## Immediate Reuse Checklist

1. Copy `public/Poker` into new asset workspace and generate manifest.
2. Port chip denomination splitter with tests.
3. Build canonical card code list and name/suit helpers.
4. Use old `HowTo` content as markdown/JSON data source.
5. Keep original repo read-only for comparison and fixtures.

