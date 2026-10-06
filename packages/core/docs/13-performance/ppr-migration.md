# PPR Migration Guide (Next.js 16 + Partial Prerendering)

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark prepare --watch`.

## Overview

Next.js 16 introduces **Partial Prerendering (PPR)** with `cacheComponents: true`. This enables a fully static shell that renders instantly from CDN, with dynamic content streamed via Suspense boundaries.

Cache Components + PPR is the **default for new projects**: the scaffold's `next.config.mjs` sets `cacheComponents: true`. Legacy ISR stays supported with `cacheComponents` off. Projects created earlier keep working unchanged; the steps below turn PPR on for them.

## Performance Impact

The static shell is served from the cache or CDN and the dynamic parts stream in behind Suspense boundaries, so the first bytes do not wait on dynamic data. The repository has no script that measures TTFB or LCP before and after, so no figures are quoted; measure your own routes with Lighthouse or your RUM.

## Prerequisites

- Next.js **~16.3.6** (the version core pins)
- React **19.2.4+**
- NextSpark core with PPR support

## Migration Steps

### 1. Update dependencies

```bash
pnpm add next@~16.3.6 react@^19.2.4 react-dom@^19.2.4
```

### 2. Enable cacheComponents in next.config (already set in new projects)

```js
// next.config.mjs
const nextConfig = {
  cacheComponents: true,
  // ... existing config
}
```

### 3. Rename middleware to proxy

Next.js 16 renames the middleware file:

```bash
mv middleware.ts proxy.ts
```

Update import paths if needed (the API is the same).

### 4. Regenerate registries

```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare
```

With `cacheComponents: true` detected, the translation registry will now generate PPR-specific exports:
- `DEFAULT_LOCALE` — build-time locale from theme config
- `DEFAULT_THEME_MODE` — build-time theme mode from theme config
- `STATIC_MESSAGES` — pre-merged core + theme translations

### 5. PPR layout

Nothing to copy: with `cacheComponents: true` in `next.config`, `nextspark prepare` emits the PPR root layout
(`@nextsparkjs/core/routes/layout.ppr`), core's `layout.cc.tsx` variants of the group layouts (auth, public, devtools,
superadmin, dashboard) and the cached public item pages by itself.

Key differences from the default layout:
- **Sync function** (not async) — enables PPR static shell
- **StaticIntlProvider** — bypasses `NextIntlClientProvider` which accesses headers/cookies
- **Build-time constants** — locale, theme mode, and messages imported from registry
- **No PluginService.initializeAll()** — plugins initialize on-demand

### 6. Add `'use cache'` to data fetchers (optional)

For maximum performance, add `'use cache'` to your data fetching functions:

```typescript
import { cacheLife, cacheTag } from 'next/cache'

export async function fetchPublishedLanding(slug: string) {
  'use cache'
  cacheLife('hours')
  cacheTag(`landing-${slug}`, 'all-landings')
  
  // ... DB query
}
```

This ensures:
- **Request 1** (cache miss): normal Suspense streaming
- **Request 2+** (cache hit): Suspense resolves instantly, render delay near-zero

### 7. Add cache revalidation

Call `revalidateTag()` when entities are saved:

```typescript
import { revalidateTag } from 'next/cache'

// In your entity service or API route:
revalidateTag(`landing-${slug}`)
```

Or use the entity hook system for automatic revalidation.

### Unknown URLs answer 200 with `noindex`

With `cacheComponents: true`, a URL that a catch-all `[slug]` route matches but that has no page answers **200 with `noindex`** (the visitor sees the not-found page). Legacy ISR answers 404. A 404 under Cache Components is a project recipe, a `proxyHook` rewrite to `/_not-found`: see [The status of a URL that has no page](../18-page-builder/07-public-rendering.md#the-status-of-a-url-that-has-no-page).

### 8. Verify

```bash
pnpm build
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm start
# Open http://localhost:3000 — first load warms cache, second load should be fast
```

## Wrap pages in Suspense

PPR requires async content inside `<Suspense>` boundaries. The core templates already wrap pages:

```tsx
// Pattern for all pages with async data
async function PageContent({ params }) {
  const data = await fetchData()
  return <div>{data}</div>
}

export default function Page(props) {
  return (
    <Suspense fallback={null}>
      <PageContent {...props} />
    </Suspense>
  )
}
```

## Rollback

To opt out of PPR and use legacy ISR (core's non-PPR layout):

1. Remove `cacheComponents: true` from next.config (or set it to `false`)
2. Regenerate the host and the registries: `pnpm exec nextspark prepare` (the root layout is core's default again)
