# Builder Integration with Entity System

This document explains how the Page Builder integrates with the generic entity system, enabling any entity to have visual block-based editing.

## Overview

The Page Builder is not limited to a "pages" entity. **Any entity** can be builder-enabled by configuring `builder.enabled: true` in its EntityConfig. This integrates seamlessly with:

- Generic API handlers (`handleGenericCreate`, `handleGenericUpdate`)
- Entity form wrappers
- Schema generation
- Public rendering

## Builder-Enabled Entities

### Current Builder Entities

| Entity | Location | Use Case |
|--------|----------|----------|
| **Pages** | `contents/themes/default/entities/pages/` | Landing pages, marketing pages |
| **Posts** | `contents/themes/default/entities/posts/` | Blog posts with rich content |

### How It Works

When an entity has `builder.enabled: true`:

1. **`blocks` becomes a system field** - automatically available without defining it
2. **Builder view is activated** - shows visual editor instead of form
3. **Generic handler processes blocks** - saves/loads blocks from database
4. **Public renderer can display blocks** - ISR pages with block components

## Entity Configuration

### Enabling Builder for an Entity

```typescript
// contents/themes/{theme}/entities/{entity}/{entity}.config.ts
import type { EntityConfig } from '@/core/lib/entities/types'

export const postsConfig: EntityConfig = {
  slug: 'posts',
  name: 'Posts',

  // Public URL configuration via access.basePath
  access: {
    public: true,
    api: true,
    metadata: true,
    shared: true,
    basePath: '/blog',  // Renders at /blog/[slug]
  },

  // Enable the page builder
  builder: {
    enabled: true,

    // Fields shown in builder sidebar (optional)
    sidebarFields: ['excerpt', 'featuredImage', 'categories'],

    // Enable SEO fields panel (optional)
    seo: true,
  },

  // Other config...
}
```

### Builder Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Activates builder for this entity |
| `sidebarFields` | `string[]` | Entity fields shown in builder sidebar |
| `seo` | `boolean` | Enable SEO fields panel in editor |

### Public URL Configuration

Public URLs are configured via `access.basePath` (NOT in builder config):

| Option | Type | Description |
|--------|------|-------------|
| `access.basePath` | `string` | Base path for public URLs (e.g., `/blog` for posts) |

> **Note**: The `builder.public.basePath` location is deprecated. Use `access.basePath` instead.

