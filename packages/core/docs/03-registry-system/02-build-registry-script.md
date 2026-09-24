# Registry Build Script

## Purpose

`packages/core/scripts/build/registry.mjs` compiles a single root-first
NextSpark project into deterministic registries and a generated Next.js host.
It does not select or scan theme directories.

## Project discovery

All compiler paths are owned by
`packages/core/scripts/build/registry/project-mode.mjs`.

1. Starting at the current working directory, find the nearest
   `nextspark.config.ts`.
2. Treat that directory as the project, source, configuration, and host root.
3. Require its `package.json` to declare a non-empty `next` dependency.
4. Load and validate `nextspark.config.ts`.
5. Read project source directly from the root and enabled local plugins from
   `plugins/<name>/`.

There is no environment selector, sibling-project search, or compatibility
fallback to the legacy layout.

## Commands

From a generated project root:

```bash
pnpm build:registries
pnpm exec nextspark registry:watch
```

From this repository's development project:

```bash
cd apps/dev
node ../../packages/core/scripts/build/registry.mjs --build
node ../../packages/core/scripts/build/registry.mjs --watch
```

Useful flags:

```text
--build       build once and exit
--watch, -w   rebuild when project inputs change
--verbose, -v print detailed discovery information
```

## Inputs

The compiler reads these project-root surfaces when present:

```text
api/
blocks/
components/
config/
entities/
lib/
messages/
styles/
templates/
tests/cypress/fixtures/
plugins/<enabled-plugin>/
```

Enabled local plugin names come from the `plugins` array in
`nextspark.config.ts`. Entries are logical directory names, not paths.

Core defaults are resolved from `packages/core` in this monorepo or from the
installed `@nextsparkjs/core` package in a generated project.

## Outputs

The compiler owns only:

```text
src/app/
.nextspark/registries/
```

Project source outside those generated roots is never overwritten. Registry
imports use `@nextsparkjs/registries/*`; project imports use `@/*`; local plugin
imports use `@/plugins/*`.

The registry directory intentionally remains `.nextspark/registries`. Renaming
it would touch dozens of consumers without a user-visible benefit.

## Discovery and precedence

Discovery normalizes core, project, and enabled-plugin contributions before
any generator emits files. The source precedence is:

```text
core defaults < project source < generated output
```

Protected framework routes and other guarded collisions fail with diagnostics
rather than being replaced silently. `api/` and `templates/` are distinct
source surfaces and route collisions are diagnosed before generation.

## Generated registries

The build emits the registry set under `.nextspark/registries/`, including
entity, block, plugin, project/theme, translation, permissions, billing,
documentation, template, route-handler, middleware, and test metadata.
Generation is deterministic apart from documented timestamps.

The project/theme registry contains exactly one project-owned entry. Existing
runtime theme APIs remain available for compatibility, but they do not perform
project selection.

## Watch mode

Watch mode observes the root-first source directories and enabled local plugin
directories. Changes are debounced and rebuild only generated output. Adding a
new local plugin also requires adding its name to `nextspark.config.ts`.

## Troubleshooting

### No NextSpark project found

Run the command from the directory containing `nextspark.config.ts`, or one of
its descendants.

### Invalid project root

Ensure the same directory has `package.json` and that `next` is declared in
`dependencies` or `devDependencies`.

### Plugin not found

Ensure `plugins/<name>/plugin.config.ts` exists and `<name>` is listed in
`nextspark.config.ts`.

### Stale generated output

Delete only generated artifacts if necessary, then rebuild:

From a generated project root:

```bash
rm -rf .nextspark/registries src/app
pnpm build:registries
```

Do not edit generated files by hand.
