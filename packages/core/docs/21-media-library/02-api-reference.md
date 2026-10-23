# Media API Reference

**11 RESTful endpoints for media management, file upload, tagging, and duplicate detection**

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoint Summary](#endpoint-summary)
- [List Media](#list-media)
- [Create Media Record](#create-media-record)
- [Upload Files](#upload-files)
- [Direct Upload (S3)](#direct-upload-s3)
- [Serve Local Files](#serve-local-files)
- [Check Duplicates](#check-duplicates)
- [Get Single Media](#get-single-media)
- [Update Media Metadata](#update-media-metadata)
- [Delete Media](#delete-media)
- [Get Media Tags](#get-media-tags)
- [Add Tags to Media](#add-tags-to-media)
- [Remove Tags from Media](#remove-tags-from-media)
- [List All Tags](#list-all-tags)
- [Create Tag](#create-tag)
- [Error Responses](#error-responses)

---

## Overview

The Media API provides complete CRUD operations for managing media files, uploading content, organizing with tags, and detecting duplicates. All endpoints require authentication and use scope-based permissions.

**Base URL:** `/api/v1`

**Response Format:** All responses follow the standard API response envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Authentication

All endpoints support dual authentication:

1. **Session-based** (Cookie) - For logged-in dashboard users
2. **API Key** (Header) - For programmatic access

```bash
# API Key authentication
curl -H "Authorization: Bearer sk_live_abc123" /api/v1/media

# Session authentication (browser - cookies sent automatically)
fetch('/api/v1/media', { credentials: 'include' })
```

---

## Endpoint Summary

| Method | Endpoint | Description | Auth Scope |
|--------|----------|-------------|------------|
| **GET** | `/api/v1/media` | List media (paginated, filterable) | `media:read` |
| **POST** | `/api/v1/media` | Create media record | `media:write` |
| **POST** | `/api/v1/media/upload` | Upload files | `media:write` |
| **POST** | `/api/v1/media/upload/presign` | Presign a direct upload (`s3` driver) | `media:write` |
| **POST** | `/api/v1/media/upload/confirm` | Confirm a direct upload, create the record | `media:write` |
| **GET** | `/api/v1/media/files/[name]` | Serve a file of the `local` driver | public |
| **POST** | `/api/v1/media/check-duplicates` | Check for duplicates by filename+size | `media:read` |
| **GET** | `/api/v1/media/[id]` | Get single media | `media:read` |
| **PATCH** | `/api/v1/media/[id]` | Update media metadata | `media:write` |
| **DELETE** | `/api/v1/media/[id]` | Delete media (soft delete) and its file | `media:delete` |
| **GET** | `/api/v1/media/[id]/tags` | Get media tags | `media:read` |
| **POST** | `/api/v1/media/[id]/tags` | Add tag to media | `media:write` |
| **DELETE** | `/api/v1/media/[id]/tags` | Remove tag from media | `media:delete` |
| **GET** | `/api/v1/media-tags` | List all available tags | `media:read` |

---

## List Media

```
GET /api/v1/media
```

List media files with pagination, filtering, sorting, and full-text search. Returns only media from teams the authenticated user belongs to (RLS-enforced).

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `20` | Items per page (1-100) |
| `offset` | integer | `0` | Number of items to skip |
| `orderBy` | string | `createdAt` | Sort field: `createdAt`, `filename`, `fileSize` |
| `orderDir` | string | `desc` | Sort direction: `asc`, `desc` |
| `type` | string | `all` | Filter by type: `image`, `video`, `all` |
| `search` | string | - | Search by filename, title, alt text, or caption |
| `tagIds` | string | - | Comma-separated tag IDs to filter by (at most 100) |
| `tagSlugs` | string | - | Comma-separated tag slugs to filter by (at most 100) |

### Request

```bash
curl "https://yourdomain.com/api/v1/media?type=image&limit=10&orderBy=createdAt&orderDir=desc&search=logo" \
  -H "Authorization: Bearer sk_live_abc123"
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "userId": "user-123",
        "teamId": "team-456",
        "url": "https://blob.vercel-storage.com/uploads/temp/1706000000_abc123.png",
        "filename": "company-logo.png",
        "fileSize": 45230,
        "mimeType": "image/png",
        "width": 400,
        "height": 200,
        "title": "Company Logo",
        "alt": "ACME Corp logo in blue",
        "caption": null,
        "status": "active",
        "createdAt": "2025-01-15T10:30:00.000Z",
        "updatedAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

---

## Create Media Record

```
POST /api/v1/media
```

Create a media record in the database. This is typically used when a file has already been uploaded externally and you need to register it in the media library.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL of the uploaded file |
| `filename` | string | Yes | Original filename (max 255 chars) |
| `fileSize` | integer | Yes | File size in bytes |
| `mimeType` | string | Yes | MIME type (e.g., `image/jpeg`) |
| `width` | integer | No | Image width in pixels |
| `height` | integer | No | Image height in pixels |
| `title` | string | No | Display title (max 255 chars) |
| `alt` | string | No | Alt text for accessibility (max 500 chars) |
| `caption` | string | No | Caption text (max 1000 chars) |

### Request

```bash
curl -X POST "https://yourdomain.com/api/v1/media" \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/images/photo.jpg",
    "filename": "photo.jpg",
    "fileSize": 250000,
    "mimeType": "image/jpeg",
    "width": 1920,
    "height": 1080,
    "alt": "Sunset over mountains"
  }'
```

### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "userId": "user-123",
    "teamId": "team-456",
    "url": "https://example.com/images/photo.jpg",
    "filename": "photo.jpg",
    "fileSize": 250000,
    "mimeType": "image/jpeg",
    "width": 1920,
    "height": 1080,
    "title": null,
    "alt": "Sunset over mountains",
    "caption": null,
    "status": "active",
    "createdAt": "2025-01-15T11:00:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

---

## Upload Files

```
POST /api/v1/media/upload
```

Upload one or more files via multipart form data, through the app server. Files are stored by the driver `STORAGE_DRIVER` selects (Vercel Blob, S3-compatible, local disk; see [Configuration](./05-configuration.md#environment-variables)) or, in development without one, `public/uploads/temp/`. In production without a driver the endpoint answers `503` with code `STORAGE_NOT_CONFIGURED`. Image dimensions are automatically extracted. A media record is created in the database for each uploaded file.

### Request

Files must be sent as `FormData` with the field name `files`. An optional `x-team-id` header specifies the team context (defaults to the user's default team).

```bash
# Single file upload
curl -X POST "https://yourdomain.com/api/v1/media/upload" \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "x-team-id: team-456" \
  -F "files=@photo.jpg"

# Multiple file upload
curl -X POST "https://yourdomain.com/api/v1/media/upload" \
  -H "Authorization: Bearer sk_live_abc123" \
  -F "files=@photo1.jpg" \
  -F "files=@photo2.png"
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "message": "Files uploaded successfully",
    "urls": [
      "https://blob.vercel-storage.com/uploads/temp/1706000000_abc123.jpg"
    ],
    "media": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "userId": "user-123",
        "teamId": "team-456",
        "url": "https://blob.vercel-storage.com/uploads/temp/1706000000_abc123.jpg",
        "filename": "photo.jpg",
        "fileSize": 250000,
        "mimeType": "image/jpeg",
        "width": 1920,
        "height": 1080,
        "title": null,
        "alt": null,
        "caption": null,
        "status": "active",
        "createdAt": "2025-01-15T11:30:00.000Z",
        "updatedAt": "2025-01-15T11:30:00.000Z"
      }
    ],
    "count": 1,
    "storage": "vercel-blob"
  }
}
```

### Storage Modes

| Mode | Condition | URL Pattern |
|------|-----------|-------------|
| **Vercel Blob** (`storage: "vercel-blob"`) | `STORAGE_DRIVER=vercel-blob`, or unset with `BLOB_READ_WRITE_TOKEN` starting with `vercel_blob_` | `https://<store>.public.blob.vercel-storage.com/uploads/temp/...` |
| **S3-compatible** (`storage: "s3"`) | `STORAGE_DRIVER=s3` | `{S3_PUBLIC_URL}/uploads/...` |
| **Local disk** (`storage: "local"`) | `STORAGE_DRIVER=local` | `/api/v1/media/files/...` |
| **Development fallback** (`storage: "local"`) | Development only: no driver, or a Blob upload fails | `/uploads/temp/...` |
| **Not configured** | Production with no driver | `503`, code `STORAGE_NOT_CONFIGURED`, `details.missing: "BLOB_READ_WRITE_TOKEN"` |
| **Misconfigured** | `STORAGE_DRIVER` set, a variable missing or malformed | `503`, code `STORAGE_NOT_CONFIGURED`, `details.invalid: ["S3_BUCKET", ...]` (names only) |

### Validation

- File type must be in `MEDIA_CONFIG.allowedMimeTypes`
- File size must not exceed `MEDIA_CONFIG.maxSizeMB` (general), `maxSizeImageMB` (images), or `maxSizeVideoMB` (videos)
- At most 100 files per request (`400`, code `TOO_MANY_FILES`)
- A file of zero bytes is refused (`400`, code `EMPTY_FILE`)
- The body must be `multipart/form-data` (`415`, code `UNSUPPORTED_MEDIA_TYPE`)

---

## Direct Upload (S3)

With `STORAGE_DRIVER=s3` a client can send a file straight to the bucket, so large files skip the app server. It takes three requests; the bucket needs a CORS rule for browser uploads ([Configuration](./05-configuration.md#direct-uploads-cors-and-unconfirmed-objects)). Other drivers answer `400`, code `DIRECT_UPLOAD_UNSUPPORTED`.

### 1. Presign

```
POST /api/v1/media/upload/presign
```

Same authentication, scope (`media:write`) and permission (`media.upload`) as [Upload Files](#upload-files).

```json
{ "filename": "photo.jpg", "mimeType": "image/jpeg", "size": 482113 }
```

`mimeType` must be allowed and `size` (bytes) within the limit for its type, or `400` with code `FILE_TYPE_NOT_ALLOWED` / `FILE_TOO_LARGE`.

```json
{
  "success": true,
  "data": {
    "upload": {
      "url": "https://<bucket host>/pending/1706000000_9f2c...e1.jpg?X-Amz-Expires=300&X-Amz-Signature=...",
      "method": "PUT",
      "headers": { "Content-Type": "image/jpeg" },
      "expiresAt": "2026-10-18T12:05:00.000Z"
    },
    "token": "eyJuYW1lIjoi..."
  }
}
```

The server names the object; the client's file name is only kept for display. The URL is valid for 5 minutes and its signature covers the `Content-Type` and the declared size: the storage refuses a `PUT` with another type or another length. AWS S3 also refuses extra `x-amz-*` headers that are not signed (such as an ACL), and so did versitygw in our tests; check your service. Any other metadata a client sends (`Content-Disposition`, `Cache-Control`, `x-amz-meta-*` where accepted) is replaced on confirm.

### 2. Upload

```bash
curl -X PUT "$UPLOAD_URL" -H "Content-Type: image/jpeg" --data-binary @photo.jpg
```

### 3. Confirm

```
POST /api/v1/media/upload/confirm
```

```json
{ "token": "eyJuYW1lIjoi..." }
```

The token is signed by the server and names the object, the user and team that presigned it, the type and size, and a deadline (one hour). The server then reads the stored object's size and type (HEAD) and its first bytes (a ranged GET), checks them against the declared type, the size limit and the file signature, all before taking any database lock. Then it copies the object from `pending/` to `uploads/` (only if its ETag is still the one it checked, with metadata set by the server: the type, a one-year immutable `Cache-Control`, and `attachment` for a type outside the raster/video table), creates the media record, and deletes the pending object. The response is the record:

```json
{ "success": true, "data": { "media": { "id": "...", "url": "https://cdn.example.com/uploads/1706000000_9f2c...e1.jpg", "...": "..." }, "url": "https://cdn.example.com/uploads/1706000000_9f2c...e1.jpg" } }
```

With `STORAGE_S3_PRIVATE=true` every media record the API returns also carries `displayUrl`, a short-lived signed URL to render; `url` stays the canonical address to store. See [Private bucket](./05-configuration.md#private-bucket).

| Status | Code | When | Object |
|--------|------|------|--------|
| `400` | `INVALID_UPLOAD_TOKEN` | The token is not one the server issued (altered, forged, malformed) | untouched |
| `403` | `UPLOAD_NOT_YOURS` | The token was issued to another user or team | untouched |
| `410` | `UPLOAD_EXPIRED` | More than an hour since the presign | deleted |
| `404` | `UPLOAD_NOT_FOUND` | Nothing was uploaded | |
| `400` | `FILE_TOO_LARGE`, `FILE_SIZE_MISMATCH` | Over the limit, or not the declared size | deleted |
| `400` | `FILE_TYPE_MISMATCH`, `FILE_TYPE_NOT_ALLOWED` | Stored with another type, bytes that do not match the type, or a type no longer allowed | deleted |
| `409` | `UPLOAD_ALREADY_CONFIRMED` | The token was already confirmed; concurrent or replayed confirms create one record | untouched |
| `409` | `UPLOAD_CHANGED` | The object was replaced (another `PUT` to the presigned URL) after the checks | deleted |

An upload that is never confirmed stays under `pending/`; a bucket lifecycle rule removes it ([Configuration](./05-configuration.md#direct-uploads-cors-and-unconfirmed-objects)).

### In the browser: `useMediaUpload`

The `useMediaUpload` hook (used by `MediaUploadZone` and the entity upload fields) picks the flow for you:

1. The first upload asks `GET /api/v1/media/upload` which driver is active (`directUpload`, `supportedTypes`, `maxFileSize`, `maxImageSize`, `maxVideoSize`). The answer is cached in the `QueryClient`, so later uploads do not ask again.
2. Before any byte is sent, each file is checked against those type and size limits; a violation rejects the upload with the server's message. This happens on both paths.
3. At most 100 files go in one call, on both paths (the server's batch limit); more are refused before anything is sent.
4. If `directUpload` is `true` (the `s3` driver), each file goes presign, `PUT` straight to the storage, confirm. The `PUT` is an `XMLHttpRequest`, so the hook reports progress and can cancel it. Cancelling covers the presign and the PUT; once the bytes are stored the confirm runs to completion.
5. Otherwise (`local`, `vercel-blob`), or when the capabilities cannot be read (for example the user lacks `media.read`), the files are posted as `multipart/form-data` to `POST /api/v1/media/upload`, as before. This path reports progress only at 0 and 1, because `fetch` has no upload progress.

```tsx
const upload = useMediaUpload()
const controller = new AbortController()

const { media } = await upload.mutateAsync({
  files: [file],
  onProgress: (fraction) => setProgress(fraction), // 0 to 1
  signal: controller.signal,                       // controller.abort() cancels
})
```

`mutateAsync(files)` with a plain `File[]` still works. The hook (and the entity upload fields that use it) needs a `QueryClientProvider` and a `NextIntlClientProvider` that carries the `media` messages namespace; the dashboard route group provides both. A refused presign, a failed `PUT` or a rejected confirm rejects the mutation with the error message and creates no record (a `PUT` that never gets confirmed is removed by the bucket's lifecycle rule). With several files on the direct path, files confirmed before the failing one keep their records.

---

## Serve Local Files

```
GET /api/v1/media/files/:name
```

With `STORAGE_DRIVER=local`, the URL of every uploaded file. Public, like a Blob or bucket URL. Answers the file with the `Content-Type` of its stored extension (a type outside the raster/video table, or an unknown one, as a download), `X-Content-Type-Options: nosniff` and `Cache-Control: public, max-age=31536000, immutable`; a `Range: bytes=start-end` header gets `206`. Any name not of the generated shape, a symbolic link, and any request while another driver is selected answer `404`. No rate limit: put a CDN or a reverse-proxy cache in front on a public site.

---

## Check Duplicates

```
POST /api/v1/media/check-duplicates
```

Check if files with the same filename and file size already exist in the media library. Used by the upload zone to warn users before uploading duplicate files.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array | Yes | 1 to 100 `{ filename: string, fileSize: number }` objects (`400` otherwise) |

### Request

```bash
curl -X POST "https://yourdomain.com/api/v1/media/check-duplicates" \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      { "filename": "photo.jpg", "fileSize": 250000 },
      { "filename": "logo.png", "fileSize": 45230 }
    ]
  }'
```

### Response (200 OK) - Duplicates Found

```json
{
  "success": true,
  "data": {
    "duplicates": [
      {
        "filename": "photo.jpg",
        "fileSize": 250000,
        "existing": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "url": "https://blob.vercel-storage.com/uploads/temp/photo.jpg",
            "createdAt": "2025-01-10T09:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

### Response (200 OK) - No Duplicates

```json
{
  "success": true,
  "data": {
    "duplicates": []
  }
}
```

---

## Get Single Media

```
GET /api/v1/media/:id
```

Retrieve a single media item by its ID. Returns only active media from teams the user belongs to.

### Request

```bash
curl "https://yourdomain.com/api/v1/media/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer sk_live_abc123"
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-123",
    "teamId": "team-456",
    "url": "https://blob.vercel-storage.com/uploads/temp/1706000000_abc123.png",
    "filename": "company-logo.png",
    "fileSize": 45230,
    "mimeType": "image/png",
    "width": 400,
    "height": 200,
    "title": "Company Logo",
    "alt": "ACME Corp logo in blue",
    "caption": null,
    "status": "active",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### Response (404 Not Found)

```json
{
  "success": false,
  "error": "Media not found"
}
```

---

## Update Media Metadata

```
PATCH /api/v1/media/:id
```

Update editable metadata fields on a media item. File properties (url, filename, fileSize, mimeType, dimensions) are immutable and cannot be changed.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string or null | No | Display title (max 255 chars) |
| `alt` | string or null | No | Alt text for accessibility (max 500 chars) |
| `caption` | string or null | No | Caption text (max 1000 chars) |

### Request

```bash
curl -X PATCH "https://yourdomain.com/api/v1/media/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Logo",
    "alt": "ACME Corp blue logo on transparent background",
    "caption": "Our primary brand mark for web use"
  }'
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-123",
    "teamId": "team-456",
    "url": "https://blob.vercel-storage.com/uploads/temp/1706000000_abc123.png",
    "filename": "company-logo.png",
    "fileSize": 45230,
    "mimeType": "image/png",
    "width": 400,
    "height": 200,
    "title": "Updated Logo",
    "alt": "ACME Corp blue logo on transparent background",
    "caption": "Our primary brand mark for web use",
    "status": "active",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## Delete Media

```
DELETE /api/v1/media/:id
```

Soft delete a media item by setting its status to `deleted`, and delete its file through the storage driver. A file stored by another driver than the current one (an older URL) is left in place; a failed file delete is logged and the media item is still deleted.

### Request

```bash
curl -X DELETE "https://yourdomain.com/api/v1/media/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer sk_live_abc123"
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "message": "Media deleted successfully"
  }
}
```

### Response (404 Not Found)

```json
{
  "success": false,
  "error": "Media not found"
}
```

---

## Get Media Tags

```
GET /api/v1/media/:id/tags
```

Get all tags assigned to a specific media item.

### Request

```bash
curl "https://yourdomain.com/api/v1/media/550e8400-e29b-41d4-a716-446655440000/tags" \
  -H "Authorization: Bearer sk_live_abc123"
```

### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "tag-001",
      "type": "media_tag",
      "slug": "brand",
      "name": "Brand",
      "description": null,
      "icon": null,
      "color": "#3b82f6",
      "order": 0,
      "isActive": true,
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-10T08:00:00.000Z"
    }
  ]
}
```

---

## Add Tags to Media

```
POST /api/v1/media/:id/tags
```

Add a tag to a media item. If the tag is already assigned, the operation is idempotent (no error, no duplicate).

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tagId` | string | Yes | ID of the tag taxonomy to add |

### Request

```bash
curl -X POST "https://yourdomain.com/api/v1/media/550e8400-e29b-41d4-a716-446655440000/tags" \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{ "tagId": "tag-001" }'
```

### Response (201 Created)

Returns the updated list of tags for the media item:

```json
{
  "success": true,
  "data": [
    {
      "id": "tag-001",
      "type": "media_tag",
      "slug": "brand",
      "name": "Brand",
      "description": null,
      "icon": null,
      "color": "#3b82f6",
      "order": 0,
      "isActive": true,
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-10T08:00:00.000Z"
    }
  ]
}
```

### Replace All Tags

```
PUT /api/v1/media/:id/tags
```

Replace all tags on a media item with the provided set (at most 100 tag ids).

```bash
curl -X PUT "https://yourdomain.com/api/v1/media/550e8400-e29b-41d4-a716-446655440000/tags" \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{ "tagIds": ["tag-001", "tag-002"] }'
```

---

## Remove Tags from Media

```
DELETE /api/v1/media/:id/tags?tagId=<tagId>
```

Remove a specific tag from a media item.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tagId` | string | Yes | ID of the tag to remove |

### Request

```bash
curl -X DELETE "https://yourdomain.com/api/v1/media/550e8400-e29b-41d4-a716-446655440000/tags?tagId=tag-001" \
  -H "Authorization: Bearer sk_live_abc123"
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

## List All Tags

```
GET /api/v1/media-tags
```

List all available media tags (taxonomies of type `media_tag`). Returns only active, non-deleted tags sorted by order and name.

### Request

```bash
curl "https://yourdomain.com/api/v1/media-tags" \
  -H "Authorization: Bearer sk_live_abc123"
```

### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "tag-001",
      "type": "media_tag",
      "slug": "brand",
      "name": "Brand",
      "description": null,
      "icon": null,
      "color": "#3b82f6",
      "order": 0,
      "isActive": true,
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-10T08:00:00.000Z"
    },
    {
      "id": "tag-002",
      "type": "media_tag",
      "slug": "product-photos",
      "name": "Product Photos",
      "description": null,
      "icon": null,
      "color": "#10b981",
      "order": 1,
      "isActive": true,
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-10T08:00:00.000Z"
    }
  ]
}
```

---

## Create Tag

```
POST /api/v1/media-tags
```

Create a new media tag. The slug is auto-generated from the name. If a tag with the same slug already exists, it is updated instead (upsert behavior).

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Tag display name, 1 to 100 characters |

### Request

```bash
curl -X POST "https://yourdomain.com/api/v1/media-tags" \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Product Photos" }'
```

### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "tag-002",
    "slug": "product-photos",
    "name": "Product Photos",
    "color": null,
    "icon": null,
    "order": 0,
    "isActive": true
  }
}
```

---

## Error Responses

All endpoints return standard error responses:

### 400 Bad Request

Returned when the request body or query parameters are invalid.

```json
{
  "success": false,
  "error": "Invalid query parameters",
  "details": {
    "errors": [
      {
        "code": "too_big",
        "maximum": 100,
        "path": ["limit"],
        "message": "Number must be less than or equal to 100"
      }
    ]
  }
}
```

### 401 Unauthorized

Returned when no valid session or API key is provided.

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 403 Forbidden

Returned when the authenticated user lacks the required scope.

```json
{
  "success": false,
  "error": "Insufficient permissions - media:read scope required"
}
```

### 404 Not Found

Returned when the requested media item does not exist or is not accessible.

```json
{
  "success": false,
  "error": "Media not found"
}
```

### 429 Too Many Requests

Returned when the rate limit is exceeded.

### 500 Internal Server Error

Returned when an unexpected server error occurs.

```json
{
  "success": false,
  "error": "Failed to list media"
}
```

---

**Documentation:** `core/docs/21-media-library/02-api-reference.md`
