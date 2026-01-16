# /how-to:handle-file-uploads

Interactive guide to implement file uploads and media management in NextSpark.

**Aliases:** `/how-to:media`, `/how-to:file-upload`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/entity-system/SKILL.md` - Entity field definitions
- `.claude/skills/zod-validation/SKILL.md` - Input validation patterns

---

## Syntax

```
/how-to:handle-file-uploads
/how-to:handle-file-uploads --component image
/how-to:handle-file-uploads --entity
```

---

## Behavior

Guides the user through implementing file uploads, using upload components, and adding file fields to entities.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding the Media System
        └── Vercel Blob, supported types, limits

Step 2: Configure Environment
        └── BLOB_READ_WRITE_TOKEN setup

Step 3: Using Upload Components
        └── FileUpload, ImageUpload, VideoUpload, AudioUpload

Step 4: Adding File Fields to Entities
        └── Entity field types and configuration

Step 5: Custom Upload Handling
        └── API endpoint, permissions, advanced usage
```

---

## Step 1: Understanding the Media System

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: HANDLE FILE UPLOADS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding the Media System

NextSpark uses Vercel Blob for cloud file storage
with specialized components for different media types.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Storage Architecture:**

```
┌─────────────────────────────────────────────┐
│  VERCEL BLOB STORAGE                        │
│  ─────────────────────────────────────────  │
│  • Cloud-based file storage                 │
│  • Public URLs for uploaded files           │
│  • Automatic CDN distribution               │
│  • No server storage required               │
└─────────────────────────────────────────────┘
```

**📋 Supported File Types:**

| Category | MIME Types | Extensions |
|----------|------------|------------|
| Images | image/jpeg, image/png, image/gif, image/webp | .jpg, .png, .gif, .webp |
| Videos | video/mp4, video/mpeg, video/quicktime, video/webm | .mp4, .mpeg, .mov, .webm |
| Audio | audio/mpeg, audio/wav, audio/ogg, audio/m4a | .mp3, .wav, .ogg, .m4a |
| Files | Any | Any (configurable) |

**📋 Limits:**

| Limit | Value |
|-------|-------|
| Max file size | 10 MB per file |
| Max files per upload | 5 files (configurable) |
| Storage path | `uploads/temp/{timestamp}_{random}.{ext}` |

**📋 Available Components:**

```
packages/core/src/components/ui/
├── file-upload.tsx    # Generic file upload
├── image-upload.tsx   # Image-specific with preview
├── video-upload.tsx   # Video with thumbnail generation
└── audio-upload.tsx   # Audio with built-in player
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Configure Environment)
[2] Can I use S3 or Cloudinary instead?
[3] What are the storage costs?
```

---

## Step 2: Configure Environment

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Configure Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set up Vercel Blob storage for your project.
```

**📋 Required Environment Variables:**

```bash
# .env or .env.local

# Vercel Blob Storage Token (REQUIRED)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

**📋 Getting a Blob Token:**

1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Create a new **Blob** store
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add to your `.env.local` file

**📋 Local Development:**

For local development, you still need a Vercel Blob token. The files are stored in Vercel's cloud even during development.

```bash
# Verify your token is set
echo $BLOB_READ_WRITE_TOKEN
```

**📋 Package Dependencies:**

The required package is already included:

```json
{
  "@vercel/blob": "^2.0.0"
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Upload Components)
[2] I don't use Vercel, what are my options?
[3] How do I test without a token?
```

---

## Step 3: Using Upload Components

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Using Upload Components
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NextSpark provides specialized components for
different media types.
```

**📋 1. FileUpload (Generic):**

```typescript
import { FileUpload } from '@/core/components/ui/file-upload'

interface FileUploadProps {
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  maxFiles?: number        // Default: 5
  maxSize?: number         // MB, Default: 10
  acceptedTypes?: string[] // Default: ["*"]
  disabled?: boolean
  multiple?: boolean       // Default: true
  dragDrop?: boolean       // Default: true
}

// Usage
<FileUpload
  value={files}
  onChange={setFiles}
  maxFiles={3}
  maxSize={5}
  acceptedTypes={['application/pdf', 'text/*']}
/>
```

**📋 2. ImageUpload (Images with Preview):**

```typescript
import { ImageUpload } from '@/core/components/ui/image-upload'

