# Poker Repository Modernization Docs

This documentation set audits the current repository, extracts reusable poker logic/assets, and defines a modern rebuild path centered on Babylon.js.

## Reading Order

1. [`01-repo-review/current-state-architecture.md`](./01-repo-review/current-state-architecture.md)
2. [`01-repo-review/poker-logic-extraction.md`](./01-repo-review/poker-logic-extraction.md)
3. [`01-repo-review/asset-inventory-and-reuse.md`](./01-repo-review/asset-inventory-and-reuse.md)
4. [`01-repo-review/issues-and-risks.md`](./01-repo-review/issues-and-risks.md)
5. [`02-upgrade-plan/target-architecture-babylon.md`](./02-upgrade-plan/target-architecture-babylon.md)
6. [`02-upgrade-plan/phased-migration-roadmap.md`](./02-upgrade-plan/phased-migration-roadmap.md)
7. [`02-upgrade-plan/reuse-mapping-old-to-new.md`](./02-upgrade-plan/reuse-mapping-old-to-new.md)
8. [`03-llm-agent-prompts/agent-charter.md`](./03-llm-agent-prompts/agent-charter.md)
9. [`03-llm-agent-prompts/build-prompts-by-phase.md`](./03-llm-agent-prompts/build-prompts-by-phase.md)
10. [`03-llm-agent-prompts/review-and-qa-prompts.md`](./03-llm-agent-prompts/review-and-qa-prompts.md)

## Goal

Use this repository as source material to build a modern poker game platform with:

- Babylon.js-based game presentation
- A clean, testable poker domain engine
- Reuse of existing cards/chips/avatars/sounds/logos and educational poker content
- Clear LLM-agent prompt workflows for implementation and review
