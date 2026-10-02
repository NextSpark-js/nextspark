# Public Rendering

This document explains how pages created with the Page Builder are rendered on the public-facing website.

## Overview

Public pages are served through the routes `nextspark prepare` generates for both:
1. **Dynamic pages** created via the Page Builder
2. **Entity archives** from the entity system

Pages take priority over entity archives, allowing you to create custom landing pages for any URL.

## Route generation

`nextspark prepare` (and `nextspark dev`, which regenerates on changes) writes a **concrete public route for every builder entity** from its `access.basePath` configuration; there is no catch-all route and no runtime matching of the URL against the entity registry.

### How it works

1. **Entity facts**: the host reads `access.basePath`, `builder.enabled`, `ui.public.hasArchivePage` and `access.allowNestedSlugs` from each entity config, as literals.
2. **Route per entity**: a builder entity with a basePath gets `(public)<basePath>/[...slug]/page.tsx` (item pages; `[slug]` when nested slugs are off), and `(public)<basePath>/page.tsx` when it has an archive page.
3. **Template override**: a project template at `templates/(public)/<basePath>/[...slug]/page.tsx` is composed into that route at generation time.
4. **Default rendering**: `PageRenderer` renders the block content.

Next.js' own routing decides which route answers a URL (a static segment beats a dynamic one, a longer basePath beats `/`), so `/blog/my-post` reaches the `/blog` entity and `/about` reaches the entity whose basePath is `/`.

### Configuring Public URLs

Entity public URLs are configured via `access.basePath`:

```typescript
// pages.config.ts - Renders at /[slug]
access: {
  public: true,
  api: true,
  metadata: true,
  shared: true,
  basePath: '/',  // /about, /contact, /services
}

// posts.config.ts - Renders at /blog/[slug]
access: {
  public: true,
  api: true,
  metadata: true,
  shared: true,
  basePath: '/blog',  // /blog/my-first-post
}
```

### Which entity answers a URL

| URL | Entity | Reason |
|-----|--------|--------|
| `/blog/my-post` | posts | `/blog` has its own route |
| `/about` | pages | basePath `/` gives `[slug]` at the root |
| `/blog` | posts (archive) | Archive route of the entity (needs `ui.public.hasArchivePage: true`) |
| `/nonexistent` | pages (not found) | basePath `/` gives `[slug]` at the root, which matches any single segment; with no published page of that slug it calls `notFound()` (see below) |
| `/a/b/c` | 404 | No route matches |

## Per-entity public routes

**Location**: `(public)<basePath>/[...slug]/page.tsx`, one route per builder entity, written by `nextspark prepare` (nothing is served by a catch-all).

The generated route is a facade that statically imports the entity's config, and the project's item template when it has one (`templates/(public)/<basePath>/[...slug]/page.tsx`), and applies core's `createPublicItemRoute` to them. There is no runtime lookup of the entity from the URL and no template registry: a project template replaces the item page after the same checks, at build time.

```typescript
// Generated: src/app/(public)/blog/[...slug]/page.tsx
import { blogEntityConfig } from "@/entities/blog/blog.config"
import { createPublicItemRoute } from "@nextsparkjs/core/routes/_internal/public-item-route"
export default createPublicItemRoute(blogEntityConfig)
```

An entity with `ui.public.hasArchivePage` also gets `(public)<basePath>/page.tsx` (the archive). Rendering per item: published item query, `PageRenderer` with its blocks, `notFound()` when there is none.

### The status of a URL that has no page

A missing item calls `notFound()`, and what status the response carries depends on the rendering mode:

| Mode | `/nonexistent` (or `/blog/nonexistent`) | A URL no route matches (`/a/b/c`) |
|------|------------------------------------------|-----------------------------------|
| Legacy (`cacheComponents: false`) | **404** | **404** |
| Cache Components (default) | **200**, the not-found page and `<meta name="robots" content="noindex">` | **404** |

Under Cache Components the item route has a dynamic segment (`[slug]`), so Next sends the prerendered shell, with its 200, before the page reads the slug; the `notFound()` that follows arrives in the stream, and Next cannot change a status it has already sent. The visitor sees the not-found page and crawlers get `noindex`, but a client that only reads the status sees 200. Only a route with a closed list of params can answer 404 first (`dynamicParams = false`, which is how the docs pages do it); published pages are not a closed list. If you need the status, answer it in `src/proxy.ts` before anything renders: look the slug up and `NextResponse.rewrite(appUrl(request, '/_not-found'))`, as the template proxy does for a missing docs page.

The legacy 404 holds while nothing between the root layout and the page is a Suspense boundary: a project `(public)/layout` that wraps `children` in `<Suspense>`, or a `templates/(public)/loading.tsx` (an implicit boundary), brings the 200 back, for `notFound()` and for `redirect()` alike. Put a `loading.tsx` only next to pages that never call `notFound()` or `redirect()`, not at the group level; on the `[slug]` route it brings the 200 back too.

