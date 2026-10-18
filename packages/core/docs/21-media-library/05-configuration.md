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
// app.config.ts
import type { AppConfig } from '@nextsparkjs/core/lib/config/types'

const config: Partial<AppConfig> = {
  media: {
    maxSizeMB: 25,                    // Allow larger files
    maxSizeImageMB: 15,               // Up to 15MB for images
    maxSizeVideoMB: 100,              // Up to 100MB for videos
    acceptedTypes: ['image/*', 'video/*', 'application/pdf'],
    allowedMimeTypes: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
      'application/pdf',              // Add PDF support
    ],
  },
}

export default config
```

Types outside the raster and video table (`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/*` above), such as PDF, are stored and served as downloads (`Content-Disposition: attachment`). SVG is deliberately not in this example: an SVG can carry script, its bytes have no signature the upload can check, and a bucket serves it with the type it was stored with from an origin the app does not control (often a sibling domain of the app). Allowing it is only safe from an origin that shares no cookies with the app and sends `Content-Security-Policy: sandbox`.

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

Uploads go to a **storage driver**, chosen with `STORAGE_DRIVER`:

| `STORAGE_DRIVER` | Stores files in | Direct uploads | Needs |
|------------------|-----------------|----------------|-------|
| `vercel-blob` | Vercel Blob | No | `BLOB_READ_WRITE_TOKEN` |
| `s3` | Any S3-compatible service: AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces | Yes | the `S3_*` variables and `pnpm add aws4fetch` |
| `local` | A directory on the server's disk | No | `UPLOADS_DIR` |
| unset | Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set; otherwise `public/uploads/temp/` in development, and nothing in production | No | |

A driver is checked when it is selected (on each upload, and once at server start, which logs the problem). A missing or malformed variable makes uploads answer `503 STORAGE_NOT_CONFIGURED`; the message and the log name the variables, never their values.

### Storage Behavior

```text
STORAGE_DRIVER set?
  |
  YES --> that driver; a misconfigured one answers 503 STORAGE_NOT_CONFIGURED
  |
  NO  --> BLOB_READ_WRITE_TOKEN set?
            YES --> Vercel Blob (publicly accessible URLs)
            |         On failure --> development: fallback to local storage
            |                        production: 500, nothing is written
            NO  --> NODE_ENV=production? --> 503 STORAGE_NOT_CONFIGURED (no file is written)
                    otherwise            --> public/uploads/temp/ (development fallback)
```

In development, the fallback writes files to `{cwd}/public/uploads/temp/{timestamp}_{random}.{ext}` and serves them via the Next.js public directory at `/uploads/temp/...` (Next indexes `public/` at startup: restart the dev server if a new file answers 404).

A production server never writes uploads to `public/`: Next serves `public/` from what it indexed at startup, so a file written while the server runs answers 404 until a restart, and a container's disk does not survive a redeploy. Self-hosted deployments (standalone, `next start`, Docker) use `s3` or `local`.

Every driver stores files under a name the server generates (`{timestamp}_{random}.{ext}`, the extension from the allow-listed type), never the client's file name, with the validated `Content-Type`. With `s3` the server also sets `Cache-Control: public, max-age=31536000, immutable` and, for a type outside the raster/video table, `Content-Disposition: attachment`; whatever metadata a client sent with a direct upload is replaced when the upload is confirmed. Deleting a media item (`DELETE /api/v1/media/:id`) also deletes its file through the driver; a page that embedded the file's URL loses the image.

### Vercel Blob (`vercel-blob`)

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob read/write token (starts with `vercel_blob_`). Files go to `uploads/temp/` with public access. |

### S3-compatible (`s3`)

```bash
pnpm add aws4fetch
```

The driver signs requests with [aws4fetch](https://github.com/mhart/aws4fetch) (SigV4 over `fetch`, no other dependencies). It is an optional peer dependency of `@nextsparkjs/core`, loaded only when `STORAGE_DRIVER=s3`; without it uploads fail with "STORAGE_DRIVER=s3 needs the aws4fetch package, which is not installed or not included in the deployment".

| Variable | Required | Description |
|----------|----------|-------------|
| `S3_ENDPOINT` | Yes | The service's S3 API origin, `http(s)://host[:port]`, no path |
| `S3_REGION` | Yes | Region used in the signature (`auto` for R2) |
| `S3_BUCKET` | Yes | Bucket name |
| `S3_ACCESS_KEY_ID` | Yes | Access key with read, write and delete on the bucket |
| `S3_SECRET_ACCESS_KEY` | Yes | Its secret |
| `S3_PUBLIC_URL` | Yes | Base URL files are served from: the bucket's public URL or a CDN in front of it. Media URLs are `{S3_PUBLIC_URL}/uploads/{name}` |
| `S3_FORCE_PATH_STYLE` | No | `true` for `{endpoint}/{bucket}/{key}` URLs (MinIO, most self-hosted servers); default `false`, `{bucket}.{endpoint host}/{key}` |

The driver never sets an ACL or a public-read flag, and a client never chooses one: what is public is decided by the bucket. Make `uploads/` readable by everyone (a bucket policy, or a public bucket or custom domain) and keep `pending/` private when the service allows it. A bucket name with dots does not work with virtual-hosted URLs over HTTPS; use `S3_FORCE_PATH_STYLE=true`.

Examples (credentials come from the service's console):

| Service | `S3_ENDPOINT` | `S3_REGION` | `S3_FORCE_PATH_STYLE` | `S3_PUBLIC_URL` |
|---------|---------------|-------------|-----------------------|-----------------|
| AWS S3 | `https://s3.us-east-1.amazonaws.com` | `us-east-1` | `false` | `https://my-bucket.s3.us-east-1.amazonaws.com` or a CloudFront URL |
| Cloudflare R2 | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | `auto` | `true` | The bucket's custom domain or `https://pub-<id>.r2.dev` |
| MinIO | `http://localhost:9000` (or your host) | `us-east-1` (or the server's region) | `true` | `http://localhost:9000/my-bucket` |
| Backblaze B2 | `https://s3.<region>.backblazeb2.com`, e.g. `https://s3.us-west-004.backblazeb2.com` | `<region>`, e.g. `us-west-004` | `false` | `https://<bucket>.s3.<region>.backblazeb2.com` (public bucket) or a CDN |
| DigitalOcean Spaces | `https://<region>.digitaloceanspaces.com`, e.g. `https://nyc3.digitaloceanspaces.com` | `<region>`, e.g. `nyc3` | `false` | `https://<bucket>.<region>.cdn.digitaloceanspaces.com` |

#### Direct uploads, CORS and unconfirmed objects

With `s3`, a client can upload straight to the bucket instead of through the app server (`POST /api/v1/media/upload/presign`, then `PUT`, then `POST /api/v1/media/upload/confirm`; see [the API reference](./02-api-reference.md#direct-upload-s3)). The media library in the dashboard keeps uploading through the app server, which works with every driver.

A browser `PUT` to the bucket needs a CORS rule for the app's origin:

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

(AWS S3 and R2 take this JSON in the bucket's CORS settings; B2 and Spaces have an equivalent form; MinIO sets allowed origins server-wide.)

A presigned object lands under `pending/` and is copied to `uploads/` only when the confirm accepts it; a rejected one is deleted. An upload that is never confirmed (the user closed the tab) stays under `pending/`. Add a **lifecycle rule that expires objects under the `pending/` prefix after 1 day**: AWS S3, R2, Backblaze B2 and Spaces support prefix rules in the bucket settings, and MinIO with `mc ilm rule add --prefix pending/ --expire-days 1 <alias>/<bucket>`. A prefix rule was chosen over object tags because every one of these services supports it. A confirm is accepted up to one hour after the presign, well inside that day. The confirm copies only the bytes it checked (`x-amz-copy-source-if-match` with the ETag it read): an object replaced in between is refused and deleted.

The confirm token is signed with a key derived from `BETTER_AUTH_SECRET`. Rotating the secret makes the tokens of uploads in progress invalid (confirm answers `400 INVALID_UPLOAD_TOKEN`); their pending objects are removed by the lifecycle rule. A rotation also ends every session, so do it outside busy hours.

#### Standalone deployments

`output: 'standalone'` copies only the files Next.js can trace, and aws4fetch is imported at runtime past the bundler. Projects created from the template include it through `outputFileTracingIncludes` in `next.config.mjs`; an existing project or a custom config adds the entry:

```js
outputFileTracingIncludes: {
  '/**/*': ['./node_modules/aws4fetch/**/*'],
},
```

The glob matches nothing when aws4fetch is not installed.

### Local disk (`local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `UPLOADS_DIR` | Yes | Directory for uploaded files, absolute or relative to the project (the server's working directory) |

Files are served by `GET /api/v1/media/files/{name}`, with the `Content-Type` of their stored extension (a type outside the raster/video table, or an unknown one, as a download), `X-Content-Type-Options: nosniff`, a one-year immutable cache and byte ranges for video. Only names of the shape the server generates (`{milliseconds}_{32 hex digits}.{ext}`) are served or deleted, and a symbolic link is not followed: any other name answers 404, so neither a path outside `UPLOADS_DIR` nor another file that happens to sit in it (`package.json`...) is reachable. New files are served at once; no restart is needed.

Each request reads the file through the Node.js server and the route has no rate limit (an `<img>` per request would count against any). On a public site, put a CDN or the reverse proxy's cache (nginx `proxy_cache`, Caddy, Cloudflare) in front of `/api/v1/media/files/`: the responses are immutable for a year, so the cache absorbs the traffic.

The server logs a warning once, at startup (or at the first upload when `instrumentation.ts` does not run):

- **Volumes:** a container's or a build's disk is replaced on redeploy. Point `UPLOADS_DIR` at a persistent volume. With `output: 'standalone'` the server runs from `.next/standalone`, so a relative `UPLOADS_DIR` lands inside the build output: use an absolute path outside `.next`, for example `UPLOADS_DIR=/data/uploads` with a Docker volume mounted at `/data/uploads`.
- **Instances:** files are not shared between servers. Run a single instance, or use `s3`.

---

---

**Documentation:** `core/docs/21-media-library/05-configuration.md`
