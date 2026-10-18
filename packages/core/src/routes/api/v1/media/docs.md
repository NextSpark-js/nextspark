# Media API

Upload and manage media files.

## Overview

The Media API provides endpoints for uploading images and videos to the storage driver `STORAGE_DRIVER` selects: Vercel Blob, any S3-compatible service, or a directory on the server (see `docs/21-media-library/05-configuration.md`). Production without a driver answers `503 STORAGE_NOT_CONFIGURED`. All operations except serving local files require authentication and appropriate scopes.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header with `media:write` or `media:read` scope

## Endpoints

### Upload Files
`POST /api/v1/media/upload`

Upload one or multiple media files.

**Required Scope:** `media:write`

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `files`

**Example (cURL):**
```bash
curl -X POST /api/v1/media/upload \
  -H "x-api-key: sk_live_xxx" \
  -F "files=@image1.jpg" \
  -F "files=@image2.png"
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "message": "Files uploaded successfully",
    "urls": [
      "https://xxx.public.blob.vercel-storage.com/uploads/temp/123_abc.jpg",
      "https://xxx.public.blob.vercel-storage.com/uploads/temp/124_def.png"
    ],
    "count": 2
  }
}
```

### Get Upload Info
`GET /api/v1/media/upload`

Get information about the upload endpoint configuration.

**Required Scope:** `media:read`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Media upload endpoint is active",
    "storage": "s3",
    "directUpload": true,
    "supportedTypes": ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "video/mp4", "video/mpeg", "video/quicktime", "video/webm"],
    "maxFileSize": "10MB"
  }
}
```

`storage` is the selected driver (`vercel-blob`, `s3`, `local`) or `Not configured (...)`; `directUpload` says whether presign/confirm are available.

### Direct Upload (s3 driver)
`POST /api/v1/media/upload/presign` then `PUT` to storage, then `POST /api/v1/media/upload/confirm`

**Required Scope:** `media:write` (and the `media.upload` permission), on both calls.

1. Presign: body `{ "filename": "photo.jpg", "mimeType": "image/jpeg", "size": 482113 }`. Answers `{ upload: { url, method: "PUT", headers, expiresAt }, token }`; the URL is valid 5 minutes and accepts only that type and size.
2. `PUT` the bytes to `upload.url` with `upload.headers`.
3. Confirm: body `{ "token": "..." }`. Answers `{ media, url }`. The server checks size, type and file signature before creating the record; see the error table in `docs/21-media-library/02-api-reference.md`.

### Serve Local Files
`GET /api/v1/media/files/:name`

Public. With `STORAGE_DRIVER=local`, serves an uploaded file (type from its extension, `nosniff`, byte ranges); 404 for any other driver or any name the server did not generate.

## Supported File Types

### Images
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)

### Videos
- MP4 (`.mp4`)
- MPEG (`.mpeg`)
- QuickTime (`.mov`)
- WebM (`.webm`)

## Limitations

| Limit | Value |
|-------|-------|
| Maximum file size | 10 MB (`media.maxSizeMB`, per type `maxSizeImageMB` / `maxSizeVideoMB`) |
| Maximum files per request | 100 |
| Storage | The selected driver (public URLs) |

## File Naming

Files are renamed on upload using the pattern:
```
{timestamp}_{32 hex digits}.{extension of the allowed type}
```

Example: `1704816000000_9f2c4e0b7a1d4c3e8b6f5a2d1c0e9b8a.jpg`

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - No files uploaded or invalid file type |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 409 | Conflict - Direct upload already confirmed, or changed after its checks |
| 410 | Gone - Direct upload token expired |
| 500 | Server Error - The storage failed |
| 503 | Storage not configured (`STORAGE_NOT_CONFIGURED`) |

## Usage Notes

- Vercel Blob stores under `uploads/temp/`, S3 under `uploads/` (direct uploads wait under `pending/`, which a bucket lifecycle rule should expire), local in `UPLOADS_DIR`
- All uploaded files are publicly accessible
- Deleting a media item also deletes its file
- The API validates file types by MIME type and by the file's leading bytes, not by extension
