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
