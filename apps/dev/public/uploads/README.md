# Media Upload System

## Overview
This application uses **Vercel Blob Storage** for all media uploads. Files are stored in the cloud, not on the local filesystem.

> **Note:** This directory (`public/uploads/`) is legacy from a previous filesystem-based implementation and is no longer used.

## Upload Endpoint
**POST** `/api/v1/media/upload`

### Authentication
Requires valid user session (Better Auth)

### Request
- **Content-Type**: `multipart/form-data`
- **Field name**: `files` (accepts multiple files)

### Supported File Types
- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, MPEG, QuickTime, WebM

### File Size Limit
- Maximum: 10MB per file

### Response
```json
{
  "message": "Files uploaded successfully",
  "urls": [
    "https://xxxxx.public.blob.vercel-storage.com/uploads/temp/1234567890_abc123.jpg",
    "https://xxxxx.public.blob.vercel-storage.com/uploads/temp/1234567890_def456.png"
  ],
  "count": 2
}
```

## File Naming Convention
Files are automatically renamed using the pattern:
```
{timestamp}_{randomString}.{extension}
```

Example: `1704067200000_k9x2m4p.jpg`

## Storage Location
- **Storage Provider**: Vercel Blob (cloud object storage)
- **Blob Path**: `uploads/temp/{filename}` (organizational prefix, not a filesystem path)
- **Public URL**: `https://xxxxx.public.blob.vercel-storage.com/uploads/temp/{filename}`

### How It Works

**Local Development:**
- Files are uploaded directly to Vercel Blob using `BLOB_READ_WRITE_TOKEN` from `.env`
- No files are saved to your local filesystem
- URLs point to Vercel's CDN

**Production/Staging:**
- Same behavior - files go directly to Vercel Blob
- Uses environment-specific Blob token
- No filesystem writes (Vercel serverless is read-only)

## Usage in AI Content Generation
The generate-content endpoint (`/api/v1/theme/content-buddy/generate-content`) automatically processes images for AI analysis.

**Supported URL formats:**
- Vercel Blob URLs: `https://xxxxx.public.blob.vercel-storage.com/uploads/temp/image.jpg`
- External URLs: `https://example.com/image.jpg` (also supported)

## Configuration
Requires `BLOB_READ_WRITE_TOKEN` environment variable:

```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

## Cleanup
Files are managed through Vercel Blob's retention policies.

**Manual cleanup** (if needed):
```typescript
import { del } from '@vercel/blob'

// Delete specific file
await del(fileUrl)

// Or list and delete old files
import { list } from '@vercel/blob'
const { blobs } = await list({ prefix: 'uploads/temp/' })
// Filter and delete as needed
```

## Security Notes
- All uploads require authentication
- File type validation prevents malicious uploads
- File size limits prevent DoS attacks
- Random filenames prevent enumeration attacks
- Files stored in secure Vercel Blob infrastructure
