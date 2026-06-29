# AGENTS.md

Rules for any agent (human or AI) working in this repository.

## Branching & PRs

- **Branch from `main`** for all changes
- **PRs always target `main`**
- Always add `@guy-shahine` and `@akadenia-leaf` as reviewers — Guy is the code owner for all files (`CODEOWNERS: * @guy-shahine`)
- Check `gh pr list` before creating a new PR — never duplicate an open PR

## PR Titles

Conventional Commits with an optional scope, enforced by `check_pr_title_style.yml`:

```text
type(optional-scope): lowercase subject
```

- **Scope is optional** — `feat: add new feature` is valid
- Disallowed scope: `core`
- Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`

Examples:
```
✅  feat(helpers): add string truncation utility
✅  fix(api): handle empty response body
✅  chore(deps): upgrade dependencies to latest
✅  feat: add new feature without scope
❌  feat(core): disallowed scope
```

## Git Commits

- **All commits must be signed** — use SSH or GPG signing (`git config commit.gpgsign true`)
- Use conventional commit messages matching the PR title format
- **Always start from a freshly synced branch** — run `git fetch origin && git checkout -b your-branch origin/main` before creating any branch. Never branch from a stale local checkout.

## Pre-Push Checklist — MANDATORY

Before every push, run all three and fix any failures:

```bash
pnpm run lint
pnpm test
pnpm run build
```

Never use `--no-verify`. No exceptions.

## Releases

Releases are handled automatically by **semantic-release** on push to `main`:

- `feat(...)` commits → minor version bump
- `fix(...)` commits → patch version bump
- `BREAKING CHANGE` in commit body → major version bump
- Release is published to npm as `@akadenia/<package>`

Do not manually bump versions in `package.json`.

## TypeScript

- Keep TypeScript at `^5.x` — **do not upgrade to TypeScript 6.x** until `ts-jest` adds support
- Build with `pnpm run build` (compiles to `dist/`)

## Testing

- Tests live in `__tests__/`, run with `jest`
- All tests must pass before pushing
