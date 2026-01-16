# /how-to:create-block

Interactive guide to create page builder blocks in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/page-builder-blocks/SKILL.md` - Block structure and patterns
- `.claude/skills/block-decision-matrix/SKILL.md` - When to create new vs use existing
- `.claude/skills/tailwind-theming/SKILL.md` - Styling with Tailwind CSS

---

## Syntax

```
/how-to:create-block
/how-to:create-block [block-name]
```

---

## Behavior

Guides the user through creating a page builder block with all 5 required files, following NextSpark conventions.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding Block Structure
        └── The 5 required files explained

Step 2: Create Block Configuration (config.ts)
        └── Define block metadata and category

Step 3: Create Schema (schema.ts)
        └── Define Zod schema extending baseBlockSchema

Step 4: Create Fields Definition (fields.ts)
        └── Define form fields for the editor

Step 5: Create React Component (component.tsx)
        └── Build the visual component

Bonus: Register and Test
        └── Rebuild registry and preview
```

---

## Step 1: Understanding Block Structure

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE A BLOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding Block Structure

Every page builder block in NextSpark consists of 5 files:

contents/themes/{theme}/blocks/{block-name}/
├── config.ts       # Block metadata (name, category, icon)
├── schema.ts       # Zod schema for data validation
├── fields.ts       # Form fields for the editor UI
├── component.tsx   # React component that renders
└── index.ts        # Barrel export file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Why 5 files?

• config.ts    - Registry needs to know block metadata
• schema.ts    - Ensures data integrity with Zod
• fields.ts    - Powers the visual editor form
• component.tsx - What users see on the page
• index.ts     - Clean imports for the registry

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2
[2] I have a question about block structure
[3] Show me an example of each file
```

---

## Step 2: Create Block Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Create Block Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The config.ts file defines your block's identity:
```

**📋 config.ts Example:**

```typescript
// contents/themes/default/blocks/hero-banner/config.ts
import type { BlockConfig } from '@/core/types/block'
import { LayoutTemplate } from 'lucide-react'

export const config: BlockConfig = {
  // Unique identifier (kebab-case)
  name: 'hero-banner',

  // Display name in editor (i18n key)
  displayName: 'blocks.heroBanner.name',

  // Short description (i18n key)
  description: 'blocks.heroBanner.description',

  // Category for grouping in editor
  category: 'hero',  // hero | content | features | cta | footer

  // Lucide icon component
  icon: LayoutTemplate,

  // Available style variants
  variants: ['default', 'centered', 'split'],

  // Default variant
  defaultVariant: 'default',
}

export default config
```

**📋 Key Points:**

- `name`: Must match folder name (kebab-case)
- `displayName`: Use i18n key, add translation later
- `category`: Groups blocks in the editor sidebar
- `variants`: Optional different visual styles

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3
[2] I have a question about config
[3] What categories are available?
[4] Let me create this file for my block now
```

---

## Step 3: Create Schema

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Create Schema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The schema.ts file validates block data with Zod:
```

**📋 schema.ts Example:**

```typescript
// contents/themes/default/blocks/hero-banner/schema.ts
import { z } from 'zod'
import { baseBlockSchema } from '@/core/lib/blocks/base-schema'

// CRITICAL: Always extend baseBlockSchema
export const heroBannerSchema = baseBlockSchema.extend({
  // Required fields
  title: z.string().min(1).max(100),

  // Optional fields with defaults
  subtitle: z.string().max(200).optional(),

  // CTA button (optional object)
  cta: z.object({
    text: z.string().min(1).max(50),
    url: z.string().url(),
    variant: z.enum(['primary', 'secondary', 'outline']).default('primary'),
  }).optional(),

  // Background settings
  background: z.object({
    type: z.enum(['color', 'image', 'gradient']).default('color'),
    value: z.string().optional(),
  }).default({ type: 'color' }),

  // Alignment
  alignment: z.enum(['left', 'center', 'right']).default('center'),
})

// Export the type for TypeScript
export type HeroBannerData = z.infer<typeof heroBannerSchema>

export default heroBannerSchema
```

**⚠️ CRITICAL: Always extend baseBlockSchema!**

The baseBlockSchema includes:
- `id`: string (unique block ID)
- `type`: string (block type name)
- `variant`: string (selected variant)
- `order`: number (position on page)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4
[2] What types of fields can I use?
[3] Show me validation examples
[4] Let me create my schema now
```

---

## Step 4: Create Fields Definition

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Create Fields Definition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The fields.ts file defines the editor form UI:
```

**📋 fields.ts Example:**

```typescript
// contents/themes/default/blocks/hero-banner/fields.ts
import type { BlockFieldDefinition } from '@/core/types/block'

export const fields: BlockFieldDefinition[] = [
  // Text input field
  {
    name: 'title',
    type: 'text',
    label: 'blocks.heroBanner.fields.title',
    placeholder: 'blocks.heroBanner.placeholders.title',
    required: true,
    group: 'content',
  },

  // Textarea field
  {
    name: 'subtitle',
    type: 'textarea',
    label: 'blocks.heroBanner.fields.subtitle',
    rows: 2,
    group: 'content',
  },

  // Nested object fields (CTA)
  {
    name: 'cta.text',
    type: 'text',
    label: 'blocks.heroBanner.fields.ctaText',
    group: 'cta',
  },
  {
    name: 'cta.url',
    type: 'url',
    label: 'blocks.heroBanner.fields.ctaUrl',
    group: 'cta',
  },
  {
    name: 'cta.variant',
    type: 'select',
    label: 'blocks.heroBanner.fields.ctaVariant',
    options: [
      { value: 'primary', label: 'Primary' },
      { value: 'secondary', label: 'Secondary' },
      { value: 'outline', label: 'Outline' },
    ],
    group: 'cta',
  },

  // Alignment select
  {
    name: 'alignment',
    type: 'select',
    label: 'blocks.heroBanner.fields.alignment',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
    group: 'style',
  },
]

// Field groups for editor tabs
export const fieldGroups = [
  { id: 'content', label: 'Content' },
  { id: 'cta', label: 'Call to Action' },
  { id: 'style', label: 'Style' },
]

export default fields
```

