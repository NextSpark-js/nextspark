# Build Process

## Introduction

Understanding the build process is essential for effective development. This guide explains what happens when you run `pnpm dev` or `pnpm build`.

---

## The 6-Step Build Pipeline

When you run `pnpm dev`, these processes execute in order:

```text
1. TypeScript Config  (2-3s)   → update-tsconfig.mjs
2. Theme Build        (2-3s)   → build-theme.mjs
3. Registry Build     (5-10s)  → build-registry.mjs
4. Docs Index         (1-2s)   → build-docs-registry.mjs
5. Plugin Dev         (1-2s)   → turbo dev
6. Next.js Dev        (2-3s)   → next dev --turbopack

Total: 10-15 seconds
```

---

## Step 1: TypeScript Config Update

**Script:** `core/scripts/build/update-tsconfig.mjs`

**What it does:**
- Excludes inactive themes from TypeScript checking
- Improves TS performance
- Prevents errors from unused themes

**Example:**
```typescript
// If NEXT_PUBLIC_ACTIVE_THEME=default
// Excludes: contents/themes/!(default)/**/*
```

**Why it matters:**
- Faster type checking
- No false errors from inactive themes
- Better IDE performance

---

## Step 2: Theme Build

**Script:** `core/scripts/build/theme.mjs --watch`

**What it does:**
1. Compiles CSS from `contents/themes/default/styles/`
2. Outputs to `app/theme-styles.css`
3. Copies public assets to `public/theme/`
4. Watches for changes (in dev mode)

**Input:**
```text
contents/themes/default/
├── styles/
│   ├── globals.css
│   ├── components.css
│   └── utilities.css
└── public/
    ├── brand/
    └── images/
```

**Output:**
```text
app/theme-styles.css          # Compiled CSS
public/theme/                 # Copied assets
```

**Watch mode:**
- Detects CSS file changes
- Auto-recompiles
- Hot reloads in browser

**⚠️ Auto-generated - never edit manually**

---

## Step 3: Registry Build (CRITICAL)

**Script:** `core/scripts/build/registry.mjs --watch`

**What it does:**
1. Scans `contents/themes/` for entities, configs
2. Scans `contents/plugins/` for plugin configs
3. Generates static registries in `core/lib/registries/`

**Performance:**
- **Runtime loading:** ~140ms per entity
- **Build-time registry:** ~6ms total
- **Improvement:** ~17,255x faster

**Generated files:**
```text
core/lib/registries/
├── entity-registry.ts           # Server-only
├── entity-registry.client.ts    # Client-safe
├── plugin-registry.ts           # Server-only
├── plugin-registry.client.ts    # Client-safe
├── theme-registry.ts
├── translation-registry.ts
├── route-handlers.ts
├── config-registry.ts
└── docs-registry.ts
```

**Why this is critical:**
- Zero runtime I/O
- Static type checking
- Instant cold starts
- No dynamic imports

**Watch mode:**
- Detects entity/plugin changes
- Auto-regenerates registries
- Requires server restart for changes

**⚠️ Auto-generated - never edit manually**

**See:** [Architecture Patterns → Registry-Based Loading](../01-fundamentals/04-architecture-patterns.md#registry-based-loading-pattern)

---

## Step 4: Documentation Index

**Script:** `core/scripts/build/docs.mjs`

**What it does:**
- Scans `core/docs/**/*.md`
- Parses frontmatter and headings
- Creates searchable index
- Generates navigation

**Output:**
```text
core/lib/registries/docs-registry.ts
```

**Enables:**
- Fast documentation search
- Auto-generated navigation
- Metadata indexing

---

## Step 5: Plugin Development

**Tool:** Turbo (monorepo orchestration)

**What it does:**
- Starts dev servers for plugins
- Coordinates dependencies
- Enables hot reload

**Command:**
```bash
turbo dev --filter='@nextspark/plugin-*'
```

**Why it matters:**
- Plugin isolation
- Parallel development
- Fast rebuilds

---

## Step 6: Next.js Dev Server

**Command:** `next dev --turbopack -p 5173`

**What it does:**
- Starts Next.js on port 5173
- Uses Turbopack (faster than Webpack)
- Enables Hot Module Replacement (HMR)

**Features:**
- Fast refresh (< 100ms)
- TypeScript compilation
- Route generation
- API route hot reload

---

## Production Build

**Command:** `pnpm build`

**Pipeline:**
```text
1. TypeScript Config  → update-tsconfig.mjs
2. Theme Build        → build-theme.mjs
3. Registry Build     → build-registry.mjs --build
4. Docs Index         → build-docs-registry.mjs
5. Next.js Build      → next build

Total: 2-3 minutes
```

**Differences from dev:**
- No watch modes
- Optimized bundles
- Static generation
- Code minification

**Output:**
```text
.next/
├── static/           # Static assets
├── server/           # Server bundles
└── standalone/       # Standalone server
```

---

## Auto-Generated Files (Never Edit)

**These are regenerated every build:**

```text
# Next.js build
.next/

# Registry files
core/lib/registries/*.ts

# Theme CSS
app/theme-styles.css

# Theme assets
public/theme/
```

**To make changes:**
- **Entities:** Edit in `contents/themes/*/entities/`
- **Plugins:** Edit in `contents/plugins/`
- **Theme:** Edit in `contents/themes/*/styles/`
- **Rebuild:** Run `pnpm registry:build` or restart `pnpm dev`

---

## Manual Build Commands

**Registry:**
```bash
pnpm registry:build         # One-time build
pnpm registry:build-watch   # Watch mode
```

**Theme:**
```bash
pnpm theme:build            # One-time build
```

**Docs:**
```bash
pnpm docs:build             # One-time build
```

**All:**
```bash
pnpm build                  # Production build
```

---

## Build Performance

**Normal times:**
- Dev startup: 10-15 seconds
- Registry build: 5-10 seconds
- Theme build: 2-3 seconds
- Production build: 2-3 minutes

**If slower:**
- Check CPU usage
- Clear caches (`rm -rf .next`)
- Close unnecessary apps
- Check for file watcher limits

**See:** [Troubleshooting → Slow Build Times](./08-troubleshooting.md#slow-build-times)

---

## Summary

**6-step pipeline:**
1. TypeScript config (excludes inactive themes)
2. Theme build (CSS + assets)
3. **Registry build** (CRITICAL - ~17,255x faster)
4. Docs index (searchable docs)
5. Plugin dev (monorepo coordination)
6. Next.js dev (Turbopack)

**Key points:**
- Registry build eliminates runtime I/O
- Auto-generated files never edit
- Watch modes auto-rebuild
- Production build optimizes

**Next:** [Running Locally](./05-running-locally.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
