# Build Process

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark prepare --watch`.

## Introduction

The monorepo keeps the Next.js process and registry generation separate. The root `dev` and `build` scripts delegate to `apps/dev`; neither starts a set of theme, plugin, or registry workers.

---

## Development Server

```bash
pnpm dev
```

The root script delegates to the app package, which starts a single process:

```text
dotenv -e .env -- sh -c 'next dev --turbopack -p $PORT'
```

`PORT` comes from `apps/dev/.env`. The measured checkout used port 3010. Next.js watches application code and the theme CSS imported by the generated root layout (`apps/dev/src/app/layout.tsx`).

---

## Registry Build

Registry inputs are not watched by the root `pnpm dev` command. Build them explicitly when entity, plugin, theme configuration, template, translation, or documentation inputs change:

```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare
```

For a separate long-running watcher:

```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare --watch
```

The registry builder writes `.nextspark/registries/`, including `docs-registry.ts`, and updates generated template files. Restart the Next.js process when a regenerated import is not picked up automatically.

---

## Theme CSS and Assets

The monorepo has no `theme:build` or `theme:build-watch` package script. The generated root layout (`apps/dev/src/app/layout.tsx`, written by `nextspark prepare`) imports the project stylesheet directly, so Next.js compiles it during development and production builds.

```bash
test -f styles/globals.css
grep -F 'styles/globals.css' apps/dev/src/app/layout.tsx
```

Files served under `/theme/` live in `apps/dev/public/theme/`; they are not copied by `pnpm dev`.

---

## Production Build

If registry inputs changed, regenerate them first, then build the app:

```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare
cd ../.. && pnpm build
```

The root build delegates to `apps/dev`, where Next.js creates the production output under `apps/dev/.next/`. It compiles the imported theme CSS as part of the Next.js build.

---

## Command Reference

```bash
# Next.js development server
pnpm dev

# Registry generation
cd apps/dev && node ../../packages/cli/dist/cli.js prepare

# Registry watch mode (separate terminal)
cd apps/dev && node ../../packages/cli/dist/cli.js prepare --watch

# Production app build
pnpm build
```

---

## Summary

- `pnpm dev` starts one Next.js development process.
- Registry generation is a separate command in the monorepo.
- Next.js compiles the theme CSS imported by the generated root layout (`apps/dev/src/app/layout.tsx`).
- `pnpm build` builds the app but does not replace the explicit registry step.

**Next:** [Running Locally](./07-running-locally.md)
