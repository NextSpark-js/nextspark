# Media Library in Block Editor

**Using the Media Library for image selection in page builder blocks**

---

## Table of Contents

- [Overview](#overview)
- [The media-library Field Type](#the-media-library-field-type)
- [How It Replaces the image Field Type](#how-it-replaces-the-image-field-type)
- [MediaLibraryField Component](#medialibraryfieldcomponent)
- [ArrayMediaLibraryField Component](#arraymedialibraryfield-component)
- [Data Flow](#data-flow)
- [Blocks Using media-library](#blocks-using-media-library)
- [Migration Guide](#migration-guide)
- [Code Examples](#code-examples)

---

## Overview

The Media Library integrates with the NextSpark block editor (page builder) through a custom field type called `media-library`. When a block field uses this type, the block editor renders a media picker that opens the full MediaLibrary modal for image selection.

This replaces the older `image` field type which used a basic URL input or file upload component (`ImageUpload`). The `media-library` type provides a richer experience with search, filtering, tagging, and centralized media management.

---

## The media-library Field Type

The `media-library` field type is defined in the `FieldDefinition` type in `core/types/blocks.ts`:

```typescript
type FieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'email'
  | 'number'
  | 'color'
  | 'image'            // Legacy: basic image upload
  | 'media-library'    // New: opens Media Library modal
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'rich-text'
  | 'array'
  | 'date'
```

When the block editor encounters a field with `type: 'media-library'`, it renders the `MediaLibraryField` component instead of the standard `ImageUpload` component.

---

## How It Replaces the image Field Type

| Feature | `type: 'image'` (Legacy) | `type: 'media-library'` (New) |
|---------|--------------------------|-------------------------------|
| Upload | Direct upload via `ImageUpload` | Upload via Media Library modal |
| Browse existing | Not supported | Full media browser with search |
| Tags | Not supported | Tag-based organization |
| Metadata | Not supported | Title, alt text, caption |
| Duplicate check | Not supported | Automatic duplicate detection |
| Shared across blocks | Not shared | Centralized media library |
| Stored value | URL string | URL string (same format) |

Both field types store the result as a **URL string** in the block data, making them backward compatible. Switching from `image` to `media-library` requires no data migration.

---

## MediaLibraryField Component

The `MediaLibraryField` is defined inside `dynamic-form.tsx` and handles single-image selection for top-level block fields.

**Source:** `core/components/dashboard/block-editor/dynamic-form.tsx`

```typescript
function MediaLibraryField({
  value,
  onChange,
  fieldName,
}: {
  value: string
  onChange: (url: string) => void
  fieldName: string
})
```

### Behavior

1. **Empty state**: Renders a dashed-border placeholder with an image icon and "Browse Media" text
2. **With value**: Renders the image preview with hover overlay containing "Change" and "Remove" buttons
3. **On click**: Opens `MediaLibrary` modal in single mode with `allowedTypes={['image']}`
4. **On select**: Extracts `media.url` from the selected Media object and passes it to `onChange`

### Data-cy Selectors

| Selector | Element |
|----------|---------|
| `blockEditor.blockPropertiesPanel.form.mediaField.preview` | Image preview container |
| `blockEditor.blockPropertiesPanel.form.mediaField.changeBtn` | "Change" button (hover overlay) |
| `blockEditor.blockPropertiesPanel.form.mediaField.removeBtn` | "Remove" button (hover overlay) |
| `blockEditor.blockPropertiesPanel.form.mediaField.empty` | Empty state placeholder |

---

## ArrayMediaLibraryField Component

The `ArrayMediaLibraryField` is defined inside `array-field.tsx` and handles image selection within array (repeater) fields, such as testimonials or logo clouds where each item has an image.

**Source:** `core/components/dashboard/block-editor/array-field.tsx`

```typescript
function ArrayMediaLibraryField({
  value,
  onChange,
  fieldName,
}: {
  value: string
  onChange: (url: string) => void
  fieldName: string
})
```

### Behavior

Identical to `MediaLibraryField` but used within the context of array items. Each array item with a `media-library` field gets its own independent media picker.

### Integration in ArrayField

When the `ArrayField` component renders a sub-field with `type: 'media-library'`, it delegates to `ArrayMediaLibraryField`:

```typescript
case 'media-library':
  return (
    <ArrayMediaLibraryField
      value={String(fieldValue || '')}
      onChange={(url) => handleItemFieldChange(itemIndex, itemField.name, url)}
      fieldName={`${field.name}-${itemIndex}-${itemField.name}`}
    />
  )
```

---

## Data Flow

The key architectural decision is that the block editor stores **URL strings**, not media IDs. This maintains backward compatibility and simplifies rendering.

```text
Block Field Definition          Block Editor                     Block Component
  type: 'media-library'   -->  MediaLibraryField          -->   <img src={url} />
                                  |
                                  | opens MediaLibrary modal
                                  | user selects media item
                                  |
                                  | media.url extracted
                                  | stored as string value
                                  v
                               Block Data: { backgroundImage: "https://..." }
```

### Why URL String Instead of Media ID?

1. **Backward compatibility**: Existing blocks with `type: 'image'` already store URLs
2. **No resolution step**: Block components render `<img src={url}>` directly without an API call
3. **SSR friendly**: No server-side data fetching needed to resolve media IDs to URLs
4. **CDN optimization**: URLs can point to Vercel Blob or any CDN

### Trade-off

Storing URLs means that if a media file's URL changes (e.g., re-upload), blocks referencing the old URL will break. This is an acceptable trade-off because:
- Vercel Blob URLs are immutable (each upload gets a unique URL)
- Local storage URLs include timestamp-based unique filenames
- The older `image` field type had the same behavior

---

## Blocks Using media-library

Seven blocks in the default theme use the `media-library` field type:

### 1. Hero Block

**File:** `themes/default/blocks/hero/fields.ts`

```typescript
{
  name: 'backgroundImage',
  label: 'Background Image',
  type: 'media-library',
  tab: 'design',
  required: false,
  helpText: 'Optional background image (recommended: 1920x1080px minimum)',
}
```

### 2. Hero with Form Block

**File:** `themes/default/blocks/hero-with-form/fields.ts`

```typescript
{
  name: 'backgroundImage',
  label: 'Background Image',
  type: 'media-library',
  tab: 'content',
  required: true,
  helpText: 'Full-width background image (recommended: 1920x1080px minimum)',
}
```

### 3. Jumbotron Block

**File:** `themes/default/blocks/jumbotron/fields.ts`

```typescript
{
  name: 'backgroundImage',
  label: 'Background Image',
  type: 'media-library',
  tab: 'design',
  required: false,
  helpText: 'Optional background image (recommended: 1920x1080px minimum)',
}
```

### 4. Video Hero Block

**File:** `themes/default/blocks/video-hero/fields.ts`

```typescript
{
  name: 'videoThumbnail',
  label: 'Custom Thumbnail',
  type: 'media-library',
  tab: 'content',
  required: false,
  helpText: 'Optional custom thumbnail shown before video plays (recommended: 1920x1080px)',
}
```

### 5. Split Content Block

**File:** `themes/default/blocks/split-content/fields.ts`

```typescript
{
  name: 'image',
  label: 'Image',
  type: 'media-library',
  tab: 'content',
  required: true,
  helpText: 'Featured image (recommended: 800x600px minimum)',
}
```

### 6. Logo Cloud Block (Array Item)

**File:** `themes/default/blocks/logo-cloud/fields.ts`

Used inside an array field where each logo item has an image:

```typescript
{
  name: 'image',
  label: 'Logo Image',
  type: 'media-library',
  tab: 'content',
  required: true,
  helpText: 'Logo image URL (recommended: transparent PNG, 200x100px)',
}
```

### 7. Testimonials Block (Array Item)

**File:** `themes/default/blocks/testimonials/fields.ts`

Used inside an array field where each testimonial has an avatar:

```typescript
{
  name: 'avatar',
  label: 'Avatar Image',
  type: 'media-library',
  tab: 'content',
  required: false,
  description: 'Profile picture of the person',
}
```

---

## Migration Guide

### Migrating from `type: 'image'` to `type: 'media-library'`

Since both field types store URL strings, migration requires only a field definition change. No data migration is needed.

**Before:**

```typescript
// themes/default/blocks/my-block/fields.ts
export const fieldDefinitions: FieldDefinition[] = [
  {
    name: 'heroImage',
    label: 'Hero Image',
    type: 'image',           // Legacy
    tab: 'content',
    required: true,
  },
]
```

**After:**

```typescript
// themes/default/blocks/my-block/fields.ts
export const fieldDefinitions: FieldDefinition[] = [
  {
    name: 'heroImage',
    label: 'Hero Image',
    type: 'media-library',   // Updated
    tab: 'content',
    required: true,
    helpText: 'Select an image from the Media Library',
  },
]
```

### Steps

1. Open the block's `fields.ts` file
2. Change `type: 'image'` to `type: 'media-library'`
3. Optionally add `helpText` for user guidance
4. No changes needed to `schema.ts`, `component.tsx`, or block data
5. Rebuild registries: `pnpm dev` (auto-rebuilds) or `rm -rf apps/dev/.nextspark/registries && pnpm dev`

### For Array Fields

The same change applies to sub-fields within array definitions:

```typescript
// Before
{
  name: 'items',
  type: 'array',
  fields: [
    { name: 'image', label: 'Image', type: 'image' },   // Legacy
  ]
}

// After
{
  name: 'items',
  type: 'array',
  fields: [
    { name: 'image', label: 'Image', type: 'media-library' },   // Updated
  ]
}
```

---

## Code Examples

### Complete Block Field Definition

```typescript
import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

const customDesignFields: FieldDefinition[] = [
  {
    name: 'backgroundImage',
    label: 'Background Image',
    type: 'media-library',
    tab: 'design',
    required: false,
    helpText: 'Optional background image (recommended: 1920x1080px minimum)',
  },
  {
    name: 'textColor',
    label: 'Text Color',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'light',
    options: [
      { label: 'Light (for dark backgrounds)', value: 'light' },
      { label: 'Dark (for light backgrounds)', value: 'dark' },
    ],
  },
]

export const fieldDefinitions: FieldDefinition[] = [
  ...baseContentFields,
  ...baseDesignFields,
  ...customDesignFields,
  ...baseAdvancedFields,
]
```

### Using the Image in a Block Component

```tsx
// themes/default/blocks/my-block/component.tsx
interface MyBlockProps {
  backgroundImage?: string
  title: string
  content: string
}

export function MyBlock({ backgroundImage, title, content }: MyBlockProps) {
  return (
    <section
      className="relative py-20"
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <div className="container mx-auto px-4">
        <h2>{title}</h2>
        <p>{content}</p>
      </div>
    </section>
  )
}
```

---

**Documentation:** `core/docs/21-media-library/04-block-editor-integration.md`
