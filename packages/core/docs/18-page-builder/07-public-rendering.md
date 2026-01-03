# Public Rendering

This document explains how pages created with the Page Builder are rendered on the public-facing website.

## Overview

Public pages are served through a dynamic route that handles both:
1. **Dynamic pages** created via the Page Builder
2. **Entity archives** from the entity system

Pages take priority over entity archives, allowing you to create custom landing pages for any URL.

## Dynamic Route Resolution

The system uses a **catch-all route** (`[...slug]`) that dynamically resolves URLs based on entity `access.basePath` configuration. This eliminates the need for manual route stubs for each entity type.

### How It Works

1. **URL Pattern Matching**: The `[...slug]` route captures all public paths
2. **Entity Resolution**: `matchPathToEntity()` matches the URL against entity `access.basePath` configurations
3. **Priority**: Longest-match-first strategy (e.g., `/blog` matches before `/`)
4. **Template Override**: Checks for theme-specific templates before default rendering
5. **Default Rendering**: Falls back to `PageRenderer` for block content

### Route Resolution Flow

```text
Request GET /blog/my-post
         │
         ▼
┌─────────────────────────────────────┐
│ app/(public)/[...slug]/page.tsx     │
│ slugParts = ['blog', 'my-post']     │
│ fullPath = '/blog/my-post'          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ matchPathToEntity(fullPath)         │
│                                     │
│ Entities sorted by basePath:        │
│ 1. posts (basePath: '/blog')        │ ← MATCH!
│ 2. pages (basePath: '/')            │
│                                     │
│ Returns: { entity: posts,           │
│            slug: 'my-post' }        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Check template override             │
│ 'app/(public)/blog/[slug]/...'      │
│                                     │
│ → Theme template exists?            │
│   YES → Render with template        │
│   NO  → Render with PageRenderer    │
└─────────────────────────────────────┘
```

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

### Priority Resolution (Longest-Match-First)

When multiple entities could match a URL, the system uses **longest-match-first** strategy:

| URL | Matched Entity | Reason |
|-----|----------------|--------|
| `/blog/my-post` | posts | `/blog` is longer than `/` |
| `/about` | pages | Only `/` matches single segment |
| `/blog` | posts (archive) | Exact basePath match |
| `/nonexistent` | 404 | No entity matches |

### Archive Pages

When a URL exactly matches a basePath (e.g., `/blog`), the system returns an **archive page** showing a list of published items:

```typescript
// matchPathToEntity returns isArchive: true for exact basePath matches
if (path === basePath) {
  return { entity, slug: '', isArchive: true }
}
```

Archive pages require `ui.public.hasArchivePage: true` in the entity config.

## Dynamic Route

**Location**: `app/(public)/[...slug]/page.tsx`

```typescript
import { TemplateService } from '@/core/lib/services/template.service'

export default async function DynamicPublicPage({ params }: PageProps) {
  const slugParts = (await params).slug
  const fullPath = '/' + slugParts.join('/')

  // Match path to builder entity using longest-match strategy
  const match = matchPathToEntity(fullPath, registry)

  if (match) {
    const { entity, slug, isArchive } = match

    // Archive page (e.g., /blog without slug)
    if (isArchive) {
      if (!entity.ui?.public?.hasArchivePage) notFound()
      return <PublicEntityGrid entityType={entity.slug} />
    }

    // Check for theme template override
    const templatePath = buildTemplatePath(entity)
    if (TemplateService.hasOverride(templatePath)) {
      const Template = TemplateService.getComponent(templatePath)
      if (Template) return <Template params={params} />
    }

    // Default rendering with PageRenderer
    const item = await fetchPublishedItem(entity.tableName, slug)
    if (!item) notFound()

    return <PageRenderer page={item} />
  }

  notFound()
}
```

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

import { BLOCK_REGISTRY } from '@/core/lib/registries/block-registry'

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
        import(`@/contents/themes/${theme}/blocks/${blockSlug}/component`).then(m => {
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
- New blocks are available immediately after running `build-registry.mjs`

### BlockRenderer

Individual blocks are rendered with error boundaries:

```typescript
import { getBlockComponent, normalizeBlockProps } from '@/core/lib/blocks/loader'

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

Pages use ISR with a 1-hour revalidation period:

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

**Implementation in `app/api/v1/pages/[id]/route.ts`:**

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

```typescript
// In your theme
export default getTemplateOrDefault(
  'app/(public)/[entity]/page.tsx',
  CustomPublicPage
)
```

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

**Changelog v1.4.0:**
- Updated template resolution to use TemplateService instead of legacy registry functions
- Code examples now import from `@/core/lib/services/template.service`

**Changelog v1.3.0:**
- Added "Dynamic Route Resolution" section documenting the catch-all `[...slug]` route
- Added documentation for `access.basePath` configuration
- Added archive page support documentation
- Updated code examples to reflect new routing architecture
