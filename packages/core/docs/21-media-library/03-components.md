# Media Components

**9 React components for building media management interfaces**

---

## Table of Contents

- [Overview](#overview)
- [Import Paths](#import-paths)
- [MediaLibrary](#medialibrary)
- [MediaSelector](#mediaselector)
- [MediaGrid](#mediagrid)
- [MediaList](#medialist)
- [MediaCard](#mediacard)
- [MediaToolbar](#mediatoolbar)
- [MediaDetailPanel](#mediadetailpanel)
- [MediaUploadZone](#mediauploadzone)
- [MediaTagFilter](#mediatagfilter)
- [Hooks Reference](#hooks-reference)

---

## Overview

The Media Library provides 9 React components that work together to deliver a complete media management experience. All components are client components (`'use client'`) and use `next-intl` for internationalization with the `media` namespace.

All components use `data-cy` selectors defined in `media.selectors.ts` for Cypress testing.

---

## Import Paths

All media components are available via the barrel export:

```typescript
import {
  MediaLibrary,
  MediaSelector,
  MediaGrid,
  MediaList,
  MediaCard,
  MediaToolbar,
  MediaDetailPanel,
  MediaUploadZone,
  MediaTagFilter,
} from '@nextsparkjs/core/components/media'
```

Individual imports:

```typescript
import { MediaLibrary } from '@nextsparkjs/core/components/media/MediaLibrary'
import { MediaSelector } from '@nextsparkjs/core/components/media/MediaSelector'
```

Types:

```typescript
import type { Media, MediaListOptions, MediaTag } from '@nextsparkjs/core/lib/media/types'
```

---

## MediaLibrary

The main modal component for browsing, uploading, and selecting media. Manages all internal state including search, filtering, sorting, selection, and view mode.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | - | Controls modal visibility |
| `onClose` | `() => void` | - | Called when modal is dismissed |
| `onSelect` | `(media: Media \| Media[]) => void` | - | Called when user confirms selection |
| `mode` | `'single' \| 'multiple'` | `'single'` | Selection mode |
| `allowedTypes` | `('image' \| 'video')[]` | - | Restrict to specific media types |
| `maxSelections` | `number` | - | Maximum number of items in multiple mode |

### Usage - Single Selection

```tsx
import { useState } from 'react'
import { MediaLibrary } from '@nextsparkjs/core/components/media'
import type { Media } from '@nextsparkjs/core/lib/media/types'

function ImagePicker() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  const handleSelect = (media: Media | Media[]) => {
    if (!Array.isArray(media)) {
      setSelectedUrl(media.url)
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Choose Image</button>
      {selectedUrl && <img src={selectedUrl} alt="Selected" />}

      <MediaLibrary
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelect}
        mode="single"
        allowedTypes={['image']}
      />
    </>
  )
}
```

### Usage - Multiple Selection

```tsx
function GalleryPicker() {
  const [isOpen, setIsOpen] = useState(false)
  const [images, setImages] = useState<Media[]>([])

  const handleSelect = (media: Media | Media[]) => {
    if (Array.isArray(media)) {
      setImages(media)
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Select Images ({images.length} selected)
      </button>

      <MediaLibrary
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelect}
        mode="multiple"
        maxSelections={10}
        allowedTypes={['image']}
      />
    </>
  )
}
```

### Internal State

The component manages the following internal state:
- `viewMode` - Grid or list view (`'grid' | 'list'`)
- `searchQuery` - Current search text (debounced by 300ms)
- `typeFilter` - Media type filter (`'all' | 'image' | 'video'`)
- `sortBy` / `sortDir` - Sort field and direction
- `selectedIds` - Set of selected media IDs
- `selectedTagIds` - Array of active tag filter IDs
- `showUploadZone` - Whether the upload area is visible
- `editingMedia` - Media item being edited in the detail panel
- `deletingMedia` - Media item pending deletion confirmation

---

## MediaSelector

A form field component that displays a selected media preview and opens the MediaLibrary modal for selection. Designed for use in entity forms and settings pages.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string \| null` | - | Currently selected media ID |
| `onChange` | `(mediaId: string \| null, media: Media \| null) => void` | - | Called when selection changes |
| `mode` | `'single'` | `'single'` | Selection mode (only single supported) |
| `allowedTypes` | `('image' \| 'video')[]` | - | Restrict to specific media types |
| `className` | `string` | - | Additional CSS classes |
| `disabled` | `boolean` | `false` | Disable interaction |

### Usage

```tsx
import { MediaSelector } from '@nextsparkjs/core/components/media'

function ProductForm() {
  const [mediaId, setMediaId] = useState<string | null>(null)

  return (
    <div>
      <label>Product Image</label>
      <MediaSelector
        value={mediaId}
        onChange={(id, media) => {
          setMediaId(id)
          if (media) {
            console.log('Selected URL:', media.url)
          }
        }}
        allowedTypes={['image']}
      />
    </div>
  )
}
```

### States

- **Empty state**: Shows a dashed border card with an image icon and "Select Media" button
- **Selected state**: Shows the media preview thumbnail, filename, dimensions, and "Change" / "Remove" buttons
- **Disabled state**: Grayed out with no click interaction

---

## MediaGrid

Responsive grid view that renders `MediaCard` components for each media item. Supports configurable column count and responsive breakpoints (6 columns on desktop, adapts on smaller screens).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `Media[]` | - | Array of media items to display |
| `isLoading` | `boolean` | - | Show skeleton loading state |
| `selectedIds` | `Set<string>` | - | Set of selected media IDs |
| `onSelect` | `(media: Media) => void` | - | Called when a media item is clicked |
| `onEdit` | `(media: Media) => void` | - | Called when edit action is triggered |
| `onDelete` | `(media: Media) => void` | - | Called when delete action is triggered |
| `mode` | `'single' \| 'multiple'` | `'single'` | Selection mode (shows checkboxes in multiple) |
| `columns` | `number` | `6` | Number of grid columns |
| `className` | `string` | - | Additional CSS classes |

### States

- **Loading**: Renders skeleton placeholders (columns x 2 items)
- **Empty**: Shows centered empty state with "No media found" message
- **Loaded**: Renders grid of `MediaCard` components

---

## MediaList

Table/list view of media items with columns for thumbnail, filename, type, file size, dimensions, upload date, and actions. Responsive with columns hidden on smaller screens.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `Media[]` | - | Array of media items to display |
| `isLoading` | `boolean` | - | Show skeleton loading state |
| `selectedIds` | `Set<string>` | - | Set of selected media IDs |
| `onSelect` | `(media: Media) => void` | - | Called when a media item is selected |
| `onEdit` | `(media: Media) => void` | - | Called when edit action is triggered |
| `onDelete` | `(media: Media) => void` | - | Called when delete action is triggered |
| `mode` | `'single' \| 'multiple'` | `'single'` | Selection mode (shows checkboxes in multiple) |
| `className` | `string` | - | Additional CSS classes |

### Table Columns

| Column | Visibility | Description |
|--------|-----------|-------------|
| Checkbox | Multiple mode only | Selection checkbox |
| Thumbnail | Always | 40x40px image preview or icon |
| Filename | Always | Title or original filename |
| Type | `md:` breakpoint | MIME type |
| Size | `md:` breakpoint | Human-readable file size |
| Dimensions | `lg:` breakpoint | Width x Height (images only) |
| Uploaded | `lg:` breakpoint | Formatted upload date |
| Actions | Always | Dropdown menu (edit, delete) |

---

## MediaCard

Individual media thumbnail card for the grid view. Shows image preview (or type icon for videos/files), filename, dimensions, selection ring, optional checkbox (multiple mode), and a hover-visible actions menu.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `media` | `Media` | - | Media item data |
| `isSelected` | `boolean` | - | Whether the card is selected |
| `onSelect` | `(media: Media) => void` | - | Called when card is clicked |
| `onEdit` | `(media: Media) => void` | - | Called from actions menu |
| `onDelete` | `(media: Media) => void` | - | Called from actions menu |
| `mode` | `'single' \| 'multiple'` | `'single'` | Selection mode |

### Visual Behavior

- **Selected state**: Blue ring around the card, light overlay on thumbnail
- **Hover state**: Actions menu button appears in top-right corner, shadow elevates
- **Multiple mode**: Checkbox appears in top-left corner on hover (always visible when selected)
- **Image preview**: Full `aspect-square` cover image with lazy loading
- **Video/File**: Centered type icon instead of image

---

## MediaToolbar

Toolbar with upload button, search input, type filter dropdown, sort dropdown, and grid/list view toggle buttons.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUploadClick` | `() => void` | - | Called when upload button is clicked |
| `searchQuery` | `string` | - | Current search text |
| `onSearchChange` | `(query: string) => void` | - | Called when search text changes |
| `typeFilter` | `'all' \| 'image' \| 'video'` | - | Current type filter |
| `onTypeFilterChange` | `(type: 'all' \| 'image' \| 'video') => void` | - | Called when type filter changes |
| `sortBy` | `MediaListOptions['orderBy']` | `'createdAt'` | Current sort field |
| `sortDir` | `MediaListOptions['orderDir']` | `'desc'` | Current sort direction |
| `onSortChange` | `(orderBy, orderDir) => void` | - | Called when sort changes |
| `viewMode` | `'grid' \| 'list'` | - | Current view mode |
| `onViewModeChange` | `(mode: 'grid' \| 'list') => void` | - | Called when view mode changes |
| `className` | `string` | - | Additional CSS classes |

### Sort Options

| Value | Label | Field | Direction |
|-------|-------|-------|-----------|
| `createdAt:desc` | Newest First | `createdAt` | `desc` |
| `createdAt:asc` | Oldest First | `createdAt` | `asc` |
| `filename:asc` | Name A-Z | `filename` | `asc` |
| `filename:desc` | Name Z-A | `filename` | `desc` |
| `fileSize:desc` | Largest First | `fileSize` | `desc` |
| `fileSize:asc` | Smallest First | `fileSize` | `asc` |

---

## MediaDetailPanel

Right-side panel for viewing file information and editing metadata (title, alt text, caption) and managing tags. Shows a compact info bar with filename, MIME type, file size, dimensions, upload date, and URL (with copy button).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `media` | `Media \| null` | - | Media item to display/edit (null hides panel) |
| `onClose` | `() => void` | - | Called when panel is dismissed |
| `showPreview` | `boolean` | `true` | Show image preview at top |
| `className` | `string` | - | Additional CSS classes |

### Editable Fields

| Field | Input Type | Max Length | Description |
|-------|-----------|-----------|-------------|
| Title | `Input` | 255 | Optional display name |
| Alt Text | `Input` | 500 | Accessibility text for screen readers |
| Caption | `Textarea` (2 rows) | 1000 | Optional description below the media |

### Tag Management

The detail panel includes inline tag management:
- View assigned tags as badges with color indicators
- Remove tags by clicking the X button on each badge
- Add existing tags from a popover dropdown
- Create new tags inline with a text input
- Tags are persisted immediately via mutations (no save button needed for tags)

### Actions

- **Save Changes**: Saves title, alt, and caption changes (enabled only when changes exist)
- **Cancel**: Reverts to the original values and closes the panel

---

## MediaUploadZone

Drag-and-drop file upload area with progress indicators and duplicate detection. Supports multiple file uploads and validates file size against configured limits.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUploadComplete` | `(uploadedMedia: Media[]) => void` | - | Called after successful upload |
| `maxSizeMB` | `number` | `10` | Maximum file size in MB |
| `acceptedTypes` | `string[]` | `['image/*', 'video/*']` | Accepted MIME type patterns |
| `className` | `string` | - | Additional CSS classes |

### Upload Flow

1. User drags files onto the zone or clicks "browse to upload"
2. Client validates file sizes against `maxSizeMB`
3. Duplicate check request sent to `/api/v1/media/check-duplicates`
4. If duplicates found, warning alert shown with options:
   - **Skip duplicates**: Upload only non-duplicate files
   - **Upload All**: Upload all files regardless
   - Dismiss: Cancel the upload
5. Files uploaded via `useMediaUpload` hook
6. Progress spinner shown during upload
7. `onUploadComplete` callback fired with new media records

### Visual States

- **Idle**: Dashed border, cloud upload icon, "Drag and drop files here or browse to upload" text
- **Dragging**: Blue border, primary background tint
- **Uploading**: Spinning loader icon, progress bar, "Uploading..." text
- **Checking duplicates**: Spinning loader, "Checking for duplicates..." text
- **Duplicate warning**: Amber alert with filenames and action buttons

---

## MediaTagFilter

Tag-based filter chips displayed below the toolbar. Shows a "Tags" button with a popover for selecting filter tags, and renders active tag chips that can be clicked to remove.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectedTagIds` | `string[]` | - | Currently active tag filter IDs |
| `onTagsChange` | `(tagIds: string[]) => void` | - | Called when tag selection changes |
| `className` | `string` | - | Additional CSS classes |

### Usage

```tsx
const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

<MediaTagFilter
  selectedTagIds={selectedTagIds}
  onTagsChange={setSelectedTagIds}
/>
```

### Behavior

- Fetches all available tags via `useMediaTags` hook
- Hidden while tags are loading
- "Tags" button shows badge count when tags are active
- Popover lists all available tags as clickable badges (toggle selection)
- Active tags shown as secondary badges with X icon next to the trigger button
- "Clear" button in popover removes all active filters

---

## Hooks Reference

The media components use TanStack Query hooks defined in `core/hooks/useMedia.ts` and `core/hooks/useMediaUpload.ts`:

| Hook | Type | Description |
|------|------|-------------|
| `useMediaList(options)` | Query | Fetch paginated media list with filters |
| `useMediaItem(id)` | Query | Fetch single media item by ID |
| `useDeleteMedia()` | Mutation | Soft delete a media item |
| `useUpdateMedia()` | Mutation | Update media metadata |
| `useMediaUpload()` | Mutation | Upload files via FormData |
| `useMediaTags()` | Query | Fetch all available media tags |
| `useMediaItemTags(mediaId)` | Query | Fetch tags for a specific media item |
| `useAddMediaTag()` | Mutation | Add a tag to a media item |
| `useRemoveMediaTag()` | Mutation | Remove a tag from a media item |
| `useCreateMediaTag()` | Mutation | Create a new media tag |

### Example: Using Hooks Directly

```tsx
import { useMediaList, useDeleteMedia } from '@nextsparkjs/core/hooks/useMedia'

function CustomMediaView() {
  const { data, isLoading, refetch } = useMediaList({
    limit: 20,
    type: 'image',
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  const deleteMutation = useDeleteMedia()

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id)
    refetch()
  }

  if (isLoading) return <p>Loading...</p>

  return (
    <ul>
      {data?.data.map((media) => (
        <li key={media.id}>
          {media.filename}
          <button onClick={() => handleDelete(media.id)}>Delete</button>
        </li>
      ))}
    </ul>
  )
}
```

---

**Documentation:** `core/docs/21-media-library/03-components.md`