> **Note**: Block availability is NOT controlled at entity level. See [Block Scope](#block-scope) below for how blocks define their own availability.

## System Fields

### The `blocks` Field

For builder-enabled entities, `blocks` is a **conditional system field**:

```typescript
// core/lib/entities/system-fields.ts

// Universal system fields (all entities)
export const SYSTEM_FIELD_NAMES = ['id', 'createdAt', 'updatedAt', 'userId', 'teamId']

// Builder-specific system fields (conditional)
export const BUILDER_SYSTEM_FIELD_NAMES = ['blocks']
```

**Important**: Do NOT define `blocks` in your entity's `fields` array. It's automatic.

```typescript
// contents/themes/default/entities/posts/posts.fields.ts

export const postsFields: EntityField[] = [
  { name: 'title', type: 'text', ... },
  { name: 'slug', type: 'text', ... },
  { name: 'status', type: 'select', ... },
  // Note: 'blocks' is a system field - NOT defined here
]
```

### Why Blocks is a System Field

1. **Consistency** - All builder entities work the same way
2. **No duplication** - Don't repeat blocks config in every entity
3. **Security** - Generic handler knows exactly when to save blocks
4. **Simplicity** - Just set `builder.enabled: true` and it works

## API Integration

### Builder Request Identification

The builder sends a special header to identify requests:

```typescript
// core/components/dashboard/block-editor/builder-editor-view.tsx
function buildApiHeaders(includeContentType = false): HeadersInit {
  const headers: Record<string, string> = {}
  // ...
  headers['x-builder-source'] = 'true'  // Identifies builder requests
  return headers
}
```

### Generic Handler Processing

The generic handler (`core/lib/api/entity/generic-handler.ts`) uses 3-condition validation:

```typescript
// For blocks to be saved, ALL conditions must be true:
if (
  entityConfig.builder?.enabled === true &&  // 1. Entity has builder
  isBuilderRequest(request) &&               // 2. x-builder-source header
  'blocks' in validatedData                  // 3. Blocks in payload
) {
  // Save blocks to database
  insertFields.push('"blocks"')
  placeholders.push(`$${paramCount++}::jsonb`)
  values.push(JSON.stringify(blocksValue))
}
```

### Security Flow

```text
Request POST /api/v1/posts
         │
         ▼
┌─────────────────────────┐
│ Has x-builder-source?   │
└─────────────────────────┘
         │
    ┌────┴────┐
    │         │
   YES       NO
    │         │
    ▼         ▼
┌─────────┐  ┌──────────────┐
│ builder │  │ Zod strips   │
│ enabled?│  │ blocks field │
└─────────┘  └──────────────┘
    │
   YES
    │
    ▼
┌─────────────────┐
│ Save blocks to  │
│ database        │
└─────────────────┘
```

## Schema Generation

The schema generator automatically includes `blocks` for builder entities:

```typescript
// core/lib/entities/schema-generator.ts

if (entityConfig.builder?.enabled) {
  createFields.blocks = z.union([
    z.array(z.object({
      id: z.string(),
      blockSlug: z.string(),
      props: z.record(z.string(), z.unknown()).optional(),
    })),
    z.unknown(),
  ]).optional()
}
```

This means:
- Builder entities accept blocks in POST/PATCH requests
- Non-builder entities have blocks stripped by Zod

## Entity Fields vs Builder Blocks

| Aspect | Entity Fields | Builder Blocks |
|--------|---------------|----------------|
| **Defined in** | `{entity}.fields.ts` | Block configs in `blocks/` |
| **Edited in** | Entity form / Sidebar | Visual canvas |
| **Storage** | Individual columns | JSONB `blocks` column |
| **Use case** | Metadata, settings | Visual content |

### Example: Posts Entity

```text
Posts Entity
├── Entity Fields (sidebar)
│   ├── title        → VARCHAR column
│   ├── slug         → VARCHAR column
│   ├── status       → VARCHAR column
│   ├── excerpt      → TEXT column
│   └── featuredImage→ TEXT column
│
└── Builder Blocks (canvas)
    └── blocks       → JSONB column
        ├── Post Hero block
        ├── Post Content block
        └── CTA Section block
```

## Dashboard Integration

### Automatic View Selection

The dashboard edit page automatically selects the correct view:

```typescript
// app/dashboard/(main)/[entity]/[id]/edit/page.tsx

if (entityConfig.builder?.enabled) {
  // Show BuilderEditorView with 3-panel layout
  return <BuilderEditorView entity={entity} id={id} />
} else {
  // Show traditional EntityForm
  return <EntityFormWrapper entity={entity} id={id} />
}
```

### Builder View Layout

```text
┌─────────────────────────────────────────────────────────────────┐
│  [Volver]  [Bloques | Campos]  Title: ___  Slug: ___   [Guardar]│
├─────────────┬─────────────────────────────┬─────────────────────┤
│             │                             │                     │
│  Block      │     Block Canvas            │   Block Settings    │
│  Library    │     (drag & drop)           │   OR                │
│             │                             │   Entity Fields     │
│  - Hero     │  ┌─────────────────────┐    │   (sidebar mode)    │
│  - Content  │  │   Block Preview     │    │                     │
│  - CTA      │  │                     │    │   - Excerpt         │
│             │  └─────────────────────┘    │   - Featured Image  │
│             │                             │   - Categories      │
│             │                             │                     │
└─────────────┴─────────────────────────────┴─────────────────────┘
```

## Public Rendering

### Dynamic Route

Public pages check for builder content:

```typescript
// app/(public)/[entity]/page.tsx

async function PublicDynamicPage({ params }) {
  const slug = params.entity

  // Check for pages with this slug
  const pageResult = await query(
    'SELECT * FROM pages WHERE slug = $1 AND status = $2',
    [slug, 'published']
  )

  if (pageResult.rows.length > 0) {
    return <PageRenderer page={pageResult.rows[0]} />
  }

  // Try entity archives...
}
```

### Posts with Builder

Posts have a dedicated route at `/blog/[slug]`:

```typescript
// app/(public)/blog/[slug]/page.tsx

async function BlogPost({ params }) {
  const postResult = await query(
    'SELECT * FROM posts WHERE slug = $1 AND status = $2',
    [params.slug, 'published']
  )

  if (postResult.rows.length > 0) {
    return <PageRenderer page={postResult.rows[0]} />
  }

  notFound()
}
```

## Database Schema

Builder-enabled entities need a `blocks` column:

```sql
-- Migration for builder-enabled entity
ALTER TABLE posts ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::JSONB;

-- Add GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_posts_blocks_gin ON posts USING GIN (blocks);
```

## Creating a New Builder Entity

### Step 1: Entity Config

```typescript
// contents/themes/default/entities/tutorials/tutorials.config.ts
export const tutorialsConfig: EntityConfig = {
  slug: 'tutorials',
  name: 'Tutorials',

  // Public URL configuration
  access: {
    public: true,
    api: true,
    metadata: true,
    shared: true,
    basePath: '/tutorials',  // Renders at /tutorials/[slug]
  },

  // Builder configuration
  builder: {
    enabled: true,
    sidebarFields: ['difficulty', 'duration', 'tags'],
    seo: true,
  },
  // ...
}
```

> **Note**: Blocks available for this entity are determined by the `scope` property in each block's config. You'll need to add `'tutorials'` to the scope of blocks you want available.

### Step 2: Entity Fields (Sidebar Only)

```typescript
// contents/themes/default/entities/tutorials/tutorials.fields.ts
export const tutorialsFields: EntityField[] = [
  { name: 'title', type: 'text', required: true, ... },
  { name: 'slug', type: 'text', required: true, ... },
  { name: 'difficulty', type: 'select', ... },
  // Note: 'blocks' is NOT defined - it's a system field
]
```

### Step 3: Database Migration

```sql
-- migrations/XXX_tutorials_table.sql
CREATE TABLE tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  difficulty VARCHAR(50) DEFAULT 'beginner',
  blocks JSONB DEFAULT '[]'::JSONB,
  status VARCHAR(50) DEFAULT 'draft',
  "userId" TEXT REFERENCES users(id),
  "teamId" TEXT REFERENCES teams(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tutorials_blocks_gin ON tutorials USING GIN (blocks);
```

### Step 4: Rebuild Registry

```bash
node core/scripts/build/registry.mjs
```

## Block Scope

Block availability is controlled at the **block level**, not the entity level. Each block defines which entities it's available for using the `scope` property.

### How Block Scope Works

```typescript
// Block config - defines where this block is available
// contents/themes/{theme}/blocks/{block}/config.ts

export const config: BlockConfig = {
  slug: 'post-hero',
  name: 'Post Hero',
  category: 'hero',

  // Scope: array of entity slugs where this block is available
  scope: ['posts'],  // Only available in posts entity

  fieldDefinitions: [...]
}
```

### Scope Filtering Logic

The builder filters blocks based on the current entity slug:

```typescript
// builder-editor-view.tsx
const availableBlocks = useMemo(() => {
  const allBlocks = getAllBlocks()
  return allBlocks.filter(block =>
    block.scope?.includes(entitySlug) ||  // Matches entity slug
    block.scope?.includes('*')            // Wildcard: all entities
  )
}, [entitySlug])
```

### Current Block Scopes (Default Theme)

| Block | Scope | Available In |
|-------|-------|--------------|
| `hero` | `['pages', 'posts']` | Pages and Posts |
| `post-hero` | `['posts']` | Posts only |
| `post-content` | `['posts']` | Posts only |
| `features-grid` | `['pages']` | Pages only |
| `benefits` | `['pages']` | Pages only |
| `testimonials` | `['pages']` | Pages only |
| `cta-section` | `['pages']` | Pages only |
| `text-content` | `['pages']` | Pages only |

### Scope Options

```typescript
// Available in specific entities
scope: ['pages']                    // Pages only
scope: ['posts']                    // Posts only
scope: ['pages', 'posts']           // Both pages and posts
scope: ['tutorials', 'courses']     // Custom entities

// Wildcard - available everywhere
scope: ['*']                        // All builder-enabled entities

// No scope = not available anywhere (default)
scope: undefined                    // Block is hidden
```

### Creating Entity-Specific Blocks

When creating blocks for a specific entity type:

```typescript
// contents/themes/default/blocks/post-hero/config.ts
export const config: BlockConfig = {
  slug: 'post-hero',
  name: 'Post Hero',
  description: 'Hero section for blog posts with author and date',
  category: 'hero',
  scope: ['posts'],  // Only for posts
  fieldDefinitions: [
    // Post-specific fields: author avatar, publish date, read time, etc.
  ],
}
```

## Best Practices

### 1. Keep Entity Fields Simple

Entity fields should be metadata, not content:

```typescript
// Good - metadata fields
{ name: 'title', type: 'text' }
{ name: 'status', type: 'select' }
{ name: 'publishDate', type: 'date' }

// Bad - content that should be blocks
{ name: 'heroTitle', type: 'text' }
{ name: 'heroSubtitle', type: 'textarea' }
{ name: 'ctaButtonText', type: 'text' }
```

### 2. Use Sidebar Fields Wisely

Put important metadata in the sidebar:

```typescript
builder: {
  sidebarFields: ['excerpt', 'featuredImage', 'categories'],
}
```

### 3. Create Entity-Specific Blocks

Create blocks tailored to your entity:

- `post-hero` - Blog post header with author, date
- `tutorial-step` - Numbered tutorial steps
- `product-gallery` - E-commerce image gallery

### 4. Define Block Scope Explicitly

Always define explicit scope for your blocks:

```typescript
// contents/themes/default/blocks/my-block/config.ts
export const config: BlockConfig = {
  slug: 'my-block',
  // ...
  scope: ['pages', 'posts'],  // Explicit scope - good!
}

// Avoid: undefined scope makes block unavailable
// scope: undefined  // Block won't appear anywhere
```

### 5. Use Categories for Organization

Use `category` for visual organization in the block picker:

```typescript
// Block categories (for UI grouping)
'hero'         // Page/post headers
'content'      // Text, images, rich content
'cta'          // Call-to-action sections
'testimonials' // Social proof
'features'     // Feature grids and lists
'pricing'      // Pricing tables
```

## Technical Reference

### TypeScript Interfaces

#### BuilderConfig

```typescript
// core/lib/entities/types.ts

export interface BuilderConfig {
  /** Enable page builder for this entity */
  enabled: boolean

  /**
   * Fields to show in sidebar while editing
   * These are regular entity fields that appear alongside the block editor
   * Examples: 'excerpt', 'featuredImage', 'categories'
   */
  sidebarFields?: string[]

  /**
   * @deprecated Use access.basePath instead
   * Public route configuration - maintained for backwards compatibility
   */
  public?: {
    basePath: string
  }

  /** Enable SEO fields panel in editor */
  seo?: boolean
}
```

#### AccessConfig (basePath)

```typescript
// core/lib/entities/types.ts

export interface AccessConfig {
  public: boolean
  api: boolean
  metadata: boolean
  shared?: boolean

  /**
   * Base path for public URLs (builder-enabled entities only)
   * Examples: '/' for pages (renders at /[slug]), '/blog' for posts (renders at /blog/[slug])
   * Used by the catch-all route to dynamically resolve entity URLs
   */
  basePath?: string
}
```

> **Migration**: Move `builder.public.basePath` to `access.basePath`. The system reads from `access.basePath` first, with fallback to `builder.public.basePath` for backwards compatibility.

#### BlockConfig Scope

```typescript
// core/types/blocks.ts

export interface BlockConfig {
  slug: string
  name: string
  description: string
  category: BlockCategory

  // Scope: array of entity slugs where this block is available
  // If undefined or empty, block is NOT available anywhere
  scope?: Array<'pages' | 'posts' | string>

  fieldDefinitions: FieldDefinition[]
  // ... other properties
}
```

### Helper Functions

#### validateBuilderEntityConfig()

Validates that a builder-enabled entity has all required fields and valid configuration:

```typescript
// core/lib/entities/schema-generator.ts

interface BuilderValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateBuilderEntityConfig(
  entityConfig: EntityConfig
): BuilderValidationResult {
  const result: BuilderValidationResult = { valid: true, errors: [], warnings: [] }

  if (!entityConfig.builder?.enabled) return result

  // 1. Check required fields exist
  const requiredFields = ['title', 'slug', 'status']
  const fieldNames = entityConfig.fields.map(f => f.name)

  for (const field of requiredFields) {
    if (!fieldNames.includes(field)) {
      result.valid = false
      result.errors.push(`Missing required field: "${field}"`)
    }
  }

  // 2. Validate sidebarFields reference actual fields
  if (entityConfig.builder.sidebarFields) {
    for (const sidebarField of entityConfig.builder.sidebarFields) {
      if (!fieldNames.includes(sidebarField)) {
        result.warnings.push(`sidebarField "${sidebarField}" does not exist`)
      }
    }
  }

  // 3. Validate basePath format
  if (entityConfig.builder.public?.basePath) {
    if (!entityConfig.builder.public.basePath.startsWith('/')) {
      result.valid = false
      result.errors.push(`basePath must start with "/"`)
    }
  }

  return result
}
```

**Validations performed:**

| Validation | Type | Description |
|------------|------|-------------|
| Required fields | Error | `title`, `slug`, `status` must exist |
| sidebarFields | Warning | Each field must exist in entity fields |
| basePath format | Error | Must start with `/` |
| status field type | Warning | Recommends `select` type for better UX |

**Required fields for builder entities:**
- `title` - Entity title (displayed in editor header)
- `slug` - URL slug (used for public routing)
- `status` - Publication status ('draft' | 'published' | etc.)

#### matchPathToEntity()

Resolves public URLs to builder entities based on `access.basePath`. Uses **longest-match strategy** to handle nested paths correctly.

```typescript
// core/lib/entities/schema-generator.ts

export function matchPathToEntity(
  path: string,
  registry: Record<string, EntityConfig>
): { entity: EntityConfig; slug: string; isArchive?: boolean } | null {
  // Get all builder-enabled entities
  const builderEntities = getBuilderEntities(registry)

  // Sort by basePath length (longest first) for longest-match strategy
  const sortedEntities = builderEntities
    .filter(e => getEntityBasePath(e))  // Uses access.basePath with fallback
    .sort((a, b) => {
      const aPath = getEntityBasePath(a) || '/'
      const bPath = getEntityBasePath(b) || '/'
      return bPath.length - aPath.length  // Longest first
    })

  for (const entity of sortedEntities) {
    const basePath = getEntityBasePath(entity)!

    // Exact basePath match = archive page
    if (path === basePath) {
      return { entity, slug: '', isArchive: true }
    }

    // Root path (/) matches /[slug]
    if (basePath === '/') {
      const match = path.match(/^\/([^\/]+)$/)
      if (match) return { entity, slug: match[1] }
    } else {
      // Nested path matches /basePath/[slug]
      const pattern = new RegExp(`^${basePath.replace(/\//g, '\\/')}\\/(.+)$`)
      const match = path.match(pattern)
      if (match) return { entity, slug: match[1] }
    }
  }
  return null
}

