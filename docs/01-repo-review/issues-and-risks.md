# Issues and Risks (Repository Review)

Severity reflects migration impact and production risk.

## Critical

1. Secrets committed in repository
- `.env.staging` includes application/database/mail/API credentials.
- Risk: credential compromise and account takeover.
- Action: rotate all secrets immediately and purge secret history.

2. Incomplete/incorrect poker evaluator implementation in PHP domain
- `app/Poker/EvaluateHand.php` expects methods like `getRank()` not implemented in `app/Poker/Card.php`.
- `app/Poker/Hand.php` also depends on missing card methods.
- Risk: backend hand scoring is nonfunctional.

3. Invalid model source file
- `app/Menu.php` contains invalid PHP method syntax.
- Risk: fatal parse errors when class autoloads.

## High

1. Inheritance misuse in core domain
- `app/Poker/Card.php` and `app/Poker/Hand.php` extend `Game`.
- Risk: side effects, hidden state coupling, hard-to-test behavior.

2. Frontend deck data defects
- `resources/js/plugins/game/GamePlugin.js` has incorrect Diamond high-card mappings (`AD/QD/KD` ranks swapped).
- Risk: incorrect hand evaluation and gameplay decisions.

3. API/controller contract inconsistencies
- `app/Http/Controllers/UsersController.php` references fields/relations not in schema (e.g., `name`, `owner`, `account`).
- `app/Http/Controllers/PlayerWalletController.php` references `User` without import in `show`.
- `app/Http/Controllers/PlayerController.php` calls `request()->validated()` without a FormRequest.
- Risk: runtime failures and broken CRUD flows.

4. Authentication/profile assumptions with nullable player relation
- `app/Providers/AppServiceProvider.php` assumes `Auth::user()->player()` always exists.
- Risk: null errors during page bootstrap.

## Medium

1. Legacy framework/dependency age
- Laravel 6, Vue 2, early Inertia packages, Laravel Mix 5.
- Risk: security/maintenance burden and difficult upgrades.

2. Event-bus heavy client architecture
- Game state spread across UI components and plugin events.
- Risk: non-deterministic behavior and regression-prone changes.

3. Deployment hardening issues
- Elastic Beanstalk config includes permissive `chmod 777` container commands.
- Risk: unnecessary filesystem exposure.

4. Route/UI mismatches from scaffold leftovers
- Some pages/routes appear inherited from PingCRM template and may not align with current schema.
- Risk: dead code and confusion during migration.

## Low

1. Naming and content polish debt
- Typoed asset names (`traditiona-japanese-man.svg`), mixed naming conventions.
- Risk: integration friction, not blocker.

2. Sparse automated tests around active game flow
- PHPSpec exists but limited and not integrated into a current CI path.
- Risk: low confidence refactors.

## Migration Implication

Because engine correctness is central to poker, the safest path is:

1. Re-specify domain rules as pure typed modules.
2. Port only validated logic + assets.
3. Treat current implementation as reference material, not direct drop-in code.

