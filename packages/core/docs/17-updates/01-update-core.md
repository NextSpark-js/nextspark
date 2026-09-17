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

Run it where the `package.json` that depends on `@nextsparkjs/core` is: the project root, or `web/` in a web-mobile project. `pnpm install` runs where `pnpm-lock.yaml` is, which in a web-mobile project is the directory above `web/`.

In a web-mobile project whose `web/` has a `pnpm-workspace.yaml` of its own, as projects `create-nextspark-app` generates have had, pnpm 11 takes `web/` for a workspace of its own and installs it before running any script there: `pnpm update-core` fails in that install (`ERR_PNPM_IGNORED_BUILDS`) before `update-core` starts, having written `web/pnpm-lock.yaml` and `web/pnpm-workspace.yaml`. Run it from `web/` as `pnpm --config.verify-deps-before-run=false update-core`, which skips that install.

---

## What Gets Updated

| What | How |
|------|-----|
| `package.json` | Only the versions of the `@nextsparkjs` packages, all set to exactly the target. A `^` or `~` range is replaced by the exact version: with a range, `pnpm install` takes the newest published version the range allows, which can be newer than the target. |
| `pnpm-lock.yaml`, `node_modules/` | `pnpm install`, run where `pnpm-lock.yaml` is |
| `app/` | `nextspark sync:app --force`, which updates the files core generates, keeps the ones you customized, and rebuilds the registries |
| `next.config.mjs`, `tsconfig.json`, `i18n.ts`, `proxy.ts` or `middleware.ts` | Also `sync:app`, with the same rule: a file you customized is kept |
| `.next/` | Removed, so the next build starts clean |
| `core.version.json` | Written last, only when everything above succeeded |

### What `update-core` Itself Never Writes

- The rest of `package.json`: name, scripts, other dependencies
- `contents/`: your themes and plugins
- `.env*`: environment files

