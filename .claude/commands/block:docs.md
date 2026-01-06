---
description: "[Block] Generate documentation for a page builder block"
---

# Document Block

You are generating documentation for a page builder block.

**Documentation Request:**
{{{ input }}}

---

## Protocol

### Step 1: Determine Theme

Check if `--theme=X` was specified in the input above.

- **If specified:** Use that theme
- **If not specified:** Read `NEXT_PUBLIC_ACTIVE_THEME` from `.env` or `.env.local`
- **If no variable:** Use `"default"`

```bash
grep "NEXT_PUBLIC_ACTIVE_THEME" .env .env.local 2>/dev/null
```

### Step 2: Identify Block

Extract the block slug from the input.

```bash
# Verify block exists
ls contents/themes/{THEME}/blocks/{slug}/
```

**If block not found, list available blocks.**

### Step 3: Read Block Files

Read all 5 files to extract complete information:

```bash
# Read all block files
cat contents/themes/{THEME}/blocks/{slug}/config.ts
cat contents/themes/{THEME}/blocks/{slug}/schema.ts
cat contents/themes/{THEME}/blocks/{slug}/fields.ts
cat contents/themes/{THEME}/blocks/{slug}/component.tsx
cat contents/themes/{THEME}/blocks/{slug}/index.ts
```

### Step 4: Generate Documentation

Create comprehensive documentation based on the block structure.

---

## Output Format

```markdown
# {Block Name} Block

> {Description from config.ts}

## Overview

| Property | Value |
|----------|-------|
| **Slug** | `{slug}` |
| **Category** | {category} |
| **Icon** | {icon} |
| **Thumbnail** | {thumbnail path or "Not set"} |
| **Location** | `contents/themes/{theme}/blocks/{slug}/` |

---

## Props Reference

### Base Props (Inherited)

These props come from `baseBlockSchema` and are available in ALL blocks:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string?` | `''` | Block title/heading |
| `content` | `string?` | `''` | Main content text (rich text supported) |
| `cta.text` | `string?` | `''` | Call-to-action button text |
| `cta.link` | `string?` | `''` | CTA button URL |
| `cta.target` | `'_self' \| '_blank'` | `'_self'` | Link target |
| `backgroundColor` | `BackgroundColor` | `'transparent'` | Section background |
| `className` | `string?` | `''` | Additional CSS classes |
| `id` | `string?` | `''` | HTML id for anchors |

### Block-Specific Props

{Table of block-specific props from schema.ts}

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `{name}` | `{type}` | {Yes/No} | `{default}` | {description} |

---

## Editor Fields

### Content Tab

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Title | text | No | Block heading |
| Content | rich-text | No | Main content area |
| CTA Text | text | No | Button text |
| CTA Link | url | No | Button URL |
| {block-specific content fields} |

### Design Tab

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Background Color | select | No | Section background color |
| {block-specific design fields} |

### Advanced Tab

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| CSS Class | text | No | Additional CSS classes |
| HTML ID | text | No | Element ID for anchor links |

---

## Usage Example

### In Page Editor

1. Open the Page Editor
2. Click "Add Block" in the block picker
3. Select "{Block Name}" from the {category} category
4. Configure fields in the settings panel
5. Save the page

### JSON Structure (BlockInstance)

```json
{
  "id": "uuid-here",
  "blockSlug": "{slug}",
  "props": {
    "title": "Example Title",
    "content": "Example content text",
    "cta.text": "Learn More",
    "cta.link": "/about",
    "backgroundColor": "primary",
    {block-specific example props}
  }
}
```

### Rendered HTML Structure

```html
<section
  id="optional-id"
  class="py-16 px-4 bg-primary text-primary-foreground optional-class"
  data-cy="block-{slug}"
>
  <h2 class="...">Title</h2>
  <div class="prose">Content</div>
  {block-specific structure}
</section>
```

---

## Component Code

### File: `component.tsx`

```typescript
{Show simplified component structure highlighting key patterns}
```

### Key Patterns Used

- ✅ Uses `buildSectionClasses` for consistent styling
- ✅ Has `data-cy="block-{slug}"` for testing
- ✅ Handles optional props safely
- ✅ Supports responsive design
- {Any other notable patterns}

---

## Styling

### Background Color Options

| Value | CSS Classes |
|-------|-------------|
| `transparent` | (no background) |
| `white` | `bg-white` |
| `gray-50` | `bg-gray-50` |
| `gray-100` | `bg-gray-100` |
| `gray-900` | `bg-gray-900 text-white` |
| `primary` | `bg-primary text-primary-foreground` |
| `primary-light` | `bg-primary/10` |
| `primary-dark` | `bg-primary-dark text-white` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `accent` | `bg-accent text-accent-foreground` |

### Custom Styling

Add custom CSS classes via the "CSS Class" field in the Advanced tab.

```html
<!-- Example with custom class -->
<section class="py-16 px-4 bg-primary my-custom-class">
```

---

## Testing

### Cypress Selector

```typescript
cy.get('[data-cy="block-{slug}"]')
```

### Test Cases to Consider

1. Block renders with minimal props
2. Block renders with all props filled
3. CTA button works when provided
4. Background colors apply correctly
5. Custom className is applied
6. HTML id is applied for anchor links

---

## Related

- **Schema:** `contents/themes/{theme}/blocks/{slug}/schema.ts`
- **Fields:** `contents/themes/{theme}/blocks/{slug}/fields.ts`
- **Component:** `contents/themes/{theme}/blocks/{slug}/component.tsx`
- **Similar Blocks:** {list similar blocks in same category}
- **Documentation:** `core/docs/18-page-builder/`
```

---

**Now generate documentation for the block specified above.**
