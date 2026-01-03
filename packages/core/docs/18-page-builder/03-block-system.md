# Block System

This document describes the core block system, including block types, schemas, field definitions, and the registry. Understanding these concepts is essential for working with or extending the Page Builder.

## Block Concepts

### BlockConfig vs BlockInstance

The system distinguishes between **block definitions** and **block usage**:

```typescript
// BlockConfig: The definition (what a block CAN be)
interface BlockConfig {
  slug: string              // Unique identifier: 'hero', 'features-grid'
  name: string              // Display name: 'Hero Section'
  description: string       // Brief description
  category: BlockCategory   // 'hero', 'content', 'cta', etc.
  icon?: string            // Lucide icon name
  fieldDefinitions: FieldDefinition[]  // Form fields for admin UI
  // ... paths and metadata
}

// BlockInstance: A specific usage (what a block IS on a page)
interface BlockInstance<TProps = Record<string, unknown>> {
  id: string               // Unique UUID for this instance
  blockSlug: string        // References BlockConfig.slug
  props: TProps            // User-configured values
}
```

**Example**:
```typescript
// A page might have two hero blocks with different content:
const pageBlocks: BlockInstance[] = [
  {
    id: 'abc-123',
    blockSlug: 'hero',
    props: { title: 'Welcome', content: 'First hero' }
  },
  {
    id: 'def-456',
    blockSlug: 'hero',
    props: { title: 'About Us', content: 'Second hero' }
  }
]
```

## Block Categories

Blocks are organized into categories for easier discovery:

| Category | Purpose | Example Blocks |
|----------|---------|----------------|
| `hero` | Full-width hero sections | Hero |
| `content` | General content | Text Content, Features Grid |
| `cta` | Call-to-action | CTA Section |
| `testimonials` | Social proof | Testimonials |
| `features` | Feature showcases | Features Grid |
| `media` | Images, videos | Gallery, Video |
| `forms` | User input | Contact Form, Newsletter |
| `navigation` | Menus, breadcrumbs | Header, Footer |
| `pricing` | Pricing tables | Pricing Grid |
| `team` | Team members | Team Grid |
| `stats` | Statistics | Stats Counter |
| `faq` | FAQ sections | Accordion FAQ |
| `newsletter` | Email capture | Newsletter CTA |
| `other` | Miscellaneous | Custom blocks |

## The 3-Tab Structure

Every block follows a consistent 3-tab configuration structure:

```text
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────┐  ┌─────────┐  ┌──────────┐                    │
│  │ Content │  │ Design  │  │ Advanced │                    │
│  └─────────┘  └─────────┘  └──────────┘                    │
│                                                             │
│  Tab 1: CONTENT                                            │
│  ├── title (text)                                          │
│  ├── content (rich-text)                                   │
│  └── cta (group: text, link, target)                       │
│                                                             │
│  Tab 2: DESIGN                                             │
│  ├── backgroundColor (select)                              │
│  └── [block-specific design options]                       │
│                                                             │
│  Tab 3: ADVANCED                                           │
│  ├── className (text) - Custom CSS classes                 │
│  └── id (text) - HTML ID for anchor links                  │
└─────────────────────────────────────────────────────────────┘
```

### Base Schemas

The system provides reusable base schemas that blocks can extend:

```typescript
// core/types/blocks.ts

// Base Content Schema (Tab 1)
export const baseContentSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  cta: ctaSchema.optional(),
})

// Base Design Schema (Tab 2)
export const baseDesignSchema = z.object({
  backgroundColor: z.enum(backgroundColorOptions).default('transparent'),
})

// Base Advanced Schema (Tab 3)
export const baseAdvancedSchema = z.object({
  className: z.string().optional(),
  id: z.string().optional(),
})

// Combined Base Block Schema
export const baseBlockSchema = baseContentSchema
  .merge(baseDesignSchema)
  .merge(baseAdvancedSchema)
```

### Base Field Definitions