## PageRenderer Component

**Location**: `app/components/page-renderer.tsx`

The PageRenderer iterates through blocks and renders each one:

```typescript
export function PageRenderer({ page }: PageRendererProps) {
  const blocks = Array.isArray(page.blocks) ? page.blocks : []

  if (blocks.length === 0) {
    return <EmptyPageMessage title={page.title} />
  }

  return (
    <div className="min-h-screen" data-page-id={page.id} data-page-slug={page.slug}>
      {blocks.map((block) => (
        <div key={block.id} data-block-id={block.id} data-block-slug={block.blockSlug}>
          <BlockRenderer block={block} />
        </div>
      ))}
    </div>
  )
}
```

### Block Component Mapping (Auto-Generated)

Block components are **dynamically generated** from `BLOCK_REGISTRY` at build time. The logic is centralized in `core/lib/blocks/loader.ts`:

```typescript
// core/lib/blocks/loader.ts

import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'

// Singleton cache - initialized once on first access
let _blockComponents: Record<string, BlockComponent> | null = null

function createBlockComponents(): Record<string, BlockComponent> {
  const components: Record<string, BlockComponent> = {}

  for (const [slug, config] of Object.entries(BLOCK_REGISTRY)) {
    // Extract theme and blockSlug from componentPath
    const pathMatch = config.componentPath?.match(/themes\/([\w-]+)\/blocks\/([\w-]+)\/component/)

    if (pathMatch) {
      const [, theme, blockSlug] = pathMatch

      // Lazy load with code splitting
      components[slug] = lazy(() =>
        import(`@/blocks/${blockSlug}/component`).then(m => {
          const componentName = Object.keys(m).find(key =>
            key.endsWith('Block') || key === 'default'
          )
          return { default: componentName ? m[componentName] : m.default }
        })
      )
    }
  }
  return components
}

// Public API
export function getBlockComponent(slug: string): BlockComponent | undefined
export function getBlockComponents(): Record<string, BlockComponent>
export function normalizeBlockProps(props: Record<string, unknown>): Record<string, unknown>
```

**Module location**: `core/lib/blocks/loader.ts`

**Benefits:**
- Centralized block loading logic (used by both public renderer and dashboard preview)
- Singleton pattern avoids re-creating lazy components
- Zero filesystem I/O (uses `BLOCK_REGISTRY`)
- New blocks are available immediately after running `packages/core/scripts/build/registry.mjs`

### BlockRenderer

Individual blocks are rendered with error boundaries:

```typescript
import { getBlockComponent, normalizeBlockProps } from '@nextsparkjs/core/lib/blocks/loader'

function BlockRenderer({ block }: { block: BlockInstance }) {
  const BlockComponent = getBlockComponent(block.blockSlug)

  if (!BlockComponent) {
    console.warn(`Block component not found for slug: ${block.blockSlug}`)
    return <BlockError blockSlug={block.blockSlug} />
  }

  const normalizedProps = normalizeBlockProps(block.props)

  return (
    <Suspense fallback={<BlockSkeleton />}>
      <BlockComponent {...normalizedProps} />
    </Suspense>
  )
}
```

## Props Normalization

The form stores props with dot notation (e.g., `cta.text`). The renderer normalizes these to nested objects:

```typescript
// Input (from database)
{
  "title": "Welcome",
  "cta.text": "Learn More",
  "cta.link": "/about",
  "cta.target": "_self"
}

// Output (normalized)
{
  title: "Welcome",
  cta: {
    text: "Learn More",
    link: "/about",
    target: "_self"
  }
}
```

The `normalizeBlockProps` function handles this conversion and validates that CTA objects have both `text` and `link` before including them.

## SEO & Metadata

Metadata is generated dynamically based on page SEO fields:

```typescript
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = (await params).entity

  const pageResult = await query<PageSEO>(
    'SELECT title, seo_title, seo_description FROM pages WHERE slug = $1 AND published = true',
    [slug]
  )

  if (pageResult.rows.length > 0) {
    const page = pageResult.rows[0]
    return {
      title: page.seo_title || `${page.title} | Site Name`,
      description: page.seo_description || undefined,
      openGraph: {
        title: page.seo_title || page.title,
        description: page.seo_description || undefined,
        type: 'website',
      },
    }
  }

  // Fall back to entity archive metadata...
}
```

## Incremental Static Regeneration (ISR)

Public pages are cached for 1 hour. In the default Cache Components mode the generated route omits `revalidate` and the cached read uses `cacheLife` with the same duration; with ISR (`cacheComponents` off) the route sets `revalidate`:

```typescript
// At the top of the route file
export const revalidate = 3600  // 1 hour in seconds
```

This means:
- First request generates and caches the page
- Subsequent requests serve the cached version
- After 1 hour, the next request triggers regeneration
- The stale page is served while regenerating

### On-Demand Revalidation

The Pages API automatically triggers revalidation when saving pages, so changes appear immediately on the public site.

**Implementation in `api/pages/[id]/route.ts`:**

```typescript
import { revalidatePath } from 'next/cache'

// In PATCH handler, after successful database update:
revalidatePath(`/${page.slug}`)
console.log(`[Pages API] Revalidated: /${page.slug}`)
```

**How it works:**
1. User saves page in dashboard
2. API updates database
3. `revalidatePath()` is called automatically
4. Next.js invalidates the cached page
5. Next request generates fresh content
6. Changes are visible immediately (< 5 seconds)

**No manual action required** - the revalidation happens automatically on every save.

## Error Handling

### Block Not Found

When a block slug doesn't have a component:

```typescript
function BlockError({ blockSlug }: { blockSlug: string }) {
  return (
    <div className="py-12 px-4 bg-destructive/10 border border-destructive/20">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-destructive">
          Block not found: <code>{blockSlug}</code>
        </p>
      </div>
    </div>
  )
}
```

### Empty Page

When a page has no blocks:

```typescript
if (blocks.length === 0) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="text-muted-foreground">
          This page does not have any content yet.
        </p>
      </div>
    </div>
  )
}
```

### Page Not Found

When neither page nor entity exists:

```typescript
import { notFound } from 'next/navigation'

if (!pageFound && !entityFound) {
  notFound()  // Shows 404 page
}
```

## Data Attributes

The renderer adds data attributes for debugging:

```html
<div data-page-id="550e8400-..." data-page-slug="about-us">
  <div data-block-id="abc-123" data-block-slug="hero">
    <!-- Hero block content -->
  </div>
  <div data-block-id="def-456" data-block-slug="features-grid">
    <!-- Features grid content -->
  </div>
</div>
```

These attributes help with:
- Browser DevTools inspection
- E2E testing with Cypress
- Analytics and tracking

## Loading States

Each block has a skeleton loader during lazy loading:

```typescript
function BlockSkeleton() {
  return (
    <div className="w-full py-12 px-4 animate-pulse">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 bg-muted rounded w-3/4 mb-4" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
    </div>
  )
}
```

## Performance Considerations

### Lazy Loading

Block components are code-split and loaded on demand:

```typescript
// Only loads when this block type is used
const HeroBlock = lazy(() => import('.../hero/component'))
```

### Database Queries

Optimized queries with proper indexing:

```sql
-- GIN index enables efficient JSONB queries
CREATE INDEX idx_pages_blocks_gin ON pages USING GIN (blocks);

-- Partial index for published pages (most common query)
CREATE INDEX idx_pages_published_locale ON pages(published, locale)
  WHERE published = TRUE;
```

### Caching Strategy

| Layer | Duration | Invalidation |
|-------|----------|--------------|
| ISR | 1 hour | Auto or on-demand |
| Database | Persistent | On write |
| Browser | Varies | Cache headers |

## Customization

### Custom Page Layouts

Override the default layout using theme templates:

Add `templates/(public)/<basePath>/[...slug]/page.tsx` to your project: `nextspark prepare` composes it into the entity's generated route (see [Generated host](../01-fundamentals/08-generated-host.md)).

### Block Component Overrides

Add or replace block components:

```typescript
// Extend BLOCK_COMPONENTS
const BLOCK_COMPONENTS = {
  ...defaultComponents,
  'custom-hero': CustomHeroBlock,
}
```

## Next Steps

1. **[User Guide](./08-user-guide.md)** - Creating and publishing pages
2. **[Troubleshooting](./09-troubleshooting.md)** - Common issues
3. **[Creating Blocks](./04-creating-blocks.md)** - Building custom blocks

---

> **URL Strategy**: Pages take precedence over entity archives. If you have a `products` entity archive at `/products` but create a page with slug `products`, the page will be shown instead.

**Last Updated**: 2025-12-26
**Version**: 1.4.0
**Status**: Stable

**Changelog v1.5.0:**
- The runtime `(public)/[...slug]` catch-all and template lookups were replaced by per-entity generated routes (#203)

**Changelog v1.4.0:**
- Template resolution moved to a service layer (since replaced: see v1.5.0)

**Changelog v1.3.0:**
- Added a section documenting the catch-all `[...slug]` route (replaced by per-entity generated routes in v1.5.0)
- Added documentation for `access.basePath` configuration
- Added archive page support documentation
- Updated code examples to reflect new routing architecture
