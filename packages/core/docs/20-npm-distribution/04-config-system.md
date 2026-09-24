# Configuration System

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

Generated projects are root-first. The required `nextspark.config.ts` lives
beside `package.json` and identifies the project root; it does not select a
nested theme.

## Compiler configuration

```ts
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['langchain'],
  features: {
    billing: true,
    teams: true,
    superadmin: true,
    aiChat: true,
  },
  template: {
    name: 'starter',
    version: '0.1.0-beta.193',
  },
})
```

- `plugins` contains local directory names under `plugins/`.
- `features` controls build-time inclusion.
- `template` records scaffold provenance only.
- `database`, `auth`, and `app` are accepted for runtime/tooling metadata.

Selector fields such as `theme`, `project.root`, and `activeProject` are not
part of the root-first schema.

## Application configuration

Product configuration remains project-owned under `config/`:

```text
config/
├── app.config.ts
├── billing.config.ts
├── dashboard.config.ts
├── dev.config.ts
├── features.config.ts
├── permissions.config.ts
└── theme.config.ts
```

The compiler discovers those files directly from the project root. Local
plugins are enabled only by the `plugins` list in `nextspark.config.ts`; there
is no fallback to a theme config.

## Validation and discovery

`defineConfig` validates the public shape. Compiler commands search upward for
the nearest `nextspark.config.ts` and require the same directory's
`package.json` to declare `next`.

```bash
ls nextspark.config.ts package.json config/
pnpm build:registries
```

Generated registries are written to `.nextspark/registries/`, and the generated
host lives under `src/app/`.
