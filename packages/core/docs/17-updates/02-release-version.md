# Releasing a Version

## Introduction

The packages of the repository (`packages/*` and `plugins/*`) are versioned together, following **Semantic Versioning** (SemVer). The version of each package is the `version` of its `package.json`; there is no separate version file. This page is for the people who maintain the framework and publish a release.

**Semantic Versioning Format:** `MAJOR.MINOR.PATCH`

## Releasing

1. Be on `main`, up to date, with a clean working tree.
2. Read the current version from `packages/core/package.json`.
3. Close `## [Unreleased]` in each `CHANGELOG.md` that has entries: rename it to `## [X.Y.Z] - YYYY-MM-DD` and leave a new empty `## [Unreleased]` above it.
4. Update every package at once with `scripts/packages/version.sh <major|minor|patch|alpha|beta|rc>` (add `--yes` to skip the confirmation). It keeps the internal `@nextsparkjs/*` ranges consistent. From a beta release use `beta` to stay on the channel: `patch` goes from `0.1.0-beta.201` to `0.1.0`, the stable release, and leaves it.
5. Review the diff, and run the package test and build gates.
6. Commit the version change and the closed changelog entries (`git add packages/*/package.json plugins/*/package.json`, plus the changelogs), and tag it (`git tag -a vX.Y.Z -m "Release vX.Y.Z"`). `version.sh` does neither.
7. Pack with `pnpm pkg:pack`, check the tarballs with `pnpm pkg:verify-tarballs`, run `node scripts/security/verify-no-dev-credentials.mjs <project>` on a built project created from the tarballs, and publish with `pnpm pkg:publish`. `pkg:publish` publishes under the `latest` dist-tag unless told otherwise: pass `--tag beta` (or `alpha`, `rc`, `next`) for a prerelease so it does not become the default install, and `--also-tag <tag>` to point a second tag at the same versions. Never run `npm publish` directly: it does not resolve `workspace:*` ranges.
8. Push the commit and the tag, and write the GitHub release notes from the `CHANGELOG.md` entry.

---

## Semantic Versioning Explained

Semantic Versioning follows the format: `MAJOR.MINOR.PATCH`

### MAJOR Version (`1.0.0` → `2.0.0`)

Increment when making **breaking changes** that require user action.

**Examples:**
- Removing or renaming core APIs
- Changing database schema in non-backward-compatible ways
- Removing support for Node.js versions
- Major refactoring requiring configuration changes

**Use when:**
- Users need to modify their code
- Migration guide is required
- Existing functionality breaks

---

### MINOR Version (`0.1.0` → `0.2.0`)

Increment when adding **new features** in a backward-compatible manner.

**Examples:**
- New plugins or themes
- New API endpoints
- New configuration options (with defaults)
- New components or utilities
- Optional new features

**Use when:**
- Adding functionality without breaking existing code
- Users can adopt new features at their pace
- No migration required

---

### PATCH Version (`0.1.0` → `0.1.1`)

Increment when making **bug fixes** or minor improvements.

**Examples:**
- Bug fixes
- Security patches
- Documentation updates
- Performance improvements
- Internal refactoring (no API changes)
- Dependency updates

**Use when:**
- Fixing issues without changing functionality
- Making internal improvements
- Updating documentation

---


## Version Decision Guide

### When to Use PATCH (`0.1.0` → `0.1.1`)

- ✅ Fixed a bug
- ✅ Updated documentation
- ✅ Internal refactoring
- ✅ Performance improvements
- ✅ Security patches
- ✅ Dependency updates (patch/minor)

---

### When to Use MINOR (`0.1.0` → `0.2.0`)

- ✅ Added new plugin
- ✅ Added new theme
- ✅ New API endpoints
- ✅ New components
- ✅ New optional features
- ✅ Backward-compatible improvements

---

### When to Use MAJOR (`0.5.0` → `1.0.0`)

- ✅ Breaking API changes
- ✅ Removed features/APIs
- ✅ Database schema changes (breaking)
- ✅ Major refactoring
- ✅ Dropped support (Node.js versions, etc.)
- ✅ Requires user migration

---

### Pre-1.0.0 Versions

Before reaching `v1.0.0`, semantic versioning is more relaxed:

- **0.y.z** - Initial development, anything can change
- Breaking changes can be in MINOR versions (0.1.0 → 0.2.0)
- Once stable, release 1.0.0 and follow strict SemVer

---

## Release candidate checks

Before a release candidate is called ready, these run on the exact commit that is going to be published:

- **macOS arm64, by hand.** The `macos` job of the *Generated projects* workflow already creates the starter from the packed packages, builds it and serves it on a macOS arm64 runner on every push to `main`. At each RC, someone does the same on a Mac with Apple silicon: pack (`./scripts/packages/pack.sh --all`), create a starter from the tarballs, `pnpm install`, `pnpm db:migrate`, `pnpm build`, `pnpm start`, and request `/login` and `/`. Note the macOS version, the Node and pnpm versions and the result in the RC report.
- **The upgrade from `0.1.0-beta.183`, by hand, and the weekly job.** The *Upgrade from 0.1.0-beta.183* workflow (`.github/workflows/upgrade-183.yml`, every Monday and on demand) creates a project with the published `create-nextspark-app@0.1.0-beta.183`, adds the edits the [upgrade guide](./06-upgrade-0x-projects.md) is about, upgrades it with the `nextspark migrate` of `main`, and runs `prepare`, `db:migrate`, the build and `next start`. At each RC, run the same script on the RC's tarballs: `./scripts/packages/pack.sh --all --output <dir>`, then `node scripts/upgrade/verify-upgrade-183.mjs --packages <dir> --work <new or empty scratch dir outside the repository> --logs <dir to keep the step logs in>` with `PGHOST`, `PGUSER` and `PGPASSWORD` pointing at a PostgreSQL where that user can create and drop databases. Put its output, and the date of the last green weekly run, in the RC report. The *Upgrade from older releases* workflow (`.github/workflows/upgrade-older.yml`, every Monday and on demand) runs the same script with `--from 0.1.0-beta.167`, `.178` and `.180`; note the date of its last green run too. The script takes any release from `0.1.0-beta.167` to `.183` as `--from`; see [Supported starting versions](./06-upgrade-0x-projects.md#supported-starting-versions).
- **The RC report** lists, for the RC commit: the jobs of *Generated projects*, *Project template migrations* and *Checks* (all green), the macOS check above, the upgrade check above, and anything run by hand that CI does not cover.


## See Also

- [Core Update Command](./01-update-core.md) - Updating to new releases
- [Installation Guide](../02-getting-started/01-installation.md) - Initial setup
- [Semantic Versioning](https://semver.org/) - Official SemVer specification