Corresponding field definitions for admin UI:

```typescript
// Base Content Fields
export const baseContentFields: FieldDefinition[] = [
  { name: 'title', label: 'Title', type: 'text', tab: 'content' },
  { name: 'content', label: 'Content', type: 'rich-text', tab: 'content' },
  // CTA group fields...
]

// Base Design Fields
export const baseDesignFields: FieldDefinition[] = [
  { name: 'backgroundColor', label: 'Background Color', type: 'select', tab: 'design', options: [...] }
]

// Base Advanced Fields
export const baseAdvancedFields: FieldDefinition[] = [
  { name: 'className', label: 'CSS Class', type: 'text', tab: 'advanced' },
  { name: 'id', label: 'HTML ID', type: 'text', tab: 'advanced' }
]
```

## Field Types

The dynamic form generator supports these field types:

| Type | UI Component | Description |
|------|--------------|-------------|
| `text` | Input | Single-line text input |
| `textarea` | Textarea | Multi-line text input |
| `rich-text` | RichTextEditor | Formatted text with toolbar |
| `url` | Input[type=url] | URL input with validation |
| `email` | Input[type=email] | Email input |
| `number` | Input[type=number] | Numeric input with min/max/step |
| `select` | Select dropdown | Single selection from options |
| `image` | ImageUpload | Image upload with preview |
| `array` | ArrayField | Repeatable items (e.g., features list) |
| `checkbox` | Checkbox | Boolean toggle |
| `color` | ColorPicker | Color selection |
| `date` | DatePicker | Date selection |
| `time` | TimePicker | Time selection |
| `datetime` | DateTimePicker | Combined date and time |

### Field Definition Interface

```typescript
interface FieldDefinition {
  name: string           // Field key in props
  label: string          // Display label
  type: FieldType        // One of the types above
  tab: FieldTab          // 'content' | 'design' | 'advanced'
  required?: boolean     // Is field mandatory?
  default?: unknown      // Default value
  placeholder?: string   // Input placeholder
  helpText?: string      // Help text below field

  // Type-specific options
  options?: Array<{ label: string; value: string | number }>  // For select
  min?: number           // For number
  max?: number           // For number
  rows?: number          // For textarea
  itemFields?: FieldDefinition[]  // For array
  minItems?: number      // For array
  maxItems?: number      // For array

  // Field grouping
  group?: string         // Group identifier
  groupLabel?: string    // Group display label

  // Conditional display
  condition?: {
    field: string
    operator: 'equals' | 'notEquals' | 'contains'
    value: unknown
  }
}
```

## Block Registry

### Auto-Generation

The block registry is auto-generated at build time by `core/scripts/build/registry.mjs`:

```typescript
// core/lib/registries/block-registry.ts (auto-generated)

import { fieldDefinitions as hero_fields } from '@/contents/themes/default/blocks/hero/fields'
// ... other imports

export const BLOCK_REGISTRY: Record<string, BlockConfig> = {
  'hero': {
    slug: 'hero',
    name: 'Hero Section',
    description: 'Full-width hero with title, subtitle, CTA, and background',
    category: 'hero',
    icon: 'Rocket',
    fieldDefinitions: hero_fields,
    componentPath: '@/contents/themes/default/blocks/hero/component',
    // ...
  },
  // ... other blocks
}
```

### Using the Registry

```typescript
import { BLOCK_REGISTRY, getAllBlocks, getBlock, getBlocksByCategory } from '@/core/lib/registries/block-registry'

// Get all blocks
const allBlocks = getAllBlocks()

// Get specific block
const heroBlock = getBlock('hero')

// Get blocks by category
const contentBlocks = getBlocksByCategory('content')

// Check if block exists
const exists = hasBlock('hero')  // true
```

## Block Anatomy

A complete block consists of these files:

