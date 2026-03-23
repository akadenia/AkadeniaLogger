# AGENTS.md

Rules for any agent (human or AI) working in this repository.

## Branching & PRs

- **Branch from `main`** for all changes
- **PRs always target `main`**
- Always add `@guy-shahine` as reviewer — he is the code owner for all files (`CODEOWNERS: * @guy-shahine`)
- Check `gh pr list` before creating a new PR — never duplicate an open PR

## PR Titles

Conventional Commits with a required scope, enforced by `check_pr_title_style.yml`:

```text
type(scope): lowercase subject
```

- **Scope is mandatory** — `feat: missing scope` will fail CI
- Disallowed scope: `core`
- Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`

Examples:
```
✅  feat(helpers): add string truncation utility
✅  fix(api): handle empty response body
✅  chore(deps): upgrade dependencies to latest
❌  feat: missing scope
❌  feat(core): disallowed scope
```

## Pre-Push Checklist — MANDATORY

Before every push, run all three and fix any failures:

```bash
npm run lint
npm test
npm run build
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
- Build with `npm run build` (compiles to `dist/`)

## Testing

- Tests live in `__tests__/`, run with `jest`
- All tests must pass before pushing

> **AkadeniaAzureStorage only:** Integration tests require Azurite (local Azure emulator).
> Use `npm run test:with-azurite` for full test suite, or `npm test` for unit tests only.
