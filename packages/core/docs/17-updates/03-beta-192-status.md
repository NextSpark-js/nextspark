# 0.1.0-beta.192 status

**UNRELEASED — work in progress.** This prerelease continues the 0.1.0 beta line; it is not a 1.0 release or a statement that the linked issues are complete.

## Release target

The stable target remains existing web hosts. Generated and mobile hosts remain experimental while their host-specific validation and migration work is completed.

| Issue | Integrated beta.192 slice | Remaining acceptance |
| --- | --- | --- |
| [#201](https://github.com/NextSpark-js/nextspark/issues/201) | `pnpm exec nextspark skills` provides an offline bundled catalog with safe list/get commands; generated projects receive small, non-overwriting onboarding pointers, while the legacy AI workflow remains an explicit opt-in. | Full skill discovery and catalog, an evaluation baseline, and legacy ownership/migration remain pending. |
| [#202](https://github.com/NextSpark-js/nextspark/issues/202) | Runtime readiness gates supported authentication routes without exposing diagnostics; login, signup, invitation signup, and recovery render safe unavailable or fail-closed states when their runtime capability is absent. `pnpm exec nextspark prepare --production` and `pnpm exec nextspark build` fail before `next build` when the build environment proves no login method can authenticate, with explicit runtime-only declarations and one documented bypass; production startup logs a safe error when none can. The interactive project wizard collects a Resend and/or Google provider (validated with the same rules, written only to `.env`) or marks the project local-only; `--yes`, quick mode and presets postpone. A fresh wizard project now receives `instrumentation.ts`, which calls the startup check; `pnpm exec nextspark sync:app` creates it for an existing host that doesn't have one yet. | Validate a real provider end-to-end. Projects whose build script runs `next build` directly skip the build check. Existing hosts must apply the [documented readiness and invitation-route upgrade guards](../06-authentication/12-passwordless-preset.md#upgrading-existing-hosts); a missing route makes the new shared UI fail closed. A host with its own customized `instrumentation.ts` still merges in the [startup check](../06-authentication/12-passwordless-preset.md#startup-re-validation) by hand, since `sync:app` never overwrites a file it did not write. |
| [#203](https://github.com/NextSpark-js/nextspark/issues/203) | `pnpm exec nextspark prepare` is shared by `pnpm exec nextspark build`, `pnpm exec nextspark registry:build`, and one-shot `pnpm exec nextspark generate`, with startup/failure guards and `pnpm exec nextspark prepare --watch` cancellation handling before downstream work starts. `pnpm exec nextspark migrate --dry-run` reports, without writing anything, what a 0.x project would face when moving to the 1.0 root-first layout: host root, version drift, customized `app/` and root files, tooling configs pointing into `contents/`, collisions with names Next reserves, and untracked files a move would risk. | Experimental generated-host roadmap work, including generated/mobile host validation, remains pending. |
| [#204](https://github.com/NextSpark-js/nextspark/issues/204) | The merged theme-proxy boundary preserves core access checks around theme results and fails unsafe rewrite targets closed. Gate G3 now has an automated check: `pnpm pkg:verify-tarballs`, which the release how-to requires between packing and publishing (`pack.sh` prints it as the next step; `publish.sh` does not invoke it, so it is a manual step today). It fails when a packed package is missing a declared entry point, export target, type or binary, keeps a `workspace:`/`link:`/`file:` protocol or an unparseable internal version, or ships a maintainer-local path, an `.env` file, key material or a cache. A G1 dependency triage is recorded in the release evidence; its applicable findings are fixed below. | Applicable [#204](https://github.com/NextSpark-js/nextspark/issues/204) follow-up gates and broader host validation remain pending. |

## Upgrade and validation status

Before a stable-web release decision, real-provider web end-to-end coverage, a registry upgrade check after publication, and applicable [#204](https://github.com/NextSpark-js/nextspark/issues/204) gates remain pending. Optional catalog breadth and the full experimental generated/mobile-host roadmap are not automatic stable-web blockers. The CLI test previously reported as a pnpm 9 extglob failure was a version-dependent expectation (temporary projects ran a newer global pnpm that rejects extglob workspaces); it now follows the running pnpm and the CLI suite passes.

A post-commit tarball clean-install and beta.191→beta.192 upgrade validation run found three delivery/build blockers: a `proxy.ts` template TypeScript strict-null error that failed `next build`'s type-check for every fresh project, `instrumentation.ts` never being copied into a generated project (so the startup check above never ran), and local-tarball dependency discovery missing `@nextsparkjs/testing`, which `packages/core/package.json` then still listed as a runtime dependency, which broke every tarball-based install and upgrade until that version is published. The first two are fixed. `@nextsparkjs/testing` is no longer a runtime dependency of `@nextsparkjs/core` at all: nothing in core imports it (only comments point consumers at it), and it is now a direct devDependency every generated project declares for itself, matching the monorepo themes' own `peerDependencies` on it. A re-run against the fixes showed:

- A fresh project created from the tarballs installs, migrates, builds and starts with no manual steps, and receives `instrumentation.ts`. `@nextsparkjs/testing` resolves the same direct way as `@nextsparkjs/core`, `cli` and `ui`: create-nextspark-app installs it from its own local tarball (`.packages/nextsparkjs-testing-<version>.tgz`) when one matches the local core tarball's version, and the wizard pins it to the CLI's own version from the registry otherwise. No hand-added `pnpm.overrides` entry is needed for it any more.
- A beta.191 host upgraded to the tarballs builds and starts after `pnpm exec nextspark sync:app` and the documented route guards. `update-core` only re-pins an `@nextsparkjs/*` package already listed in the project's `dependencies`/`devDependencies`; a beta.191 (or earlier) project never listed `@nextsparkjs/testing` there, since it arrived transitively through core's own dependency. After upgrading, a project whose Cypress tests import it (the starter theme's `BasePOM`, `DashboardEntityPOM`, `ApiInterceptor`, or a project's own tests) must add `@nextsparkjs/testing` to its own `devDependencies` by hand, at the same version as `@nextsparkjs/core` -- from the registry once beta.192 is published, or as a `file:` local tarball while testing against unpublished tarballs.

An upgrade from the registry after publication is expected to need only that one hand-added devDependency, never a `pnpm.overrides` entry. This has not been verified, and that check remains pending. This status is not a release certification.

## Also in this prerelease

Fixes found while validating the release, each with an independent cross-family review:

- **Client JS per route (#192).** A route a project overrides used to resolve its template at runtime through a registry indexed by a variable, so every template stayed reachable from it. The generator now emits a scope with a direct import, without rewriting core's route file, and routes that genuinely resolve by a computed path keep bounded per-family scopes. Against beta.191 an overridden route reached 5 client chunks against 2 for a project-only route; on this line both are already 2, so this is conformance rather than a further reduction. `pnpm test:template-route-conformance` asserts each scope's member set; the chunk counts above were measured by the implementer on fixture builds, not asserted as literals by that script.
- **Calendar remounts (#205).** The calendar passed three components defined inline in its render to DayPicker, so every parent render remounted the whole day grid and re-ran its focus effects. They are module-level now.
- **Cypress type-checking in generated projects.** The shipped `tsconfig.cypress.json` could not resolve package `exports` subpaths.
- **Bundled themes and plugins.** Creating a project with the bundled `starter` theme tried to fetch it from the registry and crashed; bundled names are no longer fetched, and an unknown name reports the valid options.

## Dependency security floors (G1)

A dependency audit (#204 gate G1) found vulnerable versions reachable from published packages. The declared minimums are raised, so consumer lockfiles can no longer resolve the vulnerable releases:

- `@nextsparkjs/cli`: `tar` `^7.5.21`. Archive extraction when fetching packages.
- `@nextsparkjs/core`: `sharp` `^0.35.4`. Uploaded image processing; the `^0.34` range is dropped.
- `@nextsparkjs/plugin-langchain`: `handlebars` `^4.7.9`. Prompt template compilation.

`@nextsparkjs/core` now depends on `@nextsparkjs/ui` through `workspace:*`. It is therefore published pinned to the same version, instead of the old `^0.1.0-beta.2` range, which let a core release run with an unrelated `ui`. Findings that are not applicable or have low reachability are triaged in the release evidence.

## Breaking changes: stale package.json exports removed (G3 tarball verification)

The G3 release-gate tarball checker (`pnpm pkg:verify-tarballs`) found several `package.json` entries whose declared build targets were already missing from the published tarball, left behind after earlier, unrelated content moves. Removing them is a consumer-facing API-surface change even though nothing that actually worked stops working — each target was already absent, so importing any of these paths already failed before this release too:

- `@nextsparkjs/core`: removed the `./theme-styles.css` export (the file was deleted from the package in a prior fix; theme CSS is generated per-project, not shipped from core's own root).
- `@nextsparkjs/core`: removed the bare `./lib/teams` and `./lib/permissions` subpaths (no `index` build output was ever produced for them). Use `./lib/teams/*` and the specific `./lib/permissions/{system,types,check,init}` exports instead.
- `@nextsparkjs/core`: removed `./presets/*` (the `presets/` directory was fully consolidated into `templates/` in an earlier release).
- `@nextsparkjs/core`: removed `./cypress-support` (Cypress support code moved to `@nextsparkjs/testing`; import from that package instead).
- `@nextsparkjs/ui`: removed `./variants/*` (no `src/variants/` source has ever shipped).
- `@nextsparkjs/cli`: removed `main`/`types` — the package is bin-only (`nextspark` via `bin/`); there is no supported programmatic `import '@nextsparkjs/cli'` entry point.

## Verification of this line

On the final commit of this prerelease, on this machine:

| Suite | Result |
| --- | --- |
| CLI | 331 passing, 1 unchanged skip |
| Core Node | 272 passing |
| Core Jest | 3,962 passing, 9 unchanged skips, 196 suites |
| Registry scripts | 271 passing |
| `create-nextspark-app` | all passing |
| Core type-check | clean |
| Public package versions | all 16 at `0.1.0-beta.192` |

The tarball clean-install and the beta.191 upgrade were run earlier on this line, not on the final commit: a fresh project from the packed tarballs installed, migrated, built and started without manual steps, and a beta.191 host upgraded after `pnpm exec nextspark sync:app` and the documented route guards. Both should be re-run on the final artifacts before publishing. Logs for these runs and for the independent reviews live in the release evidence folder for this line, outside the repository.

This is not a release certification: no push, tag or publication has been made, and the pending items above still stand.
