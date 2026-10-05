# Preparing src/app and the registries

`nextspark prepare` generates the host of a project: every file of `src/app` (a facade per core route, plugin route, project template, project API route and entity) and the registries in `.nextspark/registries`, published together and recorded in `.nextspark/generation.json`. See [Generated host](../01-fundamentals/08-generated-host.md) for what is generated and why.

```sh
nextspark prepare
nextspark prepare --production
nextspark prepare --check
nextspark prepare --watch
```

- `--production` runs the registry compiler with `NODE_ENV=production` (except for that override, environment variables passed to the command win over the project `.env`), then the [production auth readiness check](../06-authentication/12-passwordless-preset.md#production-readiness-check), which fails preparation when no configured login method can authenticate (declare runtime-injected providers with `NEXTSPARK_AUTH_RUNTIME_ONLY`; `NEXTSPARK_AUTH_PREFLIGHT=off` is the only bypass).
- `--check` writes nothing: exit 0 when `src/app` and the registries match what `prepare` would generate, 1 listing what is missing, stale or foreign (`--dev` compares with the development host `nextspark dev` writes).
- `--watch` generates, then regenerates on source changes; a failed regeneration keeps the last valid `src/app`.

`nextspark build` runs `prepare --production` before `next build` (`--no-registry` skips the generation, not the checks: it needs `prepare --check` to find the host up to date, and the auth readiness check still runs). `nextspark dev` prepares, starts Next and keeps the watcher running. `registry:build`, `registry:watch` and `generate` are names for `prepare` and `prepare --watch`.

## What stops it

A preparation failure prevents Next from starting. The registry compiler's output is not streamed: warnings and failure diagnostics are shown when it finishes, bounded.

A project whose `src/app` is a committed app tree that `nextspark` did not generate is not prepared: `prepare`, `build` and `dev` fail pointing to `nextspark migrate`, which converts it ([upgrading 0.x projects](../17-updates/06-upgrade-0x-projects.md)). A file of `src/app` that was edited by hand after it was generated is foreign: preparation refuses before writing and names it.

## Installing without lifecycle scripts

In a generated project, no lifecycle script produces anything it needs. `@nextsparkjs/core`'s postinstall only prints a notice; `src/app` and `.nextspark/` are written by `nextspark prepare`, which `nextspark dev` and `nextspark build` (the `pnpm dev` and `pnpm build` scripts) run first. `pnpm install --ignore-scripts`, `ignore-scripts=true` in an `.npmrc`, or an install that does not approve a dependency's build all work: install, then `pnpm dev` or `pnpm build`. Measured on a new `starter` project from `0.1.0-beta.193` with pnpm 10.34, 11.28 and 12.9 (`--ignore-scripts`, and with the generated approval lists removed): build, `next start` and `nextspark dev` all work, with or without a separate prepare step.

- **Explicit preparation** is `pnpm build:registries` (`nextspark prepare`). Run it before invoking `next dev` or `next build` yourself: without `src/app`, Next stops with ``Couldn't find any `pages` or `app` directory``, which does not say the host has to be generated. `next start` needs only the output of a build.
- **Dependencies' own scripts.** The generated `pnpm-workspace.yaml` approves the builds it needs (`allowBuilds` for pnpm 11 and later, `onlyBuiltDependencies` for pnpm 10). Without that list pnpm 10 skips them with a warning, and pnpm 11 and 12 fail the install with `ERR_PNPM_IGNORED_BUILDS` unless `--ignore-scripts` is given; the app builds and serves in both cases.
- **Cypress** is the one dependency whose script does work you will notice: it downloads its binary (about 600 MB, from `download.cypress.io`) during install. With scripts off, run `pnpm exec cypress install` before `pnpm cy:open` or `pnpm cy:run`; set `CYPRESS_INSTALL_BINARY=0` to skip the download on a machine that never runs Cypress.