```text
contents/themes/{theme}/blocks/{block-slug}/
├── config.ts      # Metadata (name, description, category, icon)
├── fields.ts      # Field definitions for admin UI
├── schema.ts      # Zod validation schema
├── component.tsx  # React component
├── index.ts       # Re-exports
└── thumbnail.png  # Preview image for picker
```

### config.ts

```typescript
import type { BlockConfig } from '@/core/types/blocks'

export const config: Omit<BlockConfig, 'fieldDefinitions'> = {
  slug: 'hero',
  name: 'Hero Section',
  description: 'Full-width hero with title, subtitle, and CTA',
  category: 'hero',
  icon: 'Rocket',
  thumbnail: '/theme/blocks/hero/thumbnail.png'
}
```

### fields.ts

```typescript
import type { FieldDefinition } from '@/core/types/blocks'
import { baseContentFields, baseDesignFields, baseAdvancedFields } from '@/core/types/blocks'

// Block-specific fields
const heroDesignFields: FieldDefinition[] = [
  {
    name: 'backgroundImage',
    label: 'Background Image',
    type: 'image',
    tab: 'design',
  },
  {
    name: 'textColor',
    label: 'Text Color',
    type: 'select',
    tab: 'design',
    options: [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
  },
]

export const fieldDefinitions: FieldDefinition[] = [
  ...baseContentFields,
  ...baseDesignFields,
  ...heroDesignFields,
  ...baseAdvancedFields,
]
```

### schema.ts

```typescript
import { z } from 'zod'
import { baseBlockSchema } from '@/core/types/blocks'

export const heroSpecificSchema = z.object({
  backgroundImage: z.string().url().optional(),
  textColor: z.enum(['light', 'dark']).default('light'),
})

export const schema = baseBlockSchema.merge(heroSpecificSchema)
export type HeroBlockProps = z.infer<typeof schema>
```

### component.tsx

```typescript
import React from 'react'
import { buildSectionClasses } from '@/core/types/blocks'
import type { HeroBlockProps } from './schema'

export function HeroBlock({
  title,
  content,
  cta,
  backgroundColor,
  backgroundImage,
  textColor = 'light',
  className,
  id,
}: HeroBlockProps) {
  const sectionClasses = buildSectionClasses(
    'relative min-h-[600px] flex items-center',
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses}>
      {/* Block content */}
    </section>
  )
}
```

## Helper Functions

The block system provides helpers for consistent rendering:

```typescript
// Get background CSS classes
const bgClasses = getBackgroundClasses('primary')
// → 'bg-primary text-primary-foreground'

// Build complete section classes
const sectionClasses = buildSectionClasses(
  'py-16 px-4',  // Base classes
  { backgroundColor: 'gray-100', className: 'my-custom-class' }
)
// → 'py-16 px-4 bg-gray-100 my-custom-class'

// Get section attributes for spreading
const attrs = getSectionAttributes({ id: 'my-section', className: 'custom' })
// → { id: 'my-section', className: 'custom' }
```

## Background Color Options

Pre-defined theme-aware background colors:

| Value | CSS Classes |
|-------|-------------|
| `transparent` | `bg-transparent` |
| `white` | `bg-white` |
| `gray-50` | `bg-gray-50` |
| `gray-100` | `bg-gray-100` |
| `gray-900` | `bg-gray-900 text-white` |
| `primary` | `bg-primary text-primary-foreground` |
| `primary-light` | `bg-primary/10` |
| `primary-dark` | `bg-primary-dark text-white` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `accent` | `bg-accent text-accent-foreground` |

## Next Steps

1. **[Creating Blocks](./04-creating-blocks.md)** - Build your own custom blocks
2. **[Block Editor](./05-block-editor.md)** - Understand editor components
3. **[Pages API](./06-pages-api.md)** - REST API for page management

---

> **Best Practice**: Always extend the base schemas and field definitions rather than recreating common fields. This ensures consistency across all blocks.

**Last Updated**: 2025-01-21
**Version**: 1.0.0
**Status**: Stable
