# `sync:app` and the postinstall write: removal timeline

`nextspark sync:app` copied core's app files into a project, and core's postinstall ran it after every install. Both are **removed in `0.1.0-beta.192`**. They were not deprecated first: the framework is not public, every existing project belongs to the team that runs it, and each of them migrates once with `nextspark migrate`.

This is the published timeline for RFC #203, acceptance criterion 12 ("`sync:app` and the postinstall write are removed in beta.192").

| Release | `nextspark sync:app` | Core's postinstall | `src/app` |
| --- | --- | --- | --- |
| up to `0.1.0-beta.191` | The way to keep `src/app` and a few root files (`next.config.mjs`, `tsconfig.json`, `i18n.ts`, `instrumentation.ts`, the proxy) in step with core | Runs `nextspark sync:app --force` when the CLI is installed | Committed; a copy of core's route files, tagged so sync knows which it wrote |
| `0.1.0-beta.192` | **Removed.** The command does not exist (`error: unknown command 'sync:app'`), and neither does its code, its tests or the `sync:templates` scripts that fed it | **Writes nothing.** It prints one notice, only in a project that still has a committed `src/app` or `app/`, telling it to run `nextspark migrate` | **Generated and git-ignored.** `nextspark dev`, `build` and `prepare` write all of it; the wizard creates no `src/app` |
| later | Not coming back | Not coming back | Same |

## What replaces each thing `sync:app` did

| It used to | Now |
| --- | --- |
| Copy core's route files into `src/app` | `nextspark prepare` (also run by `dev` and `build`) generates thin files that re-export `@nextsparkjs/core/routes/*`. Core's `package.json` ships the route modules; it no longer ships `templates/app`. |
| Keep the files you customized | You never edit `src/app`. A project changes a route by putting a file at the same path in `templates/` (pages, layouts, loading and error files, ...) or, for a Route Handler, in `api/` |
| Update the registries | `prepare` builds them in the same run |
| Rewrite `next.config.mjs`, `tsconfig.json`, `i18n.ts`, `instrumentation.ts` and the proxy | Nothing. These are project files, written once by the wizard. A release that needs a change in one says so in its notes. A project without `instrumentation.ts` copies core's `templates/instrumentation.ts` |
| Move the proxy next to `src/app` | The wizard writes `src/proxy.ts` (`src/middleware.ts` on Next.js 15) and `nextspark migrate` writes it when a project has none |
| Run after `pnpm install` | Nothing runs after an install. `pnpm update-core` ends with `nextspark prepare` |

## Upgrading

- A project with a committed `src/app` (or `app/`): follow [Upgrading a 0.x project](./06-upgrade-0x-projects.md). `nextspark migrate` removes the files core generates, turns your customizations into `templates/` and `api/` files, and stops before writing if it cannot place one.
- A project created on `0.1.0-beta.192` or later has nothing to do.
- Scripts and CI that call `nextspark sync:app` fail with `unknown command`: replace the call with `nextspark prepare`.

## How this is enforced

- `pnpm pkg:pack` refuses to pack `@nextsparkjs/core` while a `packages/core/templates/app` exists, and `pnpm pkg:verify-tarballs` fails a core tarball that contains one, so the app tree cannot come back through the package.
- A test runs core's postinstall against a project with a committed `src/app` and asserts that the project is byte-for-byte unchanged and that no CLI was run.