// Helper to get basePath from access (new) or builder.public (deprecated)
export function getEntityBasePath(entity: EntityConfig): string | undefined {
  return entity.access?.basePath ?? entity.builder?.public?.basePath
}
```

**Longest-match strategy example:**

With entities configured as:
- Pages: `access.basePath: '/'`
- Posts: `access.basePath: '/blog'`
- Tutorials: `access.basePath: '/blog/tutorials'`

| URL | Matched Entity | Slug | isArchive |
|-----|----------------|------|-----------|
| `/about` | Pages | `about` | false |
| `/blog/my-post` | Posts | `my-post` | false |
| `/blog/tutorials/react` | Tutorials | `react` | false |
| `/blog` | Posts | (empty) | **true** |

The function sorts by basePath length (longest first) so `/blog/tutorials/react` matches Tutorials, not Posts.

#### getBuilderEntities()

Helper to get all builder-enabled entities from a registry:

```typescript
export function getBuilderEntities(
  registry: Record<string, EntityConfig>
): EntityConfig[] {
  return Object.values(registry).filter(
    entity => entity.builder?.enabled === true
  )
}
```

#### isBuilderRequest()

Identifies requests from the builder UI:

```typescript
// core/lib/api/entity/generic-handler.ts

function isBuilderRequest(request: NextRequest): boolean {
  return request.headers.get('x-builder-source') === 'true'
}
```

### Block Registry Functions

The block registry provides fast, zero-I/O access to block configurations:

```typescript
// core/lib/registries/block-registry.ts

