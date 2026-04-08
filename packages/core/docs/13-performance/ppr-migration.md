# PPR Migration Guide (Next.js 16 + Partial Prerendering)

## Overview

Next.js 16 introduces **Partial Prerendering (PPR)** with `cacheComponents: true`. This enables a fully static shell that renders instantly from CDN, with dynamic content streamed via Suspense boundaries.

NextSpark supports PPR as an **opt-in** feature. Projects on Next.js 15 continue to work unchanged.

## Performance Impact

| Metric | Next.js 15 (baseline) | Next.js 16 + PPR |
|--------|----------------------|------------------|
| TTFB | 300-600ms | **3-6ms** |
| LCP (cache hit) | ~700ms | **100-140ms** |
| Render delay | ~493ms | **40-60ms** |
| CLS | 0.01 | **0.00** |
| Accessibility | 96 | **100** |

## Prerequisites

- Next.js **16.2.2+**
- React **19.2.4+**
- NextSpark core with PPR support

## Migration Steps

### 1. Update dependencies

```bash
pnpm add next@^16.2.2 react@^19.2.4 react-dom@^19.2.4
```

### 2. Enable cacheComponents in next.config

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
pnpm build:registries
```

With `cacheComponents: true` detected, the translation registry will now generate PPR-specific exports:
- `DEFAULT_LOCALE` — build-time locale from theme config
- `DEFAULT_THEME_MODE` — build-time theme mode from theme config
- `STATIC_MESSAGES` — pre-merged core + theme translations

### 5. Copy PPR layout

Replace your `app/layout.tsx` with the PPR-compatible version:

```bash
cp node_modules/@nextsparkjs/core/templates/app/layout.ppr.tsx app/layout.tsx
```

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

To disable PPR and revert to the default layout:

1. Remove `cacheComponents: true` from next.config
2. Restore the default layout: `npx nextspark sync:app --force`
3. Regenerate registries: `pnpm build:registries`
