# Registry System

NextSpark compiles project and plugin source into static TypeScript registries.
Runtime code imports those registries instead of scanning the filesystem or
loading configuration dynamically.

## Source and output

The compiler starts at the nearest directory containing `nextspark.config.ts`.
That directory is the project root. It reads project contributions directly
from root directories such as `entities/`, `blocks/`, `templates/`, `api/`,
`messages/`, and `config/`. It reads enabled local plugin contributions only
from `plugins/<name>/`, where `<name>` appears in the config's `plugins` array.

Generated files are written to:

```text
.nextspark/registries/       # Static registries and manifests
src/app/                     # Generated Next.js adapter
```

Both directories are generated output. Do not edit them manually.

## Build-time flow

```text
nextspark.config.ts
        │
        ▼
resolve one project root
        │
        ├── scan project source directories
        ├── scan enabled plugins/<name>/ directories
        ├── validate collisions and contribution metadata
        └── generate static TypeScript imports
                 │
                 ├── .nextspark/registries/
                 └── src/app/
```

The path-resolution contract is centralized in
`packages/core/scripts/build/registry/project-mode.mjs`. Discovery modules and
generators consume its resolved paths rather than reconstructing layouts.

## Running the compiler

From a generated project:

```bash
pnpm exec nextspark registry:build
pnpm exec nextspark registry:watch
```

From the repository development project:

```bash
cd apps/dev
node ../../packages/core/scripts/build/registry.mjs --build
node ../../packages/core/scripts/build/registry.mjs --watch
```

Registry inputs require regeneration. Restart the development server when a
changed generated module is not picked up by hot reload.

## Runtime usage

```ts
import {
  ENTITY_REGISTRY,
  PLUGIN_REGISTRY,
  THEME_REGISTRY,
} from '@nextsparkjs/registries'

const task = ENTITY_REGISTRY.tasks
const enabledPlugins = PLUGIN_REGISTRY
const projectPresentation = THEME_REGISTRY.starter
```

`THEME_REGISTRY` remains a runtime compatibility name for the single compiled
project presentation; it does not imply runtime template or project selection.
There is no filesystem fallback at runtime.

## Precedence

The source contract uses this ownership order:

```text
core defaults < project source < generated output
```

Generated output materializes the resolved inputs and is the runtime import
surface. This ordering does not permit project source to replace protected
framework routes, authentication invariants, permission enforcement, or
migration history; such collisions fail or use an explicit composition rule.

## Rules

1. Keep `nextspark.config.ts` at the project root.
2. Add project source to the named root directories.
3. Add a local plugin at `plugins/<name>/` and enable its name in the config.
4. Import generated registries at runtime; do not dynamically discover source.
5. Never hand-edit `.nextspark/registries/` or generated `src/app/` files.
6. Rebuild registries before type-checking or building after source changes.

## Main registries

The compiler generates registries for entities, plugins, templates, route
handlers, translations, permissions, billing, blocks, documentation, tests,
and other framework contribution types. Import them through
`@nextsparkjs/registries` or its documented subpaths.

See [Build Registry Script](./02-build-registry-script.md),
[Entity Registry](./03-entity-registry.md), and
[Enforcement and Validation](./11-enforcement-and-validation.md).
