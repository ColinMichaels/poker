# Review and QA Prompt Pack

Use these prompts to review agent output and keep quality high.

## Prompt A: Domain Correctness Review

```text
Review the poker-engine package for logic correctness.

Check:
- illegal state transitions
- incorrect betting round progression
- evaluator ranking/tiebreak errors
- side-pot handling gaps
- RNG determinism violations

Output format:
1) Findings ordered by severity
2) file + line references
3) minimal patch suggestions
4) tests that should be added
```

## Prompt B: Architecture Boundary Review

```text
Audit the codebase for architecture violations.

Flag any case where:
- Babylon/UI code contains game-rule logic
- server and client duplicate business rules inconsistently
- shared contracts drift from implementations
- ad-hoc global state/event buses bypass reducer flow

Provide concrete refactor plan with affected files.
```

## Prompt C: Asset Reuse Quality Review

```text
Review asset integration quality.

Validate:
- all card/chip/avatar/sound/logo references resolve
- naming normalization is consistent
- preload/lazy-load strategy is sensible
- missing or orphaned assets are reported

Return a markdown table with:
- asset type
- total expected
- total loaded
- missing
- invalid naming
```

## Prompt D: Test Coverage Gap Review

```text
Review test coverage adequacy for gameplay-critical paths.

Focus on:
- deck operations
- evaluator edge cases
- command reducer transitions
- showdown payouts and ties
- websocket command validation (if server exists)

Return:
- missing test scenarios
- risk level of each gap
- a prioritized test backlog
```

## Prompt E: Production Readiness and Security Review

```text
Perform security and operations review for production readiness.

Check:
- secrets handling and config hygiene
- auth/session assumptions
- input validation on all commands/routes
- logging and replay/audit capability
- error recovery/reconnect paths

Return:
- critical blockers
- recommended remediations
- release gate checklist
```

## Prompt F: PR Review Meta-Prompt

```text
Review this pull request as a principal engineer.

Instructions:
- prioritize correctness and regressions over style
- list findings first, ordered by severity
- include file and line references
- include missing tests
- include concrete next actions
- keep summary brief

If no major findings, explicitly state residual risks.
```

