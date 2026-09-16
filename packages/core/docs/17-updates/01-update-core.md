# Core Update Command

## Introduction

`update-core` moves a NextSpark project to another release of the `@nextsparkjs` packages.

A project takes NextSpark from npm: `package.json` pins `@nextsparkjs/core`, `@nextsparkjs/cli` and the other `@nextsparkjs` packages to one version, `app/` is kept in step with core's templates by `nextspark sync:app`, and `contents/` holds your own themes and plugins. An update sets those pins to the new version, installs it, and syncs `app/`. No framework source is copied into the project, and the files core generates that you customized are kept.

---

## Quick Reference

```bash
pnpm update-core                            # Update to the version npm tags latest
pnpm update-core --version 0.1.0-beta.189   # Update to a specific version
pnpm update-core --branch                   # Create update/<version> and update there

pnpm update-core --list                     # List published versions
pnpm update-core --check                    # Say whether a newer version is published
pnpm update-core --current                  # Show the installed version
pnpm update-core --help                     # Help
```

`update-core` is a command of `@nextsparkjs/core` itself, so `pnpm update-core` works in any project that installs a release of core that ships it, whether or not its `package.json` has an `update-core` script.

Run it where the `package.json` that depends on `@nextsparkjs/core` is: the project root, or `web/` in a web-mobile project. The lockfile and `pnpm-workspace.yaml` it puts back after a failed install are the workspace root's.

---

## What Gets Updated

| What | How |
|------|-----|
| `package.json` | Only the versions of the `@nextsparkjs` packages, all set to the target. A `^` or `~` range keeps its prefix. |
| `pnpm-lock.yaml`, `node_modules/` | `pnpm install` |
| `app/` | `nextspark sync:app --force`, which updates the files core generates, keeps the ones you customized, and rebuilds the registries |
| `next.config.mjs`, `tsconfig.json`, `i18n.ts`, `proxy.ts` or `middleware.ts` | Also `sync:app`, with the same rule: a file you customized is kept |
| `.next/` | Removed, so the next build starts clean |
| `core.version.json` | Written last, only when everything above succeeded |

### Never Touched

- The rest of `package.json`: name, scripts, other dependencies
- `contents/`: your themes and plugins
- `.env*`: environment files

---

## Before Anything Changes

The update stops, says why and leaves the project as it was when:

- the project has uncommitted changes (commit or stash them, so the update can be reviewed and rolled back on its own), unless they are what an unfinished update to the same version left: see [When a Step Fails](#when-a-step-fails)
- a `@nextsparkjs` package in `package.json` isn't published at the target version
- the target is older than the installed version (`app/` would be synced back, and applied migrations can't be undone)
- `package.json` takes a `@nextsparkjs` package from somewhere other than the registry (`file:`, `link:`, `workspace:`, a git URL)
- `@nextsparkjs/core` isn't installed yet (run `pnpm install` first) or `@nextsparkjs/cli` isn't a dependency
- `.env` doesn't set `NEXT_PUBLIC_ACTIVE_THEME`: without it `sync:app` skips the registry build, and `app/(templates)` would stay on the old core
- `--branch` is given and `update/<version>` already exists, or the project isn't a git repository
- the project keeps the framework in `core/`, the layout from before NextSpark shipped as npm packages

---

## When a Step Fails

The command exits with a non-zero code, prints no next steps and leaves `core.version.json` as it was. It says which step failed, what it had already changed and what it didn't get to:

```
========================================
  Update to 0.1.0-beta.189 did not finish
========================================

  Failed: nextspark sync:app (exit 1); what it reported is above

  Already changed:
    - package.json: @nextsparkjs/core 0.1.0-beta.188 -> 0.1.0-beta.189, ...
    - pnpm-lock.yaml and node_modules: @nextsparkjs/core 0.1.0-beta.188 -> 0.1.0-beta.189
    - .next cache cleared

  Not done:
    - app/ sync with core and registry build, or at least one of them (sync:app says which)
    - core.version.json still says 0.1.0-beta.188

  Uncommitted now (git status):
    .gitignore
    app/(auth)/layout.tsx
    package.json
    pnpm-lock.yaml
    pnpm-workspace.yaml

  To finish: fix what failed above and run pnpm update-core --version 0.1.0-beta.189 again, leaving these changes uncommitted: it picks up from them.
  Roll back: git reset --hard 1a2b3c4d5e6f && git clean -fd && pnpm install
```

- **`pnpm install` fails:** `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` (where pnpm 11 records newly published versions) are put back as they were; run `pnpm install` to settle `node_modules`.
- **`sync:app` or the registry build fails:** the new versions stay installed, and whatever `sync:app` wrote before failing stays too; `Uncommitted now` lists every file that differs from the commit the update started from. Fix what `sync:app` reported and run the same `update-core` again without committing. It picks up from those changes, finishes the sync and records the version, as long as every `@nextsparkjs` package is still set to that version and nothing changed outside the files an update writes (`package.json`, the lockfile and `pnpm-workspace.yaml`, `.gitignore`, the root files above, `app/` and `.nextspark/`). The rollback line keeps pointing at the commit the update started from.

The rollback line is only printed for a git repository: the update started from a clean tree, so resetting to that commit and removing untracked files undoes exactly what it did.

---

## Flags

### `--version <version>`

Update to a published version. A leading `v` is accepted (`v0.1.0-beta.189`).

### `--latest`

Update to the version npm tags `latest` for `@nextsparkjs/core`. This is the default.

### `--branch`, `-b`

Create `update/<version>` (dots become dashes, e.g. `update/0-1-0-beta-189`) from the current commit and update there. The changes are left uncommitted for you to review and commit.

### `--list`

The 20 newest published versions of `@nextsparkjs/core`, marking `latest` and the installed one.

### `--check`

Compares the installed version with `latest`.

### `--current`

The installed version of `@nextsparkjs/core`, read from `node_modules`.

Registry lookups go through `pnpm view`, so they use the registry your project's `.npmrc` sets.

---

## After a Successful Update

```
========================================
  Update Complete
========================================

  @nextsparkjs/core 0.1.0-beta.188 -> 0.1.0-beta.189
  New core migrations: 1

  Next steps:
    1. Review: git status && git diff
    2. Test: pnpm build && pnpm dev
    3. Migrate: pnpm db:migrate
    4. Commit the update

  Roll back: git reset --hard 1a2b3c4d5e6f && git clean -fd && pnpm install
```

`New core migrations` and the `db:migrate` step only appear when the new core brings migrations the previous one didn't have. A resumed update can't count them, since the new core was already installed when it started, so it always lists `db:migrate`.

---

## Core Version Tracking

`core.version.json` records the last update `update-core` completed:

```json
{
  "version": "0.1.0-beta.189",
  "previousVersion": "0.1.0-beta.188",
  "updatedAt": "2026-09-16T10:30:00.000Z"
}
```

A project that was never updated has none. The installed version is always `pnpm update-core --current`.

---

## Projects on a Core Without `update-core`

If `pnpm update-core` answers `Command "update-core" not found`, the installed core predates the command. Take that one update by hand, then use `pnpm update-core` from there on:

1. Set every `@nextsparkjs/*` package in `package.json` to the new version.
2. Run `pnpm install`.
3. Run `pnpm exec nextspark sync:app --force`.

---

## See Also

- [Release Version Command](../updates/release-version) - Creating new core releases
- [Installation Guide](../getting-started/installation) - Initial setup
- [Deployment](../deployment/overview) - Production deployment strategies