// Get all blocks (used by builder for scope filtering)
export function getAllBlocks(): BlockConfig[] {
  return Object.values(BLOCK_REGISTRY)
}

// Get single block by slug
export function getBlock(slug: string): BlockConfig | undefined {
  return BLOCK_REGISTRY[slug]
}

// Get blocks by category (for UI grouping)
export function getBlocksByCategory(category: BlockCategory): BlockConfig[] {
  return Object.values(BLOCK_REGISTRY).filter(block => block.category === category)
}

// Check if block exists
export function hasBlock(slug: string): boolean {
  return slug in BLOCK_REGISTRY
}
```

**Performance**: All functions are O(1) or O(n) with zero filesystem I/O because `BLOCK_REGISTRY` is generated at build time.

### Block Scope Filtering in UI

The builder filters available blocks based on entity slug:

```typescript
// core/components/dashboard/block-editor/builder-editor-view.tsx

const availableBlocks = useMemo(() => {
  const allBlocks = getAllBlocks()
  return allBlocks.filter(block =>
    block.scope?.includes(entitySlug) ||  // Exact entity match
    block.scope?.includes('*')            // Wildcard match
  )
}, [entitySlug])
```

**Filter behavior:**
- `scope: ['pages']` → Available only when editing a Pages entity
- `scope: ['posts']` → Available only when editing a Posts entity
- `scope: ['pages', 'posts']` → Available in both
- `scope: ['*']` → Available in ALL builder-enabled entities
- `scope: undefined` → NOT available anywhere (hidden)

### System Fields

#### BUILDER_SYSTEM_FIELD_NAMES

```typescript
// core/lib/entities/system-fields.ts

