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
| **POST** | `/api/v1/media/check-duplicates` | Check for duplicates by filename+size | `media:read` |
| **GET** | `/api/v1/media/[id]` | Get single media | `media:read` |
| **PATCH** | `/api/v1/media/[id]` | Update media metadata | `media:write` |
| **DELETE** | `/api/v1/media/[id]` | Delete media (soft delete) | `media:delete` |
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
| `tagIds` | string | - | Comma-separated tag IDs to filter by |
| `tagSlugs` | string | - | Comma-separated tag slugs to filter by |

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

Upload one or more files via multipart form data. Files are stored in Vercel Blob (when `BLOB_READ_WRITE_TOKEN` is configured) or local filesystem as fallback. Image dimensions are automatically extracted. A media record is created in the database for each uploaded file.

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
| **Vercel Blob** | `BLOB_READ_WRITE_TOKEN` starts with `vercel_blob_` | `https://blob.vercel-storage.com/uploads/temp/...` |
| **Local Storage** | No blob token or blob upload fails | `/uploads/temp/...` |

### Validation

- File type must be in `MEDIA_CONFIG.allowedMimeTypes`
- File size must not exceed `MEDIA_CONFIG.maxSizeMB` (general), `maxSizeImageMB` (images), or `maxSizeVideoMB` (videos)
- Empty files are skipped

---

## Check Duplicates

```
POST /api/v1/media/check-duplicates
```

Check if files with the same filename and file size already exist in the media library. Used by the upload zone to warn users before uploading duplicate files.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array | Yes | Array of `{ filename: string, fileSize: number }` objects |

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

Soft delete a media item by setting its status to `deleted`. The file remains in storage but is hidden from all queries.

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

Replace all tags on a media item with the provided set.

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
| `name` | string | Yes | Tag display name |

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
