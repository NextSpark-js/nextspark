# Media Library Overview

**WordPress-style media management for NextSpark SaaS applications**

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Dashboard Page](#dashboard-page)
- [Navigation](#navigation)
- [Component Hierarchy](#component-hierarchy)
- [Data Flow](#data-flow)
- [Quick Start](#quick-start)
- [Next Steps](#next-steps)

---

## Overview

The **Media Library** is a centralized media management system built into NextSpark core. It provides a WordPress-style interface for uploading, browsing, organizing, and selecting images and videos throughout your SaaS application.

**Key Capabilities:**
- Upload images and videos with drag-and-drop support
- Browse media in grid or list view with thumbnails
- Search by filename, title, alt text, or caption
- Filter by media type (images, videos, or all)
- Organize media with tags (taxonomy-based)
- Detect duplicate files before uploading
- Edit metadata (title, alt text, caption) inline
- Select media from a reusable modal for any form field
- Full API with 11 RESTful endpoints
- Team-scoped via Row-Level Security (RLS)
- Dual authentication (session + API key)

**Base URL:** `/dashboard/media`

---

## Key Features

### CRUD Operations

Full create, read, update, and delete operations for media records. Media records track the uploaded file URL, original filename, file size, MIME type, dimensions (for images), and editable metadata (title, alt text, caption).

### File Upload

Upload files via drag-and-drop or file browser. Supports multiple simultaneous uploads with progress indicators. Files are stored in Vercel Blob (production) or local `/public/uploads/temp/` directory (development). Image dimensions are extracted automatically using `sharp`.

### Tagging System

Organize media with tags using the taxonomy system (`media_tag` type). Tags can be created, assigned, and removed from media items. The tag filter in the toolbar allows quick filtering by one or more tags.

### Search and Filter

Full-text search powered by PostgreSQL `tsvector` with LIKE fallback for filenames containing hyphens. Filter by type (image/video), sort by date, filename, or file size in ascending or descending order.

### Duplicate Detection

Before uploading, the system checks for existing files with the same filename and file size. Users can choose to skip duplicates or upload anyway.

### Block Editor Integration

The `media-library` field type in block definitions opens the Media Library modal for selecting images in the page builder. Seven default theme blocks use this field type for background images, thumbnails, avatars, and logos.

---

## Architecture

### Architecture Diagram

```text
+-------------------------------------------------------------------+
|                     Frontend (React/Next.js)                       |
|                                                                    |
|  +---------------------+    +----------------------------------+  |
|  |  Dashboard Page      |    |  Block Editor                    |  |
|  |  /dashboard/media    |    |  MediaLibraryField               |  |
|  |                      |    |  ArrayMediaLibraryField           |  |
|  +----------+-----------+    +---------+-----------------------+  |
|             |                          |                          |
|  +----------+---+----------------------+------------------------+ |
|  |              MediaLibrary (Modal)                             | |
|  |                                                               | |
|  |  +-------------------+  +------------------+  +------------+  | |
|  |  | MediaToolbar      |  | MediaTagFilter   |  | Upload     |  | |
|  |  | (search, filter,  |  | (tag chips)      |  | Zone       |  | |
|  |  |  sort, view)      |  |                  |  | (drag&drop)|  | |
|  |  +-------------------+  +------------------+  +------------+  | |
|  |                                                               | |
|  |  +-------------------+  +------------------+                  | |
|  |  | MediaGrid         |  | MediaList        |                  | |
|  |  | (thumbnail cards) |  | (table rows)     |                  | |
|  |  |  -> MediaCard     |  |                  |                  | |
|  |  +-------------------+  +------------------+                  | |
|  |                                                               | |
|  |  +-------------------+                                        | |
|  |  | MediaDetailPanel  |                                        | |
|  |  | (edit metadata,   |                                        | |
|  |  |  manage tags)     |                                        | |
|  |  +-------------------+                                        | |
|  +---------------------------------------------------------------+ |
|             |                                                      |
|  +----------+-----------+                                          |
|  | MediaSelector        |  (Form field component)                  |
|  | (preview + select)   |                                          |
|  +-----------+----------+                                          |
+-------------------------------------------------------------------+
               |
               | TanStack Query Hooks
               |   useMediaList, useMediaItem, useDeleteMedia,
               |   useUpdateMedia, useMediaUpload,
               |   useMediaTags, useMediaItemTags,
               |   useAddMediaTag, useRemoveMediaTag, useCreateMediaTag
               |
+-------------------------------------------------------------------+
|                     API Layer (Next.js Routes)                     |
|                                                                    |
|  /api/v1/media              GET (list), POST (create)             |
|  /api/v1/media/upload       POST (file upload)                    |
|  /api/v1/media/check-duplicates  POST (duplicate detection)       |
|  /api/v1/media/[id]         GET, PATCH, DELETE                    |
|  /api/v1/media/[id]/tags    GET, POST, PUT, DELETE                |
|  /api/v1/media-tags         GET (list all), POST (create)         |
+-------------------------------------------------------------------+
               |
+-------------------------------------------------------------------+
|                     Service Layer                                  |
|                                                                    |
|  MediaService (static class)                                      |
|  - getById, list, findDuplicates, count                           |
|  - create, update, softDelete                                     |
|  - getTags, getMediaTags, addTag, removeTag, setTags, createTag   |
+-------------------------------------------------------------------+
               |
+-------------------------------------------------------------------+
|                     Database (PostgreSQL + RLS)                     |
|                                                                    |
|  Tables: media, taxonomies (media_tag), entity_taxonomy_relations  |
|  Full-text search via searchVector column                          |
|  Row-Level Security scoped to team                                 |
+-------------------------------------------------------------------+
```

### Key Components

**1. MediaLibrary** (`core/components/media/MediaLibrary.tsx`)
- Main modal dialog managing all state (search, filter, sort, selection, view mode)
- Orchestrates child components and handles selection confirmation

**2. Hooks Layer** (`core/hooks/useMedia.ts`, `core/hooks/useMediaUpload.ts`)
- TanStack Query mutations and queries for all media operations
- Automatic cache invalidation on mutations

**3. MediaService** (`core/lib/services/media.service.ts`)
- Static class with RLS-scoped database operations
- All queries pass through `queryWithRLS` / `mutateWithRLS`

**4. API Routes** (`app/api/v1/media/`)
- RESTful endpoints with dual authentication
- Rate limiting via `withRateLimitTier`
- Zod schema validation for inputs

**5. Storage Providers**
- Vercel Blob for production (publicly accessible URLs)
- Local filesystem fallback for development

---

## Dashboard Page

The Media Library has a dedicated dashboard page at `/dashboard/media`. This page provides a full-page interface for managing all media files, including:

- Grid and list view toggle
- Upload zone with drag-and-drop
- Search, type filter, and sort controls
- Tag-based filtering
- Bulk selection and deletion
- Pagination for large libraries
- Inline metadata editing via the detail panel

---

## Navigation

The Media Library is accessible from the dashboard sidebar under the label "Multimedia". The navigation item links to `/dashboard/media` and is available to users with the `media:read` permission scope.

---

## Component Hierarchy

```text
MediaLibrary (modal)
  |-- MediaToolbar (search, type filter, sort, view toggle, upload button)
  |-- MediaTagFilter (tag chips for filtering)
  |-- MediaUploadZone (drag-and-drop upload area, conditionally shown)
  |-- MediaGrid (grid of MediaCard components)
  |   |-- MediaCard (individual thumbnail card with selection, actions menu)
  |-- MediaList (table view with rows for each media item)
  |-- MediaDetailPanel (right panel for editing title, alt, caption, tags)

MediaSelector (standalone form field)
  |-- MediaLibrary (opens modal on click)
```

---

## Data Flow

### Upload Flow

1. User drags files or clicks "browse" in `MediaUploadZone`
2. Client validates file size against `maxSizeMB` config
3. Duplicate check: POST `/api/v1/media/check-duplicates` with filenames and sizes
4. If duplicates found, user chooses to skip or upload anyway
5. Files sent as `FormData` to POST `/api/v1/media/upload`
6. Server validates MIME type and file size against `MEDIA_CONFIG`
7. File stored in Vercel Blob or local filesystem
8. Image dimensions extracted via `sharp` (for images)
9. Media record created in database via `MediaService.create()`
10. Client receives media records and refreshes the list

### Selection Flow (Block Editor)

1. Block field definition has `type: 'media-library'`
2. `MediaLibraryField` renders empty state or preview
3. User clicks to open `MediaLibrary` modal
4. User browses, searches, or uploads media
5. User selects an item and clicks "Select"
6. `onSelect` callback receives the `Media` object
7. The **URL string** (not media ID) is stored in the block data
8. Block component renders the image using the URL

---

## Quick Start

### Open the Media Library

Navigate to `/dashboard/media` in your application or use the `MediaLibrary` component programmatically:

```tsx
import { MediaLibrary } from '@nextsparkjs/core/components/media'
import type { Media } from '@nextsparkjs/core/lib/media/types'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (media: Media | Media[]) => {
    if (!Array.isArray(media)) {
      console.log('Selected:', media.url)
    }
    setIsOpen(false)
  }

  return (
    <MediaLibrary
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSelect={handleSelect}
      mode="single"
      allowedTypes={['image']}
    />
  )
}
```

### Upload via API

```bash
curl -X POST https://yourdomain.com/api/v1/media/upload \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "x-team-id: team_456" \
  -F "files=@photo.jpg"
```

### List Media via API

```bash
curl https://yourdomain.com/api/v1/media?type=image&limit=20&orderBy=createdAt&orderDir=desc \
  -H "Authorization: Bearer sk_live_abc123"
```

---

## Next Steps

- **[API Reference](./02-api-reference.md)** - Complete endpoint documentation with examples
- **[Components](./03-components.md)** - Detailed component props and usage
- **[Block Editor Integration](./04-block-editor-integration.md)** - Using media in page builder blocks
- **[Configuration](./05-configuration.md)** - Upload limits, MIME types, database schema, i18n

**Documentation:** `core/docs/21-media-library/01-introduction.md`
