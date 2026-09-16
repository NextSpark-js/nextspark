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
4. Docs Registry      (1-2s)   → registry.mjs (active-theme docs)
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
3. Generates static registries in `.nextspark/registries/`

**Performance:**
- **Runtime loading:** ~140ms per entity
- **Build-time registry:** ~6ms total
- **Improvement:** ~17,255x faster

**Generated files:**
```text
.nextspark/registries/
├── api-docs-registry.ts
├── api-presets-registry.ts
├── billing-registry.ts
├── block-registry.client.ts
├── block-registry.lazy.ts
├── block-registry.ts
├── docs-registry.ts
├── email-registry.ts
├── entity-registry.client.ts
├── entity-registry.ts
├── entity-types.ts
├── icon-registry.ts
├── index.ts
├── mcp-registry.ts
├── middleware-registry.ts
├── namespace-registry.ts
├── permissions-registry.ts
├── plugin-registry.client.ts
├── plugin-registry.ts
├── route-handlers.ts
├── scheduled-actions-registry.ts
├── scope-registry.ts
├── template-registry.client.ts
├── template-registry.ts
├── testing-registry.ts
├── theme-registry.ts
└── translation-registry.ts
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

## Step 4: Documentation Registry

**Script:** `core/scripts/build/registry.mjs` (calls `generateDocsRegistry()` with Step 3)

**What it does:**
- Reads the active theme's `docs/public/` and `docs/superadmin/` directories
- Derives sections and pages from numbered directories and markdown files
- Generates navigation metadata for the public and superadmin documentation routes

**Output:**
```text
.nextspark/registries/docs-registry.ts
```

**Enables:**
- In-memory navigation metadata
- Static documentation routes
- Package imports through `@nextsparkjs/registries/docs-registry`

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
3. Registry Build     → registry.mjs (includes active-theme docs)
4. Next.js Build      → next build

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
.nextspark/registries/*.ts

# Theme CSS
app/theme-styles.css

# Theme assets
public/theme/
```

**To make changes:**
- **Entities:** Edit in `contents/themes/*/entities/`
- **Plugins:** Edit in `contents/plugins/`
- **Theme:** Edit in `contents/themes/*/styles/`
- **Rebuild:** Run `pnpm build:registries` or restart `pnpm dev`

---

## Manual Build Commands

**Registry:**
```bash
pnpm build:registries          # One-time build
nextspark registry:watch       # Watch mode
```

**Theme:**
```bash
pnpm theme:build            # One-time build
```

**Docs:**
```bash
pnpm build:registries  # Rebuilds every registry, including docs
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
4. Docs registry (active-theme public and superadmin docs)
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
