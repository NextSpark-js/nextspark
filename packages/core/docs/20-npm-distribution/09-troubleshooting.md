# Distribution Troubleshooting

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

## Project not found

Run NextSpark commands from the directory containing `nextspark.config.ts`, or
one of its descendants. The same directory must contain `package.json` with a
non-empty `next` dependency.

```bash
ls nextspark.config.ts package.json
pnpm build:registries
```

## Configuration not loading

Validate the root-first configuration and project config files:

```bash
sed -n '1,160p' nextspark.config.ts
ls config/
pnpm exec tsc --noEmit
```

`nextspark.config.ts` must default-export `defineConfig(...)`. It has no theme
or sibling-project selector.

## Plugins not activating

```bash
ls plugins/
grep -n 'plugins:' nextspark.config.ts
pnpm build:registries
```

Each enabled name must match one immediate directory under `plugins/` and that
directory must contain `plugin.config.ts`.

## Features not disabling

Feature flags default to enabled. Set an explicit `false` in
`nextspark.config.ts`, then rebuild registries and the application.

## Project template changes not appearing

Catalog templates are copied once. After project creation, edit the project's
root-level files rather than the source catalog. If the project is being tested
as a catalog payload, extract it again into a clean temporary root before
running its suite.

## Generated output is stale

```bash
rm -rf .nextspark/registries src/app
pnpm build:registries
```

Only those generated roots may be recreated automatically. Do not remove or
overwrite project-owned source.
