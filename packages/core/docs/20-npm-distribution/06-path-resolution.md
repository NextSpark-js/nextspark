# Path Resolution

The registry compiler has one path-resolution owner:

```text
packages/core/scripts/build/registry/project-mode.mjs
```

Other discovery modules and generators consume its resolved paths and must not
reconstruct project, plugin, output, or core-package locations themselves.

## Project root

`findProjectRoot(startDir)` searches upward for the nearest
`nextspark.config.ts`. The containing directory is the project source root and
host root. `resolveProjectPaths()` also verifies that its `package.json`
declares a non-empty `next` dependency.

There is no environment selector, `--project` flag, active-project field, or
sibling-project search.

## Owned paths

The module resolves:

- root-first project source directories
- `plugins/`
- generated `src/app/`
- generated `.nextspark/registries/`
- `.nextspark/backups/`
- `tests/cypress/fixtures/`
- the core package directory in repository and installed-package modes

It also owns project and plugin import helpers so discovery records use `@/*`
and `@/plugins/*` consistently.

## Repository and installed modes

In this pnpm monorepo, core resolves from `<workspace>/packages/core`. In an
installed project, it resolves from `node_modules/@nextsparkjs/core`. Consumers
must use the resolved `coreDir` rather than count parent-directory segments.
