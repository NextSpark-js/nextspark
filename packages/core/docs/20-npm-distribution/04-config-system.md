# Configuration System

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/cli/dist/cli.js prepare` (add `--watch` to watch).

Generated projects are root-first. The required `nextspark.config.ts` lives
beside `package.json` and identifies the project root; it does not select a
nested theme.

## Compiler configuration

```ts
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['@nextsparkjs/plugin-langchain'],
  features: {
    billing: true,
    teams: true,
    superadmin: true,
    aiChat: true,
  },
  template: {
    name: 'starter',
    version: '0.1.0-beta.192',
  },
})
```

- `plugins` contains local directory names under `plugins/` or scoped package
  names declared by the project, such as `@nextsparkjs/plugin-langchain`.
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

The compiler discovers those files directly from the project root. Local and
packaged plugins are enabled only by the `plugins` list in
`nextspark.config.ts`; there is no fallback to a theme config and no scan of
`node_modules`.

A packaged plugin ships TypeScript source, so its package must also be in
`transpilePackages` in `next.config.*`:

```js
transpilePackages: ['@nextsparkjs/core', '@scope/plugin-name'],
```

`nextspark prepare` checks this before it generates anything and stops with
`NS_PLUGIN_TRANSPILE_MISSING`, naming the package and the line to set; without
it `next build` fails with "Unknown module type". `prepare` reads the config as
text, so a `transpilePackages` it cannot read (a spread, a variable) is only a
warning (`NS_PLUGIN_TRANSPILE_UNREADABLE`): check the list yourself. Local
plugins under `plugins/` are not affected.

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
