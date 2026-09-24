# Translation Registry Architecture

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

## Inputs

The compiler merges translation sources from:

1. core defaults;
2. project-root `messages/` and `entities/*/messages/`;
3. enabled local plugins under `plugins/<name>/messages/` and
   `plugins/<name>/entities/*/messages/`.

The project root is discovered from `nextspark.config.ts`; no environment
variable selects a theme.

## Precedence

```text
core defaults < enabled plugin contributions < project source
```

Project messages therefore override replaceable framework and plugin defaults.
Conflicting project files are diagnosed rather than selected by filesystem
order.

## Output

The generator writes:

```text
.nextspark/registries/translation-registry.ts
```

Consumers import through:

```ts
import {
  loadThemeTranslation,
  getThemeLocales,
} from '@nextsparkjs/registries/translation-registry'
```

The compatibility API still accepts the generated project registry key, but
the registry contains only the current root-first project.

## Discovery

Translation discovery receives resolved paths from
`packages/core/scripts/build/registry/project-mode.mjs`. It never reconstructs
legacy theme or plugin paths.

```text
messages/<locale>.json
messages/<locale>/index.ts
entities/<entity>/messages/<locale>.json
plugins/<plugin>/messages/<locale>.json
plugins/<plugin>/entities/<entity>/messages/<locale>.json
```

## Troubleshooting

1. Check the locale filename and JSON/TypeScript syntax.
2. Run from the project tree containing `nextspark.config.ts`.
3. Confirm a local plugin is listed in `nextspark.config.ts`.
4. Rebuild with `pnpm build:registries`.
