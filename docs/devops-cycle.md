# Repository DevOps cycle

Canonical working cycle:

    Issue -> branch -> local QA -> PR -> hosted QA -> exact-head merge -> remote-main readback

This repository is project-owned infrastructure. Changes should remain small, reviewable, reproducible, and easy to revert.

## Required flow

1. **Issue first**
   - Open or reuse one narrow issue before new implementation lines, durable architecture decisions, routing changes, or cross-cutting repository work.
   - Record motivation/evidence, intended invariant, acceptance criteria, and final disposition.

2. **Fresh branch**
   - Start from current origin/main.
   - Use one branch for the issue scope.
   - Avoid direct feature work on main.

3. **Tests before behavior changes**
   - For new behavior or bug fixes, reproduce RED first.
   - Documentation-only changes do not need artificial tests, but repository contracts do.

4. **Deterministic local QA**
   - Run tools/dev/check.
   - Do not replace an existing repository gate with an ad-hoc command unless the gate is demonstrably insufficient.

5. **Pull request**
   - Link the covering issue.
   - Keep scope unchanged.
   - Record the exact head SHA.

6. **Hosted QA**
   - Hosted CI must run the same tools/dev/check gate.
   - Do not merge while required hosted checks are pending or failing.

7. **Promotion**
   - Re-check the PR head and current base before merge.
   - Merge only the exact tested head.

8. **Readback**
   - Fetch origin/main after merge.
   - Verify the intended files/postconditions exist on the canonical branch.
   - Record the final receipt in the covering issue when useful.

## Secret and publication discipline

This is a public repository.

Never commit:

- Timeweb Cloud API tokens;
- Timeweb AI Gateway API keys;
- Arcade secrets or gateway credentials;
- OAuth signing/connection secrets;
- account-specific inventory or billing receipts that are not intentionally public;
- generated credential artifacts.

Before publishing previously private history, inspect the complete reachable Git history for obvious secret patterns.

## Runtime boundaries

A file, credential, or successful capability in one runtime does not imply availability or authority in another.

When an artifact must cross runtimes, prefer a native file/reference bridge. If both sides have authorized Google Drive access, use Drive instead of model-visible base64 chunking, and verify size/hash after transfer.

## Current compliance status

| Control | Status | Evidence |
| --- | --- | --- |
| Public repository | VERIFIED | Visibility readback is PUBLIC |
| Full-history publication preflight | VERIFIED | One-commit history scanned before publication |
| Issue-first | VERIFIED | Bootstrap tracked in issue #2 |
| Branch-per-change | VERIFIED | Bootstrap work uses issue-2-public-docs-devops |
| Deterministic local gate | PROVIDED | tools/dev/check |
| Hosted CI | PROVIDED | .github/workflows/ci.yml runs the same gate |
| Secret-pattern guard | PROVIDED | scripts/verify_repo.py |
| Exact-head/base promotion | PROCEDURAL | Verified before merge by operator workflow |
| Remote-main readback | REQUIRED | Performed after promotion |
| Branch protection / rulesets | NOT CONFIGURED | GitHub reports no rulesets and unprotected main |

Branch protection is intentionally not changed by this bootstrap. It is an explicit authority decision and requires separate authorization.
