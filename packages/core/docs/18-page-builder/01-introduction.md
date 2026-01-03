# Page Builder System

The Page Builder is a visual editor that enables users to create dynamic content by composing reusable blocks. Inspired by WordPress and Webflow, it provides a no-code interface for content editors while maintaining full type safety and developer extensibility.

## Overview

The Page Builder system allows you to:

- **Create content visually** using a drag-and-drop interface
- **Compose content** from pre-built, customizable blocks
- **Preview changes** in real-time before publishing
- **Enable any entity** for visual editing (Pages, Posts, or custom entities)
- **Manage SEO** with built-in metadata fields
- **Extend** with custom blocks tailored to your needs

## Builder-Enabled Entities

The Page Builder integrates with the **generic entity system**. Any entity can use the builder by setting `builder.enabled: true`:

| Entity | Purpose | Public URL |
|--------|---------|------------|
| **Pages** | Landing pages, marketing content | `/[slug]` |
| **Posts** | Blog posts with rich content | `/blog/[slug]` |

Block availability is determined by each block's `scope` property, not by entity config. For example:
- `hero` block has `scope: ['pages', 'posts']` - available in both
- `post-hero` block has `scope: ['posts']` - available only in posts
- `features-grid` block has `scope: ['pages']` - available only in pages

> **Key Concept**: `blocks` is a **conditional system field** that automatically becomes available for builder-enabled entities. You don't define it in your entity fields - it's managed by the system.

See **[Entity Integration](./10-entity-integration.md)** for detailed configuration.

## Key Features

| Feature | Description |
|---------|-------------|
| **Visual Editor** | 3-panel layout with block picker, canvas, and settings |
| **Drag & Drop** | Reorder blocks with smooth animations (dnd-kit) |
| **Live Preview** | Toggle between layout and preview modes |
| **Type Safety** | Zod schemas for runtime validation |
| **Build-Time Registry** | ~17,255x faster than runtime I/O |
| **ISR Support** | Incremental Static Regeneration for public pages |
| **SEO Ready** | Title, description, keywords, and Open Graph fields |
| **Extensible** | Add custom blocks with minimal boilerplate |

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           ADMIN DASHBOARD                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐   │
│  │  Block Picker   │ │  Block Canvas   │ │  Block Settings     │   │
│  │  - Search       │ │  - Drag & Drop  │ │  - Content Tab      │   │
│  │  - Categories   │ │  - Preview      │ │  - Design Tab       │   │
│  │  - Block List   │ │  - Reorder      │ │  - Advanced Tab     │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           REST API                                   │
│  POST /api/v1/pages     GET /api/v1/pages/:id     PATCH/DELETE      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Database                           │
│  pages: { id, slug, title, blocks (JSONB), seo_*, published, ... }  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PUBLIC RENDERING                              │
│  app/(public)/[entity]/page.tsx → PageRenderer → Block Components   │
│  Priority: Pages first → Entity Archives second                      │
│  Features: ISR (1 hour), SEO metadata, Lazy loading                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies
- **React 19** - Component rendering and state management
- **Next.js 15** - App Router, API routes, ISR
- **TypeScript** - Full type safety across the system
- **Zod** - Schema validation for blocks and forms

### UI & Interaction
- **dnd-kit** - Accessible drag-and-drop
- **shadcn/ui** - UI component library
- **Tailwind CSS** - Styling system

### Data Layer
- **PostgreSQL** - Database with JSONB for blocks
- **Supabase** - Hosted database service

### Performance
- **Build-time Registry** - Static block definitions
- **React.lazy** - Code splitting for blocks
- **ISR** - Incremental regeneration for pages

## Use Cases

### Landing Pages
Create marketing pages with hero sections, feature grids, testimonials, and call-to-action blocks.

### Content Pages
Build about pages, contact pages, and informational content using text and media blocks.

### Campaign Pages
Quickly spin up promotional pages without developer involvement.

### Documentation
Structure documentation with consistent layouts using reusable blocks.

