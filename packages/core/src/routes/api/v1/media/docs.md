# Media API

Upload and manage media files.

## Overview

The Media API provides endpoints for uploading images and videos to Vercel Blob storage. All operations require authentication and appropriate scopes.

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
    "storage": "Vercel Blob",
    "uploadPath": "uploads/temp/",
    "supportedTypes": ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"],
    "maxFileSize": "10MB"
  }
}
```

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
| Maximum file size | 10 MB |
| Maximum files per request | No limit |
| Storage | Vercel Blob (public access) |

## File Naming

Files are renamed on upload using the pattern:
```
{timestamp}_{randomString}.{extension}
```

Example: `1704816000000_a1b2c3d4e5f.jpg`

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - No files uploaded or invalid file type |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 500 | Server Error - Upload to Vercel Blob failed |

## Usage Notes

- Files are uploaded to `uploads/temp/` directory
- All uploaded files are publicly accessible
- Consider implementing cleanup for temporary files
- The API validates file types by MIME type, not just extension
