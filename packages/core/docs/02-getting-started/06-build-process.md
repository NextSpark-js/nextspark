# Build Process

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark prepare --watch`.

## Introduction

The root `dev` and `build` scripts delegate to `apps/dev`, which runs `nextspark dev` and `nextspark build`. Both generate `src/app` and the registries (`prepare`) before Next.js runs; `dev` then keeps a watcher that regenerates on change.

---

## Development Server

```bash
pnpm dev
```

The root script delegates to the app package, which runs:

```text
dotenv -e .env -- sh -c 'node ../../packages/cli/dist/cli.js dev --turbopack -p $PORT'
```

`PORT` comes from `apps/dev/.env`. The measured checkout used port 3010. Next.js watches application code and the theme CSS imported by the generated root layout (`apps/dev/src/app/layout.tsx`).

---

## Registry Build

`pnpm dev` and `pnpm build` already generate the registries. Run `prepare` explicitly when you want generation without starting Next.js:

```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare
```

For a standalone watcher (`pnpm dev` already includes one):

```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare --watch
```

The registry builder writes `.nextspark/registries/`, including `docs-registry.ts`, and updates generated template files. `nextspark dev` runs the same generation on every change and serves it without a restart.

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
# Development server (generates, then watches and regenerates)
pnpm dev

# Registry generation only
cd apps/dev && node ../../packages/cli/dist/cli.js prepare

# Registry watch mode on its own
cd apps/dev && node ../../packages/cli/dist/cli.js prepare --watch

# Production build (generates first, then builds)
pnpm build
```

---

## Summary

- `pnpm dev` generates the registries, then runs Next.js and regenerates on change.
- `pnpm build` generates the registries before it builds.
- Next.js compiles the theme CSS imported by the generated root layout (`apps/dev/src/app/layout.tsx`).

**Next:** [Running Locally](./07-running-locally.md)