## System Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Block Types | `core/types/blocks.ts` | TypeScript definitions and Zod schemas |
| Block Registry | `core/lib/registries/block-registry.ts` | Auto-generated block catalog |
| Block Editor | `core/components/dashboard/block-editor/` | Visual editor components |
| Block Implementations | `contents/themes/{theme}/blocks/` | Actual block components |
| System Fields | `core/lib/entities/system-fields.ts` | Builder system fields (blocks) |
| Generic Handler | `core/lib/api/entity/generic-handler.ts` | API CRUD with builder support |
| Schema Generator | `core/lib/entities/schema-generator.ts` | Zod schemas with blocks |
| Public Renderer | `app/components/page-renderer.tsx` | Frontend page display |
| Public Route | `app/(public)/[entity]/page.tsx` | Dynamic routing |

## Available Blocks

The default theme includes these blocks:

| Block | Category | Description |
|-------|----------|-------------|
| **Hero** | hero | Full-width hero with title, subtitle, CTA, and background image |
| **Features Grid** | content | Grid of features with icons, titles, and descriptions |
| **Benefits Grid** | features | 3-column grid showcasing benefits with optional colored top borders |
| **CTA Section** | cta | Call-to-action with title, description, and buttons |
| **Testimonials** | testimonials | Customer quotes with author and avatar |
| **Text Content** | content | Rich text content block |

> **Tip**: New blocks are auto-discovered from `BLOCK_REGISTRY`. Run `node core/scripts/build/registry.mjs` after creating a block.

## Developer Tools

For automated block development, use the specialized Claude Code workflow:

| Tool | Purpose | Command |
|------|---------|---------|
| **Block Developer Agent** | AI-assisted block creation and modification | `Launch block-developer` |
| **Create Block** | Generate complete 5-file structure | `/block:create` |
| **Update Block** | Modify existing blocks safely | `/block:update` |
| **Validate Block** | Check structure and consistency | `/block:validate` |
| **List Blocks** | View available blocks by theme | `/block:list` |
| **Document Block** | Generate block documentation | `/block:docs` |

See [Claude Workflow - Block Developer Agent](../16-claude-workflow/03-agents.md#10-block-developer) and [Block Commands](../16-claude-workflow/06-commands.md#block-commands) for details.

## Recent Updates (v1.1.0)

### Dynamic Block Auto-Discovery
Block components are now **automatically loaded** from `BLOCK_REGISTRY`. No need to manually edit `page-renderer.tsx` when creating new blocks:
- Create block in `contents/themes/{theme}/blocks/`
- Run `node core/scripts/build/registry.mjs`
- Block is immediately available in editor and public pages

### Complete Field Types
The DynamicForm now supports all field types including:
- `checkbox` - Boolean toggle (Switch component)
- `radio` - Single selection with options (RadioGroup)
- `color` - Color picker with preview and hex input
- `date` - Calendar date picker (ISO format)
- `time` - Time input
- `datetime` - Combined date and time

### Instant On-Demand Revalidation
Pages API now automatically calls `revalidatePath()` on save:
- Changes appear on public pages in < 5 seconds
- No need to wait for ISR (1 hour) to expire
- Works for both new and updated pages

## Quick Links

- **[Architecture](./02-architecture.md)** - Detailed system architecture
- **[Block System](./03-block-system.md)** - How blocks work
- **[Creating Blocks](./04-creating-blocks.md)** - Build custom blocks
- **[Entity Integration](./10-entity-integration.md)** - Builder + generic entities
- **[Public Rendering](./07-public-rendering.md)** - ISR and SSR rendering
- **[User Guide](./08-user-guide.md)** - For content editors

## Next Steps

1. **[Entity Integration](./10-entity-integration.md)** - Understand how builder works with entities
2. **[Architecture](./02-architecture.md)** - System design and data flow
3. **[Block System](./03-block-system.md)** - Learn how blocks are structured
4. **[User Guide](./08-user-guide.md)** - Start creating pages

---

> **Note**: The Page Builder integrates seamlessly with the generic entity system. Any entity with `builder.enabled: true` gets visual editing capabilities. `blocks` is a conditional system field - you don't need to define it manually.

**Last Updated**: 2025-12-17
**Version**: 1.3.0
**Status**: Stable