The lifecycle scripts `pnpm install` runs are not bound by this list: they can write anywhere in the project. That is why a run that stops partway is rolled back through git, as a whole (see [When a Run Stops Partway](#when-a-run-stops-partway)).

---

## Before Anything Changes

The update stops, says why and leaves the project as it was when:

- the project isn't in a git repository, or the repository has no commit yet: a run that stops partway is rolled back by returning to the commit it started from
- `pnpm-lock.yaml` (in a web-mobile project, the one above `web/`) is missing or isn't committed: the rollback installs exactly what the lockfile of the commit it returns to records
- the project has uncommitted changes, including untracked files that aren't ignored and changes inside submodules (also when `.gitmodules` or your git config tells `git status` to ignore them). Commit or stash them first: the rollback returns to the commit the update started from and removes untracked files, so it would discard them. There are no exceptions, not even for changes an earlier run of `update-core` left
- a `@nextsparkjs` package in `package.json` isn't published at the target version
- the target is older than the installed version (`app/` would be synced back, and applied migrations can't be undone)
- `package.json` takes a `@nextsparkjs` package from somewhere other than the registry (`file:`, `link:`, `workspace:`, a git URL)
- `@nextsparkjs/core` isn't installed yet (run `pnpm install` first) or `@nextsparkjs/cli` isn't a dependency
- `.env` doesn't set `NEXT_PUBLIC_ACTIVE_THEME`: without it `sync:app` skips the registry build, and `app/(templates)` would stay on the old core
- `--branch` is given and `update/<version>` already exists
- the project keeps the framework in `core/`, the layout from before NextSpark shipped as npm packages

If you set the `@nextsparkjs` versions in `package.json` by hand and didn't install them, pnpm 11 installs them before it runs any script, `update-core` included: those changes to the lockfile and `node_modules` happen before `update-core` starts, and it then refuses the uncommitted `package.json`. To run it without that install, use `pnpm --config.verify-deps-before-run=false update-core`.

When every `@nextsparkjs` package in `package.json` is already pinned exactly to the target and `node_modules` holds the target for each of them, there is nothing to update: it says `Already on <version>`, exits 0 and changes nothing. That is decided from `package.json` and `node_modules`, not from `core.version.json`. A `^` or `~` range is not taken for the target, even one starting at it with the target installed: the update runs, sets it to the exact version, installs (which updates the lockfile to match) and syncs `app/`, as for any other version.

Files `.gitignore` ignores don't make the tree unclean, and the rollback can't restore them (see [What the Rollback Can't Restore](#what-the-rollback-cant-restore)): if you keep files that matter there, like `.env`, back them up before updating.

---

## When a Run Stops Partway

Just before its first change, the update prints the commit it starts from and the command that rolls back to it. Don't work in the project while the update runs: the rollback removes untracked files, including ones you create meanwhile.

From there on, if a step fails, anything else goes wrong (for example, creating the `--branch` branch or writing `core.version.json` fails), or the run is interrupted with Ctrl-C (`SIGINT`), `SIGTERM` or `SIGHUP`, the update:

1. stops the step that is running, together with the processes it started in its process group, such as the lifecycle scripts of `pnpm install`. On a signal, it passes the signal on to them; whatever is still running 5 seconds after the signal arrived is killed with `SIGKILL`. A second signal doesn't restart or shorten that wait (a Ctrl-C can arrive twice, once from the terminal and once passed on by `pnpm`). When a step's command exits, failing or not, and processes it started are still running half a second later, they get `SIGTERM`, and `SIGKILL` 5 seconds later; after a step that succeeded, the update says so and goes on, unless one of them survived `SIGKILL`, which fails the update. (On Windows, see [When the Run Is Killed](#when-the-run-is-killed).);
2. undoes nothing;
3. prints what stopped it; whether the step's processes exited after the signal or had to be killed; the steps it finished and the ones it never reached; what `git status` shows now; and the rollback;
4. exits non-zero: 1 for a failure, 128 plus the signal's number for an interruption (130 for `SIGINT`, 143 for `SIGTERM`).

```
========================================
  Update to 0.1.0-beta.189 did not finish
========================================

  Interrupted by SIGINT during: pnpm install
  pnpm install and the processes it started exited after the signal.

  Done before that:
    - package.json: @nextsparkjs/core 0.1.0-beta.188 -> 0.1.0-beta.189, ...

  Not reached:
    - nextspark sync:app --force
    - write core.version.json

  Nothing was undone. A step that stopped may have written part of its work, and the
  lifecycle scripts pnpm install runs can write anywhere in the project.
  git status now (files .gitignore ignores, like node_modules, are not listed):
     M package.json

  To put the project back at the commit the update started from, run here:
    git reset --hard 1a2b3c4d5e6f && git clean -fd && rm -rf node_modules && pnpm install --frozen-lockfile
  Then run update-core --version 0.1.0-beta.189 again.
```

If the step's processes were still running 5 seconds after the signal, the second line reads `pnpm install or processes it started were still running 5 s after the signal, and were killed with SIGKILL.`, followed by a warning if any of them was still running after that.

The rollback is always the whole thing, never a list of files to put back: `pnpm install` runs lifecycle scripts (core's own `postinstall` runs `sync:app`), and those can have written anywhere before the step stopped. Since the update only starts from a clean tree, `git reset --hard` to that commit and `git clean -fd` undo every change to tracked files and remove the untracked files and directories the run created (not a nested git repository, which `git clean` leaves unless given `-f` twice). The rest of the command depends on the project:

- **Web-mobile, run from `web/`:** it reads `git clean -fd :/`, so it cleans the whole repository and not just `web/`, removes the workspace root's `node_modules` too and installs from there: `rm -rf ../node_modules node_modules && pnpm --dir .. install --frozen-lockfile`.
- **Submodules:** when the commit has a `.gitmodules`, `git reset --hard` and `git clean` don't reach inside submodules, so the command adds `git submodule foreach --recursive git reset --hard && git submodule update --recursive` after the reset and `git submodule foreach --recursive git clean -fd` after the clean. A submodule a script only wrote in keeps the branch it was on; one whose commit a script changed goes back to the commit your project records for it, detached from its branch.
- **`--branch`:** it also switches back to the branch you were on and deletes `update/<version>` with `git update-ref -d`, which also works when the run stopped before creating it.

`node_modules` is removed and installed again rather than just installed: an install that was stopped can leave `node_modules` holding the new versions while the lockfile still names the old ones, and `pnpm install` then reports it up to date without changing anything. The install is `--frozen-lockfile`, so it installs exactly what the commit's `pnpm-lock.yaml` records. If that lockfile doesn't match the commit's `package.json` (a `^` range in `package.json` and an exact version recorded for it, say), the install fails with `ERR_PNPM_OUTDATED_LOCKFILE` instead of rewriting the lockfile: by then the files are back as the commit has them and `node_modules` is gone, and a plain `pnpm install` rebuilds it, changing the lockfile to match `package.json`.

The rollback is a POSIX shell command: run it in a shell like the ones on macOS and Linux, or Git Bash or WSL on Windows.

### When the Run Is Killed

A run killed with `SIGKILL`, or whose machine goes down, can't print the report: use the rollback it printed before its first change.

`pnpm install` and `sync:app` run under a small guard process of their own, outside the terminal's process group, which kills the step's process group as soon as `update-core` exits before it is done with the step, however `update-core` ended: killed alone with `SIGKILL`, or together with the rest of the terminal's process group. It can't reach a process a lifecycle script moved out of that process group (with `setsid`, or by starting a daemon); the note printed before the first change says so too.

If the guard process itself doesn't say which process group the step runs in within 5 seconds of a signal (it normally does within milliseconds of starting), the update stops the guard, which kills the step's group if it still can, and the report says the step may still be running.

A signal that arrives once `core.version.json` is written stops nothing: the update is complete by then. On Windows, which has no process groups, the running step and the processes under it are stopped with `taskkill /T /F`, right away rather than after 5 seconds; processes a step leaves running after its command exits have no running parent for `taskkill /T` to find them by, and are not stopped.

### What the Rollback Can't Restore

What the rollback restores is what git tracks as of that commit, so it can't restore:

- **Files `.gitignore` ignores that a lifecycle script overwrote or deleted.** git has no copy of them. That includes `.env` and other environment files; `node_modules/`, `.next/` and the generated registries are also ignored, but those are rebuilt by the rollback's install and by the next build. If ignored files you care about sit in the project, back them up before updating: the update doesn't refuse a tree that has them, since every project does.
- **Files you create while the update runs**, anywhere in the repository: they are untracked, and `git clean` removes them. Don't work in the project until the update has finished or you have rolled back.
- **What a script does with git itself**: commits, branches or tags it creates, or a branch it switches the project or a submodule to. The rollback resets files to the commit and moves submodules back to their recorded commits; it doesn't delete refs or put `HEAD`, or a submodule's `HEAD`, back on the branch it was on.
- Anything outside the repository.

---

## Flags

### `--version <version>`

Update to a published version. A leading `v` is accepted (`v0.1.0-beta.189`). Every `@nextsparkjs` package is set to exactly that version, and the update fails (with the report above) if `pnpm install` leaves any of them at another one.

### `--latest`

Update to the version npm tags `latest` for `@nextsparkjs/core`. This is the default.

### `--branch`, `-b`

Create `update/<version>` (dots become dashes, e.g. `update/0-1-0-beta-189`) from the current commit and update there. The changes are left uncommitted for you to review and commit. If creating or switching to the branch fails, that goes through the same report and rollback as any other failure, since git may have created the branch or switched to it before failing.

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

  Roll back: git reset --hard 1a2b3c4d5e6f && git clean -fd && rm -rf node_modules && pnpm install --frozen-lockfile
```

`New core migrations` and the `db:migrate` step only appear when the new core brings migrations the previous one didn't have.

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

A project that was never updated has none. It is a record, not what `update-core` goes by: the installed version is always `pnpm update-core --current`, and whether there is anything to update is decided from `package.json` and `node_modules`.

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
