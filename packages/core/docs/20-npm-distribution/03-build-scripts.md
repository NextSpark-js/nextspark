# Build Scripts

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

## Root-first execution

Build scripts run from a NextSpark project root or one of its descendants. The
registry compiler delegates all path resolution to:

```text
packages/core/scripts/build/registry/project-mode.mjs
```

That module finds the nearest `nextspark.config.ts`, validates the root's
`package.json` and `next` dependency, and resolves project source, local
plugins, generated output, test fixtures, and the core package.

## Registry commands

```bash
pnpm build:registries
pnpm exec nextspark registry:watch
```

In this repository:

```bash
cd apps/dev
node ../../packages/core/scripts/build/registry.mjs --build
```

The build reads root-level source and enabled `plugins/<name>/` directories,
then writes `.nextspark/registries/` and generated host files under `src/app/`.

## Project styles

`src/app/globals.css` is the generated import adapter for the project-owned
`styles/globals.css`. Next.js compiles that stylesheet as part of `pnpm build`;
there is no separate theme-build command.

## Database migrations

```bash
pnpm db:migrate
pnpm db:verify-theme <template-name>
```

Project migrations resolve directly from the current project root. The
verification command may name a catalog template because it extracts and
checks that template as an independent project; it does not activate a theme
inside the running application.

## Rules

- Do not reconstruct source paths in individual scripts.
- Do not use an environment variable or CLI flag to select a project.
- Do not write outside compiler-owned generated roots unless the command is an
  explicit scaffold, migration, or synchronization operation.
- Use `pnpm`, never `npm`, for repository scripts.
