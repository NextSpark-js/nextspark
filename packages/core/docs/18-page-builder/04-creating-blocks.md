# Creating Custom Blocks

This guide walks you through creating custom blocks for the Page Builder. You'll learn the file structure, how to extend base schemas, and best practices.

## Automated Block Creation (Recommended)

Use the `/block:create` command for the fastest approach:

```bash
# Create an FAQ accordion block
/block:create FAQ accordion block con preguntas y respuestas

# Create a pricing table in a specific theme
/block:create --theme=blog Pricing table with monthly/yearly toggle
```

The command will:
1. Determine the active theme (or use `--theme=X`)
2. Discover existing blocks to learn patterns
3. Generate all 5 required files
4. Run `build-registry.mjs` automatically
5. Verify the block is registered

**Other helpful commands:**
- `/block:update hero add subtitle field` - Modify existing blocks
- `/block:validate all` - Validate block consistency
- `/block:list` - View available blocks
- `/block:docs hero` - Generate block documentation

See [Block Commands Documentation](../16-claude-workflow/06-commands.md#block-commands) for full reference.

---

## Using Block Presets (Fastest)

The core includes ready-to-use block presets at `core/templates/blocks/`. Simply copy them to your theme:

```bash
# Copy a single block
cp -r core/templates/blocks/testimonials contents/themes/YOUR_THEME/blocks/

# Copy multiple blocks
cp -r core/templates/blocks/{hero,cta-section,features-grid} contents/themes/YOUR_THEME/blocks/

# Rebuild registry
node core/scripts/build/registry.mjs
```

### Available Presets

| Block | Category | Description |
|-------|----------|-------------|
| `hero` | hero | Full-width hero with title, subtitle, CTA |
| `cta-section` | cta | Call-to-action with primary/secondary buttons |
| `features-grid` | content | Grid of features with icons |
| `testimonials` | testimonials | Customer testimonials with avatars |
| `text-content` | content | Rich text content block |

### Block Thumbnails

Thumbnails are automatically copied to `public/theme/blocks/` during theme build:

```bash
node core/scripts/build/theme.mjs
# Output: ✅ Copied 5 block thumbnail(s) to public/theme/blocks/
```

The thumbnail path pattern is `/theme/blocks/{slug}/thumbnail.png`.

---

## Manual Block Creation

If you prefer creating blocks manually, follow the steps below.

## Quick Start

Create a new block in under 5 minutes:

```bash
# 1. Create the block directory
mkdir -p contents/themes/default/blocks/my-block

# 2. Create required files
touch contents/themes/default/blocks/my-block/{config,fields,schema,component,index}.ts
mv component.ts component.tsx

# 3. Rebuild the registry
node core/scripts/build/registry.mjs
```

## File Structure

Every block requires these files:

```text
contents/themes/{theme}/blocks/{block-slug}/
├── config.ts        # Block metadata
├── fields.ts        # Admin form field definitions
├── schema.ts        # Zod validation schema
├── component.tsx    # React component
├── index.ts         # Re-exports
└── thumbnail.png    # Preview image (auto-copied to public/theme/blocks/)
```

## Step-by-Step Guide

### Step 1: config.ts

Define block metadata:

```typescript
// contents/themes/default/blocks/pricing-table/config.ts
import type { BlockConfig } from '@/core/types/blocks'

export const config: Omit<BlockConfig, 'fieldDefinitions'> = {
  slug: 'pricing-table',
  name: 'Pricing Table',
  description: 'Display pricing plans with features and CTAs',
  category: 'pricing',
  icon: 'CreditCard',  // Lucide icon name
  thumbnail: '/theme/blocks/pricing-table/thumbnail.png',

  // REQUIRED: Define which entities can use this block
  scope: ['pages'],  // Available only in pages
  // scope: ['pages', 'posts'],  // Available in both
  // scope: ['*'],  // Available in all builder entities
}
```

**Available Categories**: `hero`, `content`, `features`, `cta`, `testimonials`, `media`, `forms`, `navigation`, `footer`, `pricing`, `team`, `stats`, `faq`, `newsletter`, `other`

### Block Scope (Required)

The `scope` property determines which entities can use this block:

```typescript
// Only in pages
scope: ['pages']

// Only in posts
scope: ['posts']

// In both pages and posts
scope: ['pages', 'posts']

// In all builder-enabled entities (wildcard)
scope: ['*']

// Custom entities
scope: ['tutorials', 'courses']
```

> **Important**: Blocks without a `scope` property are NOT available anywhere. Always define scope explicitly.

### Step 2: fields.ts

Define form fields for the admin UI:

```typescript
// contents/themes/default/blocks/pricing-table/fields.ts
import type { FieldDefinition } from '@/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@/core/types/blocks'

// Block-specific content fields
const pricingContentFields: FieldDefinition[] = [
  {
    name: 'plans',
    label: 'Pricing Plans',
    type: 'array',
    tab: 'content',
    required: true,
    helpText: 'Add up to 4 pricing plans',
    minItems: 1,
    maxItems: 4,
    itemFields: [
      {
        name: 'name',
        label: 'Plan Name',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Pro',
      },
      {
        name: 'price',
        label: 'Price',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: '$29/mo',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        tab: 'content',
        rows: 2,
      },
      {
        name: 'features',
        label: 'Features (one per line)',
        type: 'textarea',
        tab: 'content',
        rows: 4,
        placeholder: 'Unlimited projects\n24/7 support\nAPI access',
      },
      {
        name: 'highlighted',
        label: 'Highlight this plan',
        type: 'checkbox',
        tab: 'content',
        default: false,
      },
      {
        name: 'ctaText',
        label: 'Button Text',
        type: 'text',
        tab: 'content',
        placeholder: 'Get Started',
      },
      {
        name: 'ctaLink',
        label: 'Button Link',
        type: 'url',
        tab: 'content',
        placeholder: '/signup?plan=pro',
      },
    ],
  },
]

// Block-specific design fields
const pricingDesignFields: FieldDefinition[] = [
  {
    name: 'columns',
    label: 'Layout',
    type: 'select',
    tab: 'design',
    default: 'auto',
    options: [
      { label: 'Auto (responsive)', value: 'auto' },
      { label: '2 Columns', value: '2' },
      { label: '3 Columns', value: '3' },
      { label: '4 Columns', value: '4' },
    ],
  },
]

// Export combined field definitions
export const fieldDefinitions: FieldDefinition[] = [
  ...baseContentFields,      // title, content, cta
  ...pricingContentFields,   // plans array
  ...baseDesignFields,       // backgroundColor
  ...pricingDesignFields,    // columns
  ...baseAdvancedFields,     // className, id
]

// Alias for compatibility
export const fields = fieldDefinitions
```

#### Using the Media Library Field Type

For image fields in blocks, use `type: 'media-library'` instead of `type: 'image'`. This opens the full Media Library modal where users can browse, search, filter, and upload images:

```typescript
// Regular field
{
  name: 'backgroundImage',
  label: 'Background Image',
  type: 'media-library',    // Opens Media Library modal
  tab: 'design',
  required: false,
  helpText: 'Optional background image (recommended: 1920x1080px)',
}

// Inside an array field
{
  name: 'logos',
  type: 'array',
  tab: 'content',
  itemFields: [
    {
      name: 'image',
      label: 'Logo Image',
      type: 'media-library',  // Also works in arrays
      tab: 'content',
      required: true,
    },
    // ... other fields
  ],
}
```

The `media-library` field stores a **URL string** in the block data, so no schema changes are needed — blocks continue to use `z.string().url()` or `z.string().optional()`.

> **Note:** The old `type: 'image'` field still works but uses a basic drag-and-drop upload. For a better user experience, prefer `type: 'media-library'`. See [Media Library in Block Editor](../21-media-library/04-block-editor-integration.md) for details.

### Step 3: schema.ts

Define validation schema with Zod:

```typescript
// contents/themes/default/blocks/pricing-table/schema.ts
import { z } from 'zod'
import { baseBlockSchema, type BaseBlockProps } from '@/core/types/blocks'

// Define plan schema
const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  price: z.string().min(1, 'Price is required'),
  description: z.string().optional(),
  features: z.string().optional(),  // Newline-separated
  highlighted: z.boolean().default(false),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
})

// Block-specific schema
export const pricingSpecificSchema = z.object({
  plans: z.array(planSchema).min(1).max(4),
  columns: z.enum(['auto', '2', '3', '4']).default('auto'),
})

// Combined schema
export const schema = baseBlockSchema.merge(pricingSpecificSchema)

// Export types
export type PlanConfig = z.infer<typeof planSchema>
export type PricingTableBlockProps = z.infer<typeof schema>
export type { BaseBlockProps }
```

### Step 4: component.tsx

Create the React component:

```typescript
// contents/themes/default/blocks/pricing-table/component.tsx
import React from 'react'
import { Button } from '@/core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/core/components/ui/card'
import { Check } from 'lucide-react'
import { cn } from '@/core/lib/utils'
import { buildSectionClasses } from '@/core/types/blocks'
import type { PricingTableBlockProps, PlanConfig } from './schema'

export function PricingTableBlock({
  // Base content props
  title,
  content,
  // Block-specific props
  plans = [],
  columns = 'auto',
  // Base design props
  backgroundColor,
  // Base advanced props
  className,
  id,
}: PricingTableBlockProps) {
  // Parse features from newline-separated string
  const parseFeatures = (features?: string): string[] => {
    if (!features) return []
    return features.split('\n').map(f => f.trim()).filter(Boolean)
  }

  // Determine column classes
  const columnClasses: Record<string, string> = {
    auto: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    '2': 'sm:grid-cols-2',
    '3': 'sm:grid-cols-2 lg:grid-cols-3',
    '4': 'sm:grid-cols-2 lg:grid-cols-4',
  }

  // Build section classes
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 md:py-24',
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses}>
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        {(title || content) && (
          <div className="mb-12 text-center">
            {title && (
              <h2 className="mb-4 text-4xl font-bold md:text-5xl">
                {title}
              </h2>
            )}
            {content && (
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {content}
              </p>
            )}
          </div>
        )}

        {/* Plans Grid */}
        <div className={cn('grid gap-8', columnClasses[columns])}>
          {plans.map((plan, index) => {
            const features = parseFeatures(plan.features)

            return (
              <Card
                key={index}
                className={cn(
                  'relative flex flex-col',
                  plan.highlighted && 'border-primary shadow-lg scale-105'
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="text-4xl font-bold mt-2">{plan.price}</div>
                  {plan.description && (
                    <CardDescription>{plan.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  {features.length > 0 && (
                    <ul className="space-y-3 mb-6 flex-1">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {plan.ctaText && plan.ctaLink && (
                    <Button
                      asChild
                      className="w-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      <a href={plan.ctaLink}>{plan.ctaText}</a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

### Step 5: index.ts

Create re-exports:

```typescript
// contents/themes/default/blocks/pricing-table/index.ts
export { config } from './config'
export { fieldDefinitions, fields } from './fields'
export { schema, type PricingTableBlockProps, type PlanConfig } from './schema'
export { PricingTableBlock } from './component'
```

### Step 6: Rebuild Registry

Run the build script to register your block:

```bash
node core/scripts/build/registry.mjs
```

**That's it!** Your block is now:
- Registered in `BLOCK_REGISTRY`
- Available in the block library UI
- Automatically lazy-loaded in `PageRenderer`

> **Note**: Block components are auto-generated from `BLOCK_REGISTRY`. No need to manually edit `page-renderer.tsx` - the system discovers and loads blocks dynamically.

## Best Practices

### 1. Extend Base Schemas

Always extend base schemas for consistency:

```typescript
// ✅ Good: Extends base schema
export const schema = baseBlockSchema.merge(customSchema)

// ❌ Bad: Recreates common fields
export const schema = z.object({
  title: z.string(),  // Already in baseBlockSchema
  // ...
})
```

### 2. Use Field Groups

Group related fields visually:

```typescript
const ctaFields: FieldDefinition[] = [
  {
    name: 'cta.text',
    label: 'Button Text',
    type: 'text',
    tab: 'content',
    group: 'cta',
    groupLabel: 'Call to Action',  // First field sets group label
  },
  {
    name: 'cta.link',
    label: 'Button Link',
    type: 'url',
    tab: 'content',
    group: 'cta',  // Same group, no label needed
  },
]
```

### 3. Handle Legacy Props

Support backward compatibility:

```typescript
export function MyBlock({
  content,
  // Legacy prop names
  ...legacyProps
}: MyBlockProps & { description?: string }) {
  // Use new prop with fallback to legacy
  const displayContent = content || legacyProps.description
}
```

### 4. Use Helper Functions

Leverage built-in helpers:

```typescript
import { buildSectionClasses, getBackgroundClasses } from '@/core/types/blocks'

// Build complete section classes
const classes = buildSectionClasses('py-16 px-4', { backgroundColor, className })
```

### 5. Type Your Props

Always type component props from schema:

```typescript
import type { MyBlockProps } from './schema'

export function MyBlock(props: MyBlockProps) {
  // TypeScript will enforce correct prop types
}
```

### 6. Add Data Attributes

Include data attributes for testing:

```typescript
<section
  id={id}
  className={sectionClasses}
  data-block="pricing-table"
>
```

### 7. Responsive Design

Ensure blocks work on all screen sizes:

```typescript
// Use responsive Tailwind classes
<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
```

### 8. Accessibility

Include proper ARIA attributes:

```typescript
<section aria-labelledby={id ? `${id}-heading` : undefined}>
  {title && <h2 id={id ? `${id}-heading` : undefined}>{title}</h2>}
</section>
```

## Testing Your Block

### 1. Unit Tests

Test schema validation:

```typescript
import { schema } from './schema'

describe('PricingTableBlock schema', () => {
  it('validates correct props', () => {
    const result = schema.safeParse({
      plans: [{ name: 'Basic', price: '$9/mo' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid props', () => {
    const result = schema.safeParse({
      plans: [],  // min 1 required
    })
    expect(result.success).toBe(false)
  })
})
```

### 2. Component Tests

Test component rendering:

```typescript
import { render, screen } from '@testing-library/react'
import { PricingTableBlock } from './component'

describe('PricingTableBlock', () => {
  it('renders plans correctly', () => {
    render(
      <PricingTableBlock
        plans={[
          { name: 'Pro', price: '$29/mo', features: 'Feature 1\nFeature 2' },
        ]}
      />
    )

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('$29/mo')).toBeInTheDocument()
    expect(screen.getByText('Feature 1')).toBeInTheDocument()
  })
})
```

### 3. E2E Tests

Test in the page editor:

```typescript
// cypress/e2e/blocks/pricing-table.cy.ts
describe('Pricing Table Block', () => {
  beforeEach(() => {
    cy.login()
    cy.visit('/dashboard/pages/new')
  })

  it('can be added and configured', () => {
    cy.get('[data-cy="block-item-pricing-table"]').click()
    cy.get('[data-cy="field-plans"]').should('exist')
    cy.get('[data-cy="array-field-plans-add"]').click()
    cy.get('[data-cy="array-field-plans-0-name"]').type('Basic Plan')
  })
})
```

## Troubleshooting

### Block Not Appearing in Library

1. Check that `config.ts` has `scope` property (e.g., `scope: ['pages']`)
2. Verify `scope` includes the entity you're editing (e.g., 'pages' or 'posts')
3. Check that `config.ts` has correct `slug`
4. Run `node core/scripts/build/registry.mjs`
5. Restart the dev server
6. Check console for registry errors

> **Common mistake**: Missing or undefined `scope` makes the block unavailable everywhere.

### Form Fields Not Showing

1. Verify `fieldDefinitions` is exported from `fields.ts`
2. Check `tab` property on each field ('content', 'design', 'advanced')
3. Ensure field `name` matches schema property

### Component Not Rendering on Public Page

1. Verify component is exported correctly from `component.tsx`
2. Check that export name ends with `Block` (e.g., `HeroBlock`, `PricingTableBlock`)
3. Check browser console for import/loading errors
4. Verify `componentPath` in registry matches actual file location

> **Note**: Manual editing of `page-renderer.tsx` is no longer required. Block components are auto-discovered from `BLOCK_REGISTRY`.

## Next Steps

1. **[Block Editor](./05-block-editor.md)** - Understand editor components
2. **[Block System](./03-block-system.md)** - Deep dive into types
3. **[Troubleshooting](./09-troubleshooting.md)** - Common issues

---

> **Pro Tip**: Start with a simple block (text-content style) before creating complex ones with arrays. This helps you understand the system flow.

**Last Updated**: 2025-12-17
**Version**: 1.2.0
**Status**: Stable
