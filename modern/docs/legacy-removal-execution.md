# Legacy Removal Execution Runbook

Purpose: execute final legacy code removal from the default branch with controlled risk and a rollback path.

## Preconditions

Before removing `legacy/`, all items below must be true:

1. Modern CI is green on `main` for at least one sprint.
2. Modern deployment/runtime is the active default in staging and production.
3. `npm run ci` passes from repository root.
4. `npm run check:legacy-refs --prefix modern` passes.
5. No open approved emergency PRs labeled `allow-legacy-change`.
6. Rollback owner and archive location are explicitly assigned.

## Pre-Removal Snapshot

1. Create a signed tag for the final state that still contains `legacy/`.
2. Confirm backup archive location:
   - separate archive branch, or
   - external archival repository snapshot.
3. Record exact commit SHA and tag in release notes.

## Removal Change Steps

Execute on a dedicated PR:

1. Remove `legacy/` directory from default branch.
2. Remove root legacy script wrappers from `package.json`:
   - `legacy:dev`
   - `legacy:build`
3. Remove legacy-archive guard workflow:
   - `.github/workflows/legacy-archive-guard.yml`
4. Update docs that reference `legacy/` as present in-repo:
   - `readme.md`
   - `modern/docs/legacy-decommission-plan.md`
   - `legacy` references in runbooks/readmes where needed
5. Keep archive retrieval instructions in docs (branch/tag/repo location).

## Verification Checklist

After changes, confirm:

1. `npm run ci` passes from root.
2. Modern deployment still boots and serves expected endpoints.
3. No broken links remain to removed `legacy/` paths in active docs.
4. Release notes include archive retrieval instructions.

## Rollback

If rollback is required:

1. Revert the removal PR cleanly.
2. Redeploy previous release artifact.
3. Open incident task with root cause and updated removal blockers.

Do not reintroduce partial legacy files manually; always restore from the tagged snapshot.