// Builder-specific system fields (conditional)
export const BUILDER_SYSTEM_FIELD_NAMES = ['blocks'] as const

export const BUILDER_BLOCKS_FIELD: EntityField = {
  name: 'blocks',
  type: 'json',
  required: false,
  defaultValue: [],
  display: {
    label: 'Blocks',
    description: 'Content blocks (managed by builder)',
    showInList: false,
    showInDetail: false,
    showInForm: false,
    order: 100,
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false,
  },
}

export function isBuilderSystemField(fieldName: string): boolean {
  return BUILDER_SYSTEM_FIELD_NAMES.includes(fieldName as BuilderSystemFieldName)
}
```

### Data Flow Summary

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        BUILDER DATA FLOW                                 │
│                                                                          │
│  1. Entity Config                                                        │
│     builder: { enabled: true, sidebarFields: [...] }                    │
│                    │                                                     │
│                    ▼                                                     │
│  2. Schema Generator                                                     │
│     if (builder.enabled) → adds 'blocks' to Zod schema                  │
│                    │                                                     │
│                    ▼                                                     │
│  3. Dashboard Route                                                      │
│     if (builder.enabled) → render BuilderEditorView                     │
│                    │                                                     │
│                    ▼                                                     │
│  4. Builder UI                                                           │
│     - Filters blocks by scope.includes(entitySlug)                      │
│     - Sends x-builder-source header                                     │
│                    │                                                     │
│                    ▼                                                     │
│  5. Generic Handler                                                      │
│     3-condition validation:                                             │
│     if (builder.enabled && isBuilderRequest && 'blocks' in data)        │
│     → Save blocks to database                                           │
│                    │                                                     │
│                    ▼                                                     │
│  6. Public Route                                                         │
│     matchPathToEntity() → resolves URL to entity                        │
│     PageRenderer → renders blocks                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Security Considerations

### 3-Condition Validation

The builder implements a strict 3-condition validation to prevent unauthorized block manipulation:

```typescript
// All three conditions must be true to save blocks:
if (
  entityConfig.builder?.enabled === true &&  // 1. Entity has builder
  isBuilderRequest(request) &&               // 2. x-builder-source header
  'blocks' in validatedData                  // 3. Blocks in payload
) {
  // Save blocks
}
```

**Why this matters:**

| Condition | Without it | Risk |
|-----------|------------|------|
| `builder.enabled` | Any entity could store blocks | Data integrity |
| `x-builder-source` | Direct API calls could inject blocks | Injection attacks |
| `blocks in data` | Unnecessary processing | Performance |

### Header Spoofing

While `x-builder-source` can be spoofed, it's defense-in-depth:

1. **Authentication required** - All API calls require valid session
2. **Entity validation** - Only builder-enabled entities accept blocks
3. **Zod validation** - Blocks are validated against schema
4. **Database constraints** - JSONB column with proper type

### Data Sanitization

Block props are:
1. Validated by Zod schema in generic-handler
2. Stored as JSONB (proper escaping)
3. Rendered through React (XSS protection)

### Access Control

Builder operations respect entity-level permissions:
- Users can only edit entities they have access to
- Team-based isolation via `teamId` filter
- Role-based permissions via entity config

## Troubleshooting

### Blocks Not Saving

1. Verify `builder.enabled: true` in entity config
2. Check browser Network tab for `x-builder-source` header
3. Ensure `blocks` column exists in database
4. Check server logs for validation errors

### Blocks Not Loading

1. Verify SELECT query includes `blocks` column
2. Check generic-handler includes blocks in response
3. Ensure JSONB data is valid array format

### Block Component Not Found

1. Run `node core/scripts/build/registry.mjs`
2. Check block is in correct theme folder
3. Verify export name ends with `Block`

### Block Not Appearing in Editor

1. Check block's `scope` property includes the entity slug
2. Verify block has `scope: ['pages']` or `scope: ['posts']` etc.
3. Wildcard `scope: ['*']` makes block available everywhere
4. Undefined `scope` means block is hidden from all entities

### Public Page Not Rendering

1. Verify entity has `access.basePath` configured (or deprecated `builder.public.basePath`)
2. Check entity status is 'published'
3. Verify `matchPathToEntity()` can resolve the URL
4. Check database has `blocks` column with valid JSONB data
5. Check `ui.public.hasArchivePage: true` for archive pages (e.g., `/blog`)

## Related Documentation

- **[Introduction](./01-introduction.md)** - Page Builder overview
- **[Architecture](./02-architecture.md)** - System architecture
- **[Creating Blocks](./04-creating-blocks.md)** - Custom block development
- **[Entity System](../04-entities/01-overview.md)** - Core entity documentation

---

**Last Updated**: 2025-12-17
**Version**: 1.4.0
**Status**: Stable

**Changelog v1.4.0:**
- Migrated `basePath` from `builder.public.basePath` to `access.basePath`
- Added `isArchive` flag support for archive pages
- Updated all code examples to use new location
- Deprecated `builder.public.basePath` with fallback support