interface ImageUploadProps {
  value: UploadedImage[]
  onChange: (images: UploadedImage[]) => void
  maxImages?: number       // Default: 5
  maxSize?: number         // MB, Default: 5
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'free'
  showPreview?: boolean    // Default: true
  multiple?: boolean
}

// Usage
<ImageUpload
  value={images}
  onChange={setImages}
  maxImages={1}
  aspectRatio="square"
/>
```

**📋 3. VideoUpload (Videos with Thumbnails):**

```typescript
import { VideoUpload } from '@/core/components/ui/video-upload'

interface VideoUploadProps {
  value: UploadedVideo[]
  onChange: (videos: UploadedVideo[]) => void
  maxVideos?: number       // Default: 3
  maxSize?: number         // MB, Default: 100
  acceptedFormats?: string[] // Default: ["mp4", "mov", "avi", "mkv", "webm"]
}

// Usage - auto-generates thumbnails!
<VideoUpload
  value={videos}
  onChange={setVideos}
  maxVideos={1}
  maxSize={50}
/>
```

**📋 4. AudioUpload (Audio with Player):**

```typescript
import { AudioUpload } from '@/core/components/ui/audio-upload'

interface AudioUploadProps {
  value: UploadedAudio[]
  onChange: (audios: UploadedAudio[]) => void
  maxAudios?: number       // Default: 5
  maxSize?: number         // MB, Default: 50
  acceptedFormats?: string[] // Default: ["mp3", "wav", "ogg", "m4a", "aac"]
  showPlayer?: boolean     // Default: true
}

// Usage - includes built-in audio player!
<AudioUpload
  value={audioFiles}
  onChange={setAudioFiles}
  showPlayer={true}
/>
```

**📋 Uploaded File Types:**

```typescript
interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url?: string
  uploadProgress?: number
}

interface UploadedImage extends UploadedFile {
  alt?: string
  width?: number
  height?: number
}

interface UploadedVideo extends UploadedFile {
  duration?: number
  thumbnail?: string  // Auto-generated
}

interface UploadedAudio extends UploadedFile {
  duration?: number
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Entity Fields)
[2] Show me a complete form example
[3] How do I customize the upload UI?
```

---

## Step 4: Adding File Fields to Entities

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Adding File Fields to Entities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add file fields to your entities for automatic
form and display handling.
```

**📋 Available Field Types:**

| Type | Component | Use Case |
|------|-----------|----------|
| `file` | FileUpload | Documents, PDFs, any files |
| `image` | ImageUpload | Photos, avatars, graphics |
| `video` | VideoUpload | Video content |
| `audio` | AudioUpload | Audio files, podcasts |

**📋 Entity Field Definition:**

```typescript
// In your entity.fields.ts

// Image field example
{
  name: 'featuredImage',
  type: 'image',
  required: false,
  display: {
    label: 'Featured Image',
    description: 'Main image for the post',
    placeholder: 'Upload an image...',
    showInList: false,    // Hide in table (shows count)
    showInDetail: true,
    showInForm: true,
    order: 5,
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false,
  },
}

// File attachments example
{
  name: 'attachments',
  type: 'file',
  required: false,
  display: {
    label: 'Attachments',
    description: 'Upload project files (max 5)',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 10,
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false,
  },
}
```

**📋 Database Storage:**

Files are stored as JSONB arrays in the database:

```sql
-- In your migration
ALTER TABLE posts ADD COLUMN featured_image jsonb;
ALTER TABLE posts ADD COLUMN attachments jsonb;
```

```json
// Stored structure
[
  {
    "id": "1704067200000-0.456",
    "name": "image.jpg",
    "size": 245678,
    "type": "image/jpeg",
    "url": "https://xxxxx.public.blob.vercel-storage.com/uploads/temp/...",
    "alt": "Description"
  }
]
```

**📋 EntityFieldRenderer Integration:**

The entity system automatically renders the correct component:

```typescript
// This happens automatically in EntityFieldRenderer.tsx
case 'image':
  return (
    <ImageUpload
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      disabled={disabled}
      multiple={true}
    />
  )
```

**📋 Display in List/Detail Views:**

File fields show a count in list and detail views:

```
// In list view column
"2 archivos"

// In detail view
"3 archivos"
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Custom Upload Handling)
[2] How do I validate file types in schema?
[3] Can I have a single image instead of array?
```

