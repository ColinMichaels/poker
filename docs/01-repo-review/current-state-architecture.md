# Current-State Architecture Review

## Stack Snapshot

- Backend: Laravel 6 (`laravel/framework:^6.0`) on PHP `^7.2`
- Frontend: Vue 2 + Inertia.js (`@inertiajs/inertia-vue:^0.1.x`)
- Build: Laravel Mix 5 + Tailwind 1 + Sass
- Runtime patterns: Server-side routing with Inertia pages, Vue plugin event buses for game/modal/audio
- Deployment traces: Elastic Beanstalk config targets PHP 7.3 on Amazon Linux

## Top-Level Structure

- `app/Poker/*`: poker domain classes (`Game`, `Deck`, `Card`, `Player`, `Chip`, `Hand`, `EvaluateHand`)
- `resources/js/plugins/game/*`: client-side game orchestration and hand ranking logic
- `resources/js/components/Poker/*`: card/chip/deck UI components
- `resources/js/Pages/HowTo/*`: rules/educational game-variant content
- `public/Poker/*`: reusable poker asset library (cards/chips/avatars/sounds/logos)
- `database/*`: user/player/game/menu schema + seeders

## Runtime Flow (Today)

1. Authenticated user lands on `/` -> `Dashboard/Index.vue`.
2. `GameComponent.vue` drives game interactions.
3. `GamePlugin.js` provides:
   - static deck array
   - event bus (`broadcast`/`listen`)
   - hand ranking function (`rankHand`)
4. Deck/Card/Chip UI components emit and listen to custom events.
5. Wallet updates optionally call `/wallet` endpoints.

## Domain Model Intent

The project clearly aimed to separate poker domain concepts:

- `Game`: table state, betting, dealing, round advancement
- `Deck`: 52-card construction + shuffle
- `Card` + `Suit`: identifiers and display properties
- `Player`: hand + wallet/chip behavior
- `Chip`: denomination splitting
- `EvaluateHand`: attempt at poker hand classification

This is the right conceptual direction and should be preserved in the rebuild, but with stricter boundaries and tests.

## Existing Functional Strengths

- Strong asset base for immediate visual/audio polish.
- Hand-ranking bitmath exists in JavaScript and can seed the new engine implementation.
- Poker-variant explanatory content exists and can be reused for onboarding/help screens.
- UI already demonstrates card flip animation, deck shuffle, avatar selection, chips interaction.

## Architectural Weaknesses

- Domain classes inherit from `Game` in places where composition should be used (`Card`, `Hand`).
- Mixed responsibilities across backend and frontend (duplicate deck/hand logic).
- Event-bus state management leads to hidden coupling.
- Incomplete/inconsistent API/resource/controller layer for production play.
- Outdated framework/dependency base and legacy PingCRM scaffolding leftovers.

