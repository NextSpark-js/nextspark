# 0.1.0-beta.192 status

**UNRELEASED — work in progress.** This prerelease continues the 0.1.0 beta line; it is not a 1.0 release or a statement that the linked issues are complete.

## Release target

The stable target remains existing web hosts. Generated and mobile hosts remain experimental while their host-specific validation and migration work is completed.

| Issue | Integrated beta.192 slice | Remaining acceptance |
| --- | --- | --- |
| [#201](https://github.com/NextSpark-js/nextspark/issues/201) | `pnpm exec nextspark skills` provides an offline bundled catalog with safe list/get commands; generated projects receive small, non-overwriting onboarding pointers, while the legacy AI workflow remains an explicit opt-in. | Full skill discovery and catalog, an evaluation baseline, and legacy ownership/migration remain pending. |
| [#202](https://github.com/NextSpark-js/nextspark/issues/202) | Runtime readiness gates supported authentication routes without exposing diagnostics; login, signup, invitation signup, and recovery render safe unavailable or fail-closed states when their runtime capability is absent. `pnpm exec nextspark prepare --production` and `pnpm exec nextspark build` fail before `next build` when the build environment proves no login method can authenticate, with explicit runtime-only declarations and one documented bypass; production startup logs a safe error when none can. The interactive project wizard collects a Resend and/or Google provider (validated with the same rules, written only to `.env`) or marks the project local-only; `--yes`, quick mode and presets postpone. A fresh wizard project now receives `instrumentation.ts`, which calls the startup check; an existing host that doesn't have one copies core's `templates/instrumentation.ts` into its root once (`nextspark sync:app`, which used to add it, was removed in this release). | Validate a real provider end-to-end. Projects whose build script runs `next build` directly skip the build check. Existing hosts must apply the [documented readiness and invitation-route upgrade guards](../06-authentication/12-passwordless-preset.md#upgrading-existing-hosts); a missing route makes the new shared UI fail closed. A host with its own customized `instrumentation.ts` still merges in the [startup check](../06-authentication/12-passwordless-preset.md#startup-re-validation) by hand. |
| [#203](https://github.com/NextSpark-js/nextspark/issues/203) | **Root-first layout (breaking).** A project is its own root: `nextspark.config.ts` marks it, the former `contents/themes/<active>/` paths live at the root, the generated host lives in `src/app`, and `NEXT_PUBLIC_ACTIVE_THEME` is gone ([source contract](../01-fundamentals/07-root-first-source-contract.md)). This repository moved to it. `pnpm exec nextspark migrate` moves a 0.x project; see [Breaking: the root-first layout](#breaking-the-root-first-layout). A plugin published to npm is enabled by listing its package name in `plugins`, and a local `plugins/<name>` of the same name shadows it. `pnpm exec nextspark prepare` is shared by `build`, `registry:build` and one-shot `generate`, with startup/failure guards and `prepare --watch` cancellation handling. | Experimental generated-host roadmap work, including generated/mobile host validation, remains pending. |
| [#204](https://github.com/NextSpark-js/nextspark/issues/204) | The merged theme-proxy boundary preserves core access checks around theme results and fails unsafe rewrite targets closed. Gate G3 now has an automated check: `pnpm pkg:verify-tarballs`, which `pnpm pkg:publish` now runs over the packed tarballs before publishing, and which `pack.sh` prints as the next step. It fails when a packed package is missing a declared entry point, export target, type or binary, keeps a `workspace:`/`link:`/`file:` protocol or an unparseable internal version, or ships a maintainer-local path, an `.env` file, key material, a cache or a coverage report. With `--expect-all` it also fails when a publishable package has no `files` allowlist, or a plugin directory is neither shipped nor deliberately excluded. A G1 dependency triage is recorded in the release evidence; its applicable findings are fixed below. | Applicable [#204](https://github.com/NextSpark-js/nextspark/issues/204) follow-up gates and broader host validation remain pending. |

## Upgrade and validation status

Before a stable-web release decision, real-provider web end-to-end coverage, a registry upgrade check after publication, and applicable [#204](https://github.com/NextSpark-js/nextspark/issues/204) gates remain pending. Optional catalog breadth and the full experimental generated/mobile-host roadmap are not automatic stable-web blockers. The CLI test previously reported as a pnpm 9 extglob failure was a version-dependent expectation (temporary projects ran a newer global pnpm that rejects extglob workspaces); it now follows the running pnpm and the CLI suite passes.

A post-commit tarball clean-install and beta.191→beta.192 upgrade validation run found three delivery/build blockers: a `proxy.ts` template TypeScript strict-null error that failed `next build`'s type-check for every fresh project, `instrumentation.ts` never being copied into a generated project (so the startup check above never ran), and local-tarball dependency discovery missing `@nextsparkjs/testing`, which `packages/core/package.json` then still listed as a runtime dependency, which broke every tarball-based install and upgrade until that version is published. The first two are fixed. `@nextsparkjs/testing` is no longer a runtime dependency of `@nextsparkjs/core` at all: nothing in core imports it (only comments point consumers at it), and it is now a direct devDependency every generated project declares for itself, matching the monorepo themes' own `peerDependencies` on it. A re-run against the fixes showed:

- A fresh project created from the tarballs installs, migrates, builds and starts with no manual steps, and receives `instrumentation.ts`. `@nextsparkjs/testing` resolves the same direct way as `@nextsparkjs/core`, `cli` and `ui`: create-nextspark-app installs it from its own local tarball (`.packages/nextsparkjs-testing-<version>.tgz`) when one matches the local core tarball's version, and the wizard pins it to the CLI's own version from the registry otherwise. No hand-added `pnpm.overrides` entry is needed for it any more.
- A beta.191 host upgraded to the tarballs built and started after `pnpm exec nextspark sync:app` and the documented route guards (that run predates the removal of `sync:app` described below; upgrade now with `pnpm exec nextspark migrate`). `update-core` only re-pins an `@nextsparkjs/*` package already listed in the project's `dependencies`/`devDependencies`; a beta.191 (or earlier) project never listed `@nextsparkjs/testing` there, since it arrived transitively through core's own dependency. After upgrading, a project whose Cypress tests import it (the starter theme's `BasePOM`, `DashboardEntityPOM`, `ApiInterceptor`, or a project's own tests) must add `@nextsparkjs/testing` to its own `devDependencies` by hand, at the same version as `@nextsparkjs/core` -- from the registry once beta.192 is published, or as a `file:` local tarball while testing against unpublished tarballs.

An upgrade from the registry after publication is expected to need only that one hand-added devDependency, never a `pnpm.overrides` entry. This has not been verified, and that check remains pending. This status is not a release certification.

## Breaking: the root-first layout

Every 0.x project must move to the root-first layout before it can run on this line. The move is one command, run from the project root on a clean git tree, after upgrading `@nextsparkjs/cli` and `@nextsparkjs/core`:

1. `pnpm exec nextspark migrate --dry-run` reports what will move, what will be rewritten, and what needs attention, without writing anything.
2. `pnpm exec nextspark migrate --yes` performs the move. On any failure it stops, and prints rollback commands that return the tree exactly to its state before migrating, including ignored files it overwrote.
3. `pnpm dev` or `pnpm build` generates the host. There is nothing else to apply: `nextspark sync:app` and core's postinstall write were removed in this release ([timeline](./05-sync-app-removal)), and `src/app` is generated and git-ignored from now on. See [Upgrading a 0.x project](./06-upgrade-0x-projects).

What the move does:
- It moves the active theme's files to the root and local plugins to `plugins/`, and rewrites the project's imports and aliases, its package scripts that point at renamed core scripts, and moved `tsconfig` and Jest configs.
- It rewrites calls to the removed `hasThemeMiddleware`, `executeThemeMiddleware` and `getThemeAppConfig` to their project-wide replacements, and fails on call shapes it cannot rewrite safely.
- It creates `nextspark.config.ts` with the plugins the theme declared.
- It converts the old app tree (`app/`, or a committed `src/app/`) and generates the host in `src/app`. A file is removed only when it is proven to be generated: by an intact generated tag, a sync-state hash, a byte match with the templates of the core version the project used before (found in git history or lockfiles; its templates are fetched once, with a timeout), or exactly what the generator emits for that route. A file the project customized becomes an override under `templates/` or `api/` and is reported with a diff; a file the project added moves there too; a file whose shape it does not recognize stops the migration before anything is written. It also declares billing webhook extensions in `nextspark.config.ts`, lists the project URLs that move from `/api/v1/theme/**` and `/api/v1/plugin/**` to `/api/**` and `/api/plugins/<plugin>/**`, and writes `src/proxy.ts` when the project has none.

Validated on a real 113-template project (a pnpm monorepo on beta.183): it migrated with no manual edit, built all 128 routes, classified all 136 legacy host files as generated by beta.183, and kept 457 of its 460 test suites passing. The other 3 assert the pre-beta.190 behavior listed below.

An import of the legacy middleware that migrate cannot rewrite safely (anything other than a named `middleware` import, aliased or not) stops the move and names the file and line. If the installed `@nextsparkjs/core` is older than the CLI and lacks the route manifest the conversion needs, migrate stops before writing anything and asks to upgrade core first.

Projects upgrading from a release older than beta.190 also receive these intentional changes, which a project's own tests may assert against:
- The generated proxy enforces the roles `/superadmin` and `/devtools` need, instead of relying on client-side guards alone.
- Docs pages the registry lacks answer 404 in the proxy, and docs visibility honors a legacy `docs.public: false`.
- Generic entity create and update schemas reject unknown body fields with `400 VALIDATION_ERROR` instead of dropping them silently (#97). An API client that sends fields outside an entity's configured schema must stop sending them. Update schemas are wrapped in `z.preprocess`, so they no longer expose `.shape`.

## Also in this prerelease

Fixes found while validating the release, each with an independent cross-family review:

- **Client JS per route (#192).** A route a project overrides used to resolve its template at runtime through a registry indexed by a variable, so every template stayed reachable from it. The generated host writes each override as a static facade that imports exactly one component, so an overridden route carries the same client chunks as a project-only route. `node scripts/performance/host-conformance.mjs` checks that on real builds.
- **Calendar remounts (#205).** The calendar passed three components defined inline in its render to DayPicker, so every parent render remounted the whole day grid and re-ran its focus effects. They are module-level now.
- **Cypress type-checking in generated projects.** The shipped `tsconfig.cypress.json` could not resolve package `exports` subpaths.
- **Server-only data in every page's client JS (#207).** The root layout's theme provider imported the full theme registry, so every page shipped dashboard and dev configuration. It now reads small client-safe modules. The dev keyring and its configuration load only in development, and `scripts/security/verify-no-dev-credentials.mjs` checks a production build for dev credentials. On a production build of the dev app, gzip client JS: `/login` 197 → 147 KB, public home 189 → 135 KB, dashboard 233 → 185 KB.
- **Published plugins ship only what they need.** No plugin declared a `files` allowlist, so tarballs could carry local coverage reports, tests or stray tarballs. Each plugin now declares one, and the release check fails if an allowlist would drop a directory the compiler reads.
- **Audit log (#206).** Entries were never written, because the table had no insert policy for the application role (migration 028).
- **Local tarballs.** A project created from locally packed core now resolves `@nextsparkjs/ui` from its local tarball too.
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

On a clean install (`pnpm install --frozen-lockfile` with no inherited `node_modules`) of `7df6989d`, on this machine:

| Suite | Result |
| --- | --- |
| CLI | 391 passing, 1 unchanged skip |
| Core Node | 273 passing |
| Core Jest | 3,924 passing, 9 unchanged skips, 198 suites |
| Registry scripts | 308 passing |
| Dev app | registry build, type-check and production build (121 pages) clean |
| Release scripts | `scripts/packages`, `scripts/performance` and `scripts/security` tests passing; `pnpm pkg:verify-tarballs` passes for all 12 packages |

The tarball clean-install and the beta.191 upgrade were run earlier on this line, not on the final commit: a fresh project from the packed tarballs installed, migrated, built and started without manual steps, and a beta.191 host upgraded after `pnpm exec nextspark sync:app` and the documented route guards. Both should be re-run on the final artifacts before publishing. Logs for these runs and for the independent reviews live in the release evidence folder for this line, outside the repository.

This is not a release certification: no push, tag or publication has been made, and the pending items above still stand.