---

## Step 5: Custom Upload Handling

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Custom Upload Handling
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For advanced use cases, interact directly
with the upload API.
```

**📋 Upload API Endpoint:**

```
POST /api/v1/media/upload
Content-Type: multipart/form-data
Authorization: Bearer {apiKey} OR Session Cookie
```

**📋 Making Upload Requests:**

```typescript
async function uploadFiles(files: File[]) {
  const formData = new FormData()

  files.forEach((file, index) => {
    formData.append(`file${index}`, file)
  })

  const response = await fetch('/api/v1/media/upload', {
    method: 'POST',
    body: formData,
    // Note: Don't set Content-Type, browser sets it with boundary
  })

  const data = await response.json()

  if (data.success) {
    return data.urls // Array of uploaded file URLs
  } else {
    throw new Error(data.error)
  }
}
```

**📋 API Response Format:**

```json
// Success
{
  "message": "Files uploaded successfully",
  "urls": [
    "https://xxxxx.public.blob.vercel-storage.com/uploads/temp/1704067200000_abc123.jpg",
    "https://xxxxx.public.blob.vercel-storage.com/uploads/temp/1704067200001_def456.pdf"
  ],
  "count": 2
}

// Error
{
  "success": false,
  "error": "File type not allowed"
}
```

**📋 Required Permissions:**

| Scope | Action |
|-------|--------|
| `media:write` | Upload files |
| `media:read` | List/retrieve files |

**📋 Deleting Files:**

```typescript
import { del } from '@vercel/blob'

// Delete a specific file by URL
await del(fileUrl)

// List files (for cleanup)
import { list } from '@vercel/blob'
const { blobs } = await list({ prefix: 'uploads/temp/' })
```

**📋 Server-Side Validation:**

The upload endpoint validates:
1. File type (MIME type check)
2. File size (max 10MB)
3. File count (max per request)
4. Authentication (session or API key)
5. Permissions (media:write scope)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Media system architecture (Vercel Blob)
• Environment configuration
• Using upload components
• Adding file fields to entities
• Custom upload handling

📚 Related tutorials:
   • /how-to:create-entity - Create entities with file fields
   • /how-to:create-api - Custom API endpoints

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "Can I use S3 or Cloudinary instead?"

```
📋 Alternative Storage Providers:

Currently, NextSpark uses Vercel Blob. To use S3 or Cloudinary:

1. Create a custom upload endpoint:
   /app/api/v1/media/upload-s3/route.ts

2. Implement your provider:

   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

   const s3 = new S3Client({ region: 'us-east-1' })

   export async function POST(request: Request) {
     const formData = await request.formData()
     const file = formData.get('file') as File

     await s3.send(new PutObjectCommand({
       Bucket: process.env.S3_BUCKET,
       Key: `uploads/${file.name}`,
       Body: Buffer.from(await file.arrayBuffer()),
       ContentType: file.type,
     }))

     return Response.json({
       url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/uploads/${file.name}`
     })
   }

3. Configure upload components to use your endpoint.
```

### "Show me a complete form example"

```typescript
'use client'

import { useState } from 'react'
import { ImageUpload } from '@/core/components/ui/image-upload'
import { FileUpload } from '@/core/components/ui/file-upload'
import { Button } from '@/core/components/ui/button'

export function ProductForm() {
  const [images, setImages] = useState([])
  const [documents, setDocuments] = useState([])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const productData = {
      // ... other fields
      images: images.map(img => ({
        url: img.url,
        alt: img.alt || img.name
      })),
      documents: documents.map(doc => ({
        url: doc.url,
        name: doc.name,
        size: doc.size
      }))
    }

    await saveProduct(productData)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label>Product Images</label>
          <ImageUpload
            value={images}
            onChange={setImages}
            maxImages={5}
            aspectRatio="square"
          />
        </div>

        <div>
          <label>Documentation</label>
          <FileUpload
            value={documents}
            onChange={setDocuments}
            maxFiles={3}
            acceptedTypes={['application/pdf']}
          />
        </div>

        <Button type="submit">Save Product</Button>
      </div>
    </form>
  )
}
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:create-entity` | Create entities with file fields |
| `/how-to:create-api` | Custom API endpoints |
| `/how-to:add-metadata` | Add metadata to uploaded files |
