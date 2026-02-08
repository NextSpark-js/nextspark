# Media Configuration

**Upload limits, MIME types, database schema, i18n keys, and test selectors**

---

## Table of Contents

- [Overview](#overview)
- [Upload Configuration](#upload-configuration)
- [Theme Override](#theme-override)
- [Database Schema](#database-schema)
- [Internationalization (i18n)](#internationalization-i18n)
- [Data-cy Selectors](#data-cy-selectors)
- [Environment Variables](#environment-variables)

---

## Overview

The Media Library is configured through the `media` section of `app.config.ts`. Themes can override these defaults to customize upload limits and accepted file types. The database schema uses three tables for media storage, taxonomy, and tag relations.

---

## Upload Configuration

### Configuration in app.config.ts

The media configuration lives in the `media` section of the application config:

**Source:** `core/lib/config/app.config.ts`

```typescript
// Default configuration
{
  media: {
    /**
     * Maximum upload file size in MB (general fallback for all file types)
     */
    maxSizeMB: 10,

    /**
     * Maximum image file size in MB
     * Overrides maxSizeMB for image/* files. Falls back to maxSizeMB if not set.
     */
    // maxSizeImageMB: 10,

    /**
     * Maximum video file size in MB
     * Overrides maxSizeMB for video/* files. Falls back to maxSizeMB if not set.
     */
    // maxSizeVideoMB: 50,

    /**
     * Accepted MIME type patterns for the client-side file input
     */
    acceptedTypes: ['image/*', 'video/*'],

    /**
     * Specific MIME types allowed by the server-side upload endpoint
     */
    allowedMimeTypes: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
    ],
  }
}
```

### Configuration Type

**Source:** `core/lib/config/types.ts`

```typescript
export interface MediaConfig {
  /** Maximum upload file size in MB (general fallback) */
  maxSizeMB: number

  /** Maximum image file size in MB (overrides maxSizeMB for images) */
  maxSizeImageMB?: number

  /** Maximum video file size in MB (overrides maxSizeMB for videos) */
  maxSizeVideoMB?: number

  /** Accepted MIME type patterns for the file input (e.g., ['image/*', 'video/*']) */
  acceptedTypes: string[]

  /** Specific MIME types allowed by the server-side upload endpoint */
  allowedMimeTypes: string[]
}
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxSizeMB` | `number` | `10` | General maximum file size in MB. Used as fallback when type-specific limits are not set. |
| `maxSizeImageMB` | `number` | (falls back to `maxSizeMB`) | Maximum file size for `image/*` files. Overrides `maxSizeMB` for images when set. |
| `maxSizeVideoMB` | `number` | (falls back to `maxSizeMB`) | Maximum file size for `video/*` files. Overrides `maxSizeMB` for videos when set. |
| `acceptedTypes` | `string[]` | `['image/*', 'video/*']` | MIME type patterns used in the client-side file input `accept` attribute. These are broad patterns that control what the file browser shows to users. |
| `allowedMimeTypes` | `string[]` | (see above) | Specific MIME types validated server-side during upload. These are exact matches checked against `file.type`. |

### Size Validation Priority

The upload endpoint determines the maximum allowed size using this priority:

1. If the file is an image (`image/*`) and `maxSizeImageMB` is set, use `maxSizeImageMB`
2. If the file is a video (`video/*`) and `maxSizeVideoMB` is set, use `maxSizeVideoMB`
3. Otherwise, use `maxSizeMB` as the fallback

```typescript
// Server-side validation logic (simplified)
let maxSizeMB = MEDIA_CONFIG.maxSizeMB  // fallback: 10

if (file.type.startsWith('image/') && MEDIA_CONFIG.maxSizeImageMB != null) {
  maxSizeMB = MEDIA_CONFIG.maxSizeImageMB
} else if (file.type.startsWith('video/') && MEDIA_CONFIG.maxSizeVideoMB != null) {
  maxSizeMB = MEDIA_CONFIG.maxSizeVideoMB
}
```

### Accessing Configuration at Runtime

The media configuration is exported from the config sync module:

```typescript
import { MEDIA_CONFIG } from '@nextsparkjs/core/lib/config/config-sync'

// MEDIA_CONFIG.maxSizeMB
// MEDIA_CONFIG.allowedMimeTypes
// MEDIA_CONFIG.acceptedTypes
```

---

## Theme Override

Themes can override the default media configuration in their `app.config.ts`:

```typescript
// themes/my-theme/app.config.ts
import type { AppConfig } from '@nextsparkjs/core/lib/config/types'

const config: Partial<AppConfig> = {
  media: {
    maxSizeMB: 25,                    // Allow larger files
    maxSizeImageMB: 15,               // Up to 15MB for images
    maxSizeVideoMB: 100,              // Up to 100MB for videos
    acceptedTypes: ['image/*', 'video/*', 'application/pdf'],
    allowedMimeTypes: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/svg+xml',                // Add SVG support
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
      'application/pdf',              // Add PDF support
    ],
  },
}

export default config
```

The theme configuration is deep-merged with the core defaults at build time. Any properties not specified in the theme fall back to the core defaults.

---

## Database Schema

The Media Library uses three database tables.

### media Table

Stores individual media records.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | `uuid` (PK) | No | Auto-generated UUID |
| `userId` | `uuid` (FK) | No | Uploader user ID |
| `teamId` | `uuid` (FK) | No | Team for RLS isolation |
| `url` | `text` | No | Public URL of the uploaded file |
| `filename` | `varchar(255)` | No | Original filename |
| `fileSize` | `integer` | No | File size in bytes |
| `mimeType` | `varchar(100)` | No | MIME type (e.g., `image/jpeg`) |
| `width` | `integer` | Yes | Image width in pixels |
| `height` | `integer` | Yes | Image height in pixels |
| `title` | `varchar(255)` | Yes | Optional display title |
| `alt` | `varchar(500)` | Yes | Alt text for accessibility |
| `caption` | `varchar(1000)` | Yes | Caption or description |
| `status` | `varchar(20)` | No | `active` or `deleted` (soft delete) |
| `searchVector` | `tsvector` | Yes | Full-text search index |
| `createdAt` | `timestamptz` | No | Record creation timestamp |
| `updatedAt` | `timestamptz` | No | Last update timestamp |

**Row-Level Security:** All queries pass through `queryWithRLS` / `mutateWithRLS`, scoping results to teams the authenticated user belongs to.

**Full-Text Search:** The `searchVector` column is populated from title, filename, alt, and caption. Queries use `plainto_tsquery('english', ...)` with a LIKE fallback for filenames containing hyphens.

### taxonomies Table (media_tag type)

Tags are stored as taxonomy records with `type = 'media_tag'`.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | `uuid` (PK) | No | Auto-generated UUID |
| `type` | `varchar` | No | Always `media_tag` for media tags |
| `slug` | `varchar` | No | URL-safe slug (auto-generated from name) |
| `name` | `varchar` | No | Display name |
| `description` | `text` | Yes | Optional description |
| `icon` | `varchar` | Yes | Optional icon identifier |
| `color` | `varchar` | Yes | Hex color for visual identification |
| `order` | `integer` | No | Sort order |
| `isActive` | `boolean` | No | Active/inactive flag |
| `deletedAt` | `timestamptz` | Yes | Soft delete timestamp |
| `createdAt` | `timestamptz` | No | Record creation timestamp |
| `updatedAt` | `timestamptz` | No | Last update timestamp |

**Unique constraint:** `(type, slug)` - prevents duplicate slugs within the same taxonomy type.

### entity_taxonomy_relations Table

Junction table linking media items to tags.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `entityType` | `varchar` | No | Always `media` for media tag relations |
| `entityId` | `uuid` | No | Media item ID |
| `taxonomyId` | `uuid` | No | Tag taxonomy ID |

**Unique constraint:** `(entityType, entityId, taxonomyId)` - prevents duplicate tag assignments.

### Entity Relationship

```text
media (1) ----< entity_taxonomy_relations >---- (1) taxonomies
  id       =    entityId            taxonomyId    =    id
                 entityType = 'media'              type = 'media_tag'
```

---

## Internationalization (i18n)

The Media Library uses the `media` namespace for all translatable strings. Translation files are located in `core/src/messages/{locale}/media.json`.

### Supported Locales

- `en` (English) - `core/src/messages/en/media.json`
- `es` (Spanish) - `core/src/messages/es/media.json`

### Key Namespaces

All keys are accessed via `useTranslations('media')`:

| Namespace | Key Count | Description |
|-----------|-----------|-------------|
| `title`, `subtitle` | 2 | Modal title and description |
| `toolbar.*` | 10 | Upload button, search, type filter, sort options, view toggle |
| `upload.*` | 13 | Drag-and-drop text, progress, errors, duplicate messages |
| `grid.*` | 3 | Selected state, dimensions, no results |
| `list.*` | 6 | Table column headers |
| `detail.*` | 14 | Metadata editing labels, placeholders, save/cancel, file info labels |
| `footer.*` | 4 | Selection count, cancel/select buttons |
| `selector.*` | 4 | Form field component strings |
| `empty.*` | 3 | Empty state title, description, upload button |
| `delete.*` | 5 | Delete confirmation dialog |
| `errors.*` | 4 | Error messages (load failed, unauthorized, not found, upload failed) |
| `actions.*` | 5 | Common actions (edit, delete, select, cancel, save) |
| `dashboard.*` | 12 | Dashboard page strings (subtitle, selected, bulk delete, pagination, tags) |
| `tags.*` | 7 | Tag management (title, add, remove, create, applied, removed, empty) |

### Example Translation Keys

```json
{
  "title": "Media Library",
  "subtitle": "Manage your images and videos",
  "toolbar": {
    "upload": "Upload",
    "search": "Search files...",
    "typeFilter": {
      "all": "All Types",
      "images": "Images",
      "videos": "Videos"
    },
    "sort": {
      "newest": "Newest First",
      "oldest": "Oldest First",
      "nameAsc": "Name A-Z",
      "nameDesc": "Name Z-A",
      "sizeDesc": "Largest First",
      "sizeAsc": "Smallest First"
    }
  },
  "upload": {
    "dragDrop": "Drag and drop files here or",
    "browse": "browse to upload",
    "maxSize": "Maximum file size: {maxSize}MB",
    "duplicateFound": "{count, plural, one {# file already exists} other {# files already exist}} in your library"
  },
  "tags": {
    "title": "Tags",
    "add": "Add Tag",
    "empty": "No tags assigned"
  }
}
```

### Adding Translations for a New Locale

1. Copy `core/src/messages/en/media.json` to `core/src/messages/{locale}/media.json`
2. Translate all string values
3. Preserve ICU message format syntax for plurals (e.g., `{count, plural, one {# item} other {# items}}`)
4. Preserve interpolation variables (e.g., `{maxSize}`, `{count}`, `{filename}`)

---

## Data-cy Selectors

All interactive elements in the Media Library have `data-cy` attributes for Cypress testing. Selectors are defined in `core/lib/selectors/domains/media.selectors.ts`.

**Source:** `core/lib/selectors/domains/media.selectors.ts`

### Selector Map

```typescript
export const MEDIA_SELECTORS = {
  // Main library dialog/modal
  library: {
    dialog: 'media-library-dialog',
    closeBtn: 'media-library-close',
    title: 'media-library-title',
  },

  // Toolbar controls
  toolbar: {
    container: 'media-toolbar',
    uploadBtn: 'media-upload-btn',
    searchInput: 'media-search-input',
    typeFilter: 'media-type-filter',
    sortSelect: 'media-sort-select',
    viewToggle: {
      grid: 'media-view-grid',
      list: 'media-view-list',
    },
    columnSelect: 'media-column-select',
  },

  // Upload zone
  upload: {
    dropzone: 'media-upload-dropzone',
    fileInput: 'media-upload-input',
    progress: 'media-upload-progress-{id}',
    progressBar: 'media-upload-progress-bar',
  },

  // Grid view
  grid: {
    container: 'media-grid',
    item: 'media-grid-item-{id}',
    thumbnail: 'media-thumbnail-{id}',
    checkbox: 'media-checkbox-{id}',
    menuBtn: 'media-menu-{id}',
    menuEdit: 'media-menu-edit-{id}',
    menuDelete: 'media-menu-delete-{id}',
  },

  // List/table view
  list: {
    container: 'media-list',
    row: 'media-list-row-{id}',
    cell: 'media-list-cell-{id}-{field}',
  },

  // Detail panel (edit metadata)
  detail: {
    dialog: 'media-detail-dialog',
    panel: 'media-detail-panel',
    titleInput: 'media-title-input',
    altInput: 'media-alt-input',
    captionInput: 'media-caption-input',
    saveBtn: 'media-detail-save',
    cancelBtn: 'media-detail-cancel',
    tags: 'media-detail-tags',
    tagBadge: 'media-detail-tag-{id}',
    addTagBtn: 'media-detail-add-tag',
  },

  // Footer controls
  footer: {
    container: 'media-footer',
    selectionCount: 'media-selection-count',
    cancelBtn: 'media-cancel-btn',
    selectBtn: 'media-select-btn',
  },

  // MediaSelector form field component
  selector: {
    container: 'media-selector',
    selectBtn: 'media-selector-select-btn',
    changeBtn: 'media-selector-change-btn',
    removeBtn: 'media-selector-remove-btn',
    preview: 'media-selector-preview',
  },

  // Empty states
  empty: {
    container: 'media-empty-state',
    uploadBtn: 'media-empty-upload-btn',
  },

  // Delete confirmation dialog
  deleteConfirm: {
    dialog: 'media-delete-confirm',
    confirmBtn: 'media-delete-confirm-btn',
    cancelBtn: 'media-delete-cancel-btn',
  },

  // Dashboard page
  dashboard: {
    container: 'media-dashboard',
    title: 'media-dashboard-title',
    bulkDeleteBtn: 'media-bulk-delete-btn',
    pagination: 'media-pagination',
    prevPageBtn: 'media-prev-page-btn',
    nextPageBtn: 'media-next-page-btn',
  },

  // Tag filter
  tagFilter: {
    container: 'media-tag-filter',
    trigger: 'media-tag-filter-trigger',
    popover: 'media-tag-filter-popover',
    tag: 'media-tag-filter-tag-{id}',
    activeTag: 'media-tag-filter-active-{id}',
  },
} as const
```

### Dynamic Selectors

Selectors containing `{id}` are parameterized. Use the `sel()` helper to resolve them:

```typescript
import { sel } from '@nextsparkjs/core/lib/selectors'

// Static selector
sel('media.toolbar.uploadBtn')  // => 'media-upload-btn'

// Dynamic selector with ID
sel('media.grid.item', { id: 'abc-123' })  // => 'media-grid-item-abc-123'
```

### Cypress Usage

```typescript
// Click upload button
cy.get('[data-cy="media-upload-btn"]').click()

// Search for a file
cy.get('[data-cy="media-search-input"]').type('logo')

// Select a specific media item
cy.get('[data-cy="media-grid-item-abc-123"]').click()

// Confirm selection
cy.get('[data-cy="media-select-btn"]').click()

// Edit alt text
cy.get('[data-cy="media-alt-input"]').clear().type('Brand logo')
cy.get('[data-cy="media-detail-save"]').click()
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob token (must start with `vercel_blob_`). When set, uploads go to Vercel Blob. When absent, uploads go to local filesystem. |

### Storage Behavior

```text
BLOB_READ_WRITE_TOKEN set?
  |
  YES --> Use Vercel Blob (publicly accessible URLs)
  |         On failure --> Fallback to local storage
  |
  NO  --> Use local storage (public/uploads/temp/)
```

Local storage writes files to `{cwd}/public/uploads/temp/{timestamp}_{random}.{ext}` and serves them via the Next.js public directory at `/uploads/temp/...`.

---

**Documentation:** `core/docs/21-media-library/05-configuration.md`