**📋 Available Field Types:**

- `text` - Single line text input
- `textarea` - Multi-line text
- `number` - Numeric input
- `select` - Dropdown selection
- `checkbox` - Boolean toggle
- `url` - URL with validation
- `image` - Image upload/selection
- `color` - Color picker
- `richtext` - Rich text editor

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5
[2] Show me more field type examples
[3] How do I handle nested fields?
[4] Let me create my fields now
```

---

## Step 5: Create Component

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Create React Component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The component.tsx file renders your block:
```

**📋 component.tsx Example:**

```typescript
// contents/themes/default/blocks/hero-banner/component.tsx
import type { HeroBannerData } from './schema'
import { cn } from '@/core/lib/utils'
import { Button } from '@/core/components/ui/button'

interface HeroBannerProps {
  data: HeroBannerData
  isPreview?: boolean
}

export function HeroBanner({ data, isPreview }: HeroBannerProps) {
  const { title, subtitle, cta, alignment, variant } = data

  // Alignment classes
  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }

  return (
    <section
      data-cy="block-hero-banner"
      data-block-type="hero-banner"
      data-variant={variant}
      className={cn(
        'py-20 px-4 flex flex-col gap-6',
        alignmentClasses[alignment || 'center']
      )}
    >
      {/* Title */}
      <h1
        data-cy="hero-banner-title"
        className="text-4xl md:text-6xl font-bold"
      >
        {title}
      </h1>

      {/* Subtitle */}
      {subtitle && (
        <p
          data-cy="hero-banner-subtitle"
          className="text-xl text-muted-foreground max-w-2xl"
        >
          {subtitle}
        </p>
      )}

      {/* CTA Button */}
      {cta && (
        <Button
          data-cy="hero-banner-cta"
          variant={cta.variant}
          asChild
        >
          <a href={cta.url}>{cta.text}</a>
        </Button>
      )}
    </section>
  )
}

export default HeroBanner
```

**⚠️ CRITICAL: Always add data-cy attributes!**

Required selectors for testing:
- `data-cy="block-{block-name}"` - Main container
- `data-cy="{block-name}-{element}"` - Key elements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Bonus: Register and Test
[2] How do I handle variants?
[3] Best practices for styling?
[4] Let me create my component now
```

---

## Bonus: Register and Test

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BONUS: Register and Test Your Block
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**1️⃣ Create the index.ts barrel file:**

```typescript
// contents/themes/default/blocks/hero-banner/index.ts
export { config } from './config'
export { heroBannerSchema as schema } from './schema'
export { fields, fieldGroups } from './fields'
export { HeroBanner as Component } from './component'
```

**2️⃣ Add translations (messages/en.json):**

```json
{
  "blocks": {
    "heroBanner": {
      "name": "Hero Banner",
      "description": "Large hero section with title and CTA",
      "fields": {
        "title": "Title",
        "subtitle": "Subtitle",
        "ctaText": "Button Text",
        "ctaUrl": "Button URL",
        "ctaVariant": "Button Style",
        "alignment": "Alignment"
      },
      "placeholders": {
        "title": "Enter your headline..."
      }
    }
  }
}
```

**3️⃣ Rebuild the registry:**

```bash
node core/scripts/build/registry.mjs
```

**4️⃣ Test your block:**

- Start dev server: `pnpm dev`
- Go to Page Builder in dashboard
- Find your block in the sidebar
- Add it to a page and configure

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned how to create a page builder block.

📚 Related tutorials:
   • /how-to:customize-theme - Customize your theme's design
   • /how-to:add-translations - Add more translations

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

At each step, Claude should:

1. **Validate understanding** - Ask if the user has questions
2. **Offer to implement** - Let user create files immediately
3. **Show examples** - Provide real code samples
4. **Answer questions** - Pause for clarification

---

## Common Questions

### "What categories are available?"

```
📋 Block Categories:

• hero      - Large header sections
• content   - General content blocks
• features  - Feature showcases
• cta       - Call to action sections
• footer    - Footer components
• gallery   - Image galleries
• testimonials - Reviews and testimonials
• pricing   - Pricing tables
• faq       - FAQ/Accordion sections
• custom    - Theme-specific blocks
```

### "How do I handle variants?"

**📋 Handling Variants:**

Variants allow different visual styles for the same block.

In your component, use the variant prop:

```typescript
export function HeroBanner({ data }: Props) {
  const { variant } = data

  // Variant-specific classes
  const variantClasses = {
    default: 'bg-background',
    centered: 'bg-muted text-center',
    split: 'grid grid-cols-2 gap-8',
  }

  return (
    <section className={cn('py-20', variantClasses[variant])}>
      {variant === 'split' ? (
        <SplitLayout {...data} />
      ) : (
        <DefaultLayout {...data} />
      )}
    </section>
  )
}
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:block:create` | Create block via session workflow |
| `/session:block:validate` | Validate block structure |
| `/how-to:customize-theme` | Theme customization |
