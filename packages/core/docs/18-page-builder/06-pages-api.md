# Builder Entity API

This document describes the REST API endpoints for managing builder-enabled entities (Pages, Posts, etc.).

## Overview

Builder entities use the **generic entity API** (`generic-handler.ts`) for all CRUD operations. This ensures consistency across all entities and automatic handling of the `blocks` field.

**Endpoints**:
- `/api/v1/pages` - Pages entity
- `/api/v1/posts` - Posts entity
- `/api/v1/{entity}` - Any builder-enabled entity

## Authentication

All API endpoints require a valid session. Include the session cookie in requests:

```typescript
// Using fetch
const response = await fetch('/api/v1/pages', {
  credentials: 'include',  // Include session cookie
  headers: {
    'Content-Type': 'application/json',
  },
})
```

## Builder Request Header

When saving blocks, the builder UI sends a special header to identify the request:

```typescript
// Sent by builder-editor-view.tsx
headers: {
  'Content-Type': 'application/json',
  'x-builder-source': 'true',  // Identifies builder requests
}
```

The generic handler uses this header to determine when to process blocks:

1. **With header** (`x-builder-source: true`): Blocks are saved to database
2. **Without header**: Blocks field is ignored (for security)

This 3-condition validation ensures blocks are only saved through the builder:
- Entity has `builder.enabled: true`
- Request has `x-builder-source` header
- Request payload contains `blocks`

## Endpoints

### List Pages

**GET** `/api/v1/pages`

Returns a paginated list of pages.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `published` | boolean | - | Filter by published status |
| `locale` | string | `'en'` | Filter by locale |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page |

**Example Request**:
```bash
GET /api/v1/pages?published=true&locale=en&page=1&limit=10
```

**Example Response**:
```json
{
  "pages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "about-us",
      "title": "About Us",
      "blocks": [...],
      "locale": "en",
      "published": true,
      "seo_title": "About Our Company",
      "seo_description": "Learn about our mission and values",
      "author_id": "user-123",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-20T14:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

### Create Page

**POST** `/api/v1/pages`

Creates a new page.

**Request Body**:
```typescript
interface CreatePageRequest {
  slug: string          // Required: URL-friendly identifier
  title: string         // Required: Page title
  blocks?: BlockInstance[]  // Optional: Initial blocks
  locale?: string       // Optional: Default 'en'
  published?: boolean   // Optional: Default false
  seoTitle?: string     // Optional: SEO title
  seoDescription?: string  // Optional: Meta description
  seoKeywords?: string  // Optional: Meta keywords
  ogImage?: string      // Optional: Open Graph image URL
}
```

**Example Request**:
```bash
POST /api/v1/pages
Content-Type: application/json

{
  "slug": "contact",
  "title": "Contact Us",
  "blocks": [
    {
      "id": "block-1",
      "blockSlug": "hero",
      "props": {
        "title": "Get in Touch",
        "content": "We'd love to hear from you"
      }
    }
  ],
  "published": false
}
```

**Example Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "slug": "contact",
  "title": "Contact Us",
  "blocks": [...],
  "locale": "en",
  "published": false,
  "author_id": "current-user-id",
  "created_at": "2025-01-21T10:00:00Z",
  "updated_at": "2025-01-21T10:00:00Z"
}
```

**Validation Errors**:
- `400 Bad Request`: Invalid data or Zod validation failure
- `400 Bad Request`: Slug is reserved (see reserved slugs)
- `400 Bad Request`: Slug already exists for this locale

---

### Get Page

**GET** `/api/v1/pages/:id`

Retrieves a single page by ID.

**Example Request**:
```bash
GET /api/v1/pages/550e8400-e29b-41d4-a716-446655440000
```

**Example Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "about-us",
  "title": "About Us",
  "blocks": [
    {
      "id": "abc-123",
      "blockSlug": "hero",
      "props": {
        "title": "About Our Company",
        "content": "We build amazing products",
        "cta.text": "Learn More",
        "cta.link": "/products"
      }
    },
    {
      "id": "def-456",
      "blockSlug": "features-grid",
      "props": {
        "title": "Our Values",
        "items": [
          { "icon": "Heart", "title": "Passion", "description": "We love what we do" }
        ]
      }
    }
  ],
  "locale": "en",
  "published": true,
  "seo_title": "About Our Company",
  "seo_description": "Learn about our mission",
  "author_id": "user-123",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-20T14:45:00Z"
}
```

**Errors**:
- `404 Not Found`: Page not found

---

### Update Page

**PATCH** `/api/v1/pages/:id`

Updates an existing page.

**Request Body**:
```typescript
interface UpdatePageRequest {
  slug?: string
  title?: string
  blocks?: BlockInstance[]
  published?: boolean
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string
  ogImage?: string
  settings?: PageSettings  // SEO and custom fields
}
```

**Example Request**:
```bash
PATCH /api/v1/pages/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "title": "About Us - Updated",
  "blocks": [...],
  "published": true
}
```

**Example Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "about-us",
  "title": "About Us - Updated",
  "blocks": [...],
  "published": true,
  "updated_at": "2025-01-21T15:00:00Z"
}
```

**Errors**:
- `400 Bad Request`: Invalid data
- `400 Bad Request`: Slug conflict
- `404 Not Found`: Page not found

---

### Delete Page

**DELETE** `/api/v1/pages/:id`

Deletes a page.

**Example Request**:
```bash
DELETE /api/v1/pages/550e8400-e29b-41d4-a716-446655440000
```

**Example Response** (204 No Content):
```text
(empty body)
```

**Errors**:
- `404 Not Found`: Page not found

---

### Validate Slug

**POST** `/api/v1/pages/validate-slug`

Checks if a slug is available and valid.

**Request Body**:
```typescript
interface ValidateSlugRequest {
  slug: string
  locale?: string        // Default 'en'
  currentPageId?: string // Exclude this page from check (for edits)
}
```

**Example Request**:
```bash
POST /api/v1/pages/validate-slug
Content-Type: application/json

{
  "slug": "about-us",
  "locale": "en"
}
```

**Example Response**:
```json
{
  "valid": true,
  "available": false,
  "error": "Slug already exists",
  "suggestions": ["about-us-2", "about-company", "our-story"]
}
```

## Data Structures

### BlockInstance

```typescript
interface BlockInstance {
  id: string           // UUID for this instance
  blockSlug: string    // References block type (e.g., 'hero')
  props: Record<string, unknown>  // Block configuration
}
```

### PageSettings

```typescript
interface PageSettings {
  seo: {
    title?: string
    description?: string
    keywords?: string
    ogImage?: string
    noindex?: boolean
    nofollow?: boolean
  }
  customFields: Array<{
    key: string
    value: string
  }>
}
```

## Database Schema

```sql
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::JSONB,
  locale VARCHAR(10) NOT NULL DEFAULT 'en',

  -- SEO fields
  seo_title VARCHAR(255),
  seo_description TEXT,
  seo_keywords TEXT,
  og_image TEXT,
  noindex BOOLEAN DEFAULT FALSE,
  nofollow BOOLEAN DEFAULT FALSE,

  -- Meta
  published BOOLEAN DEFAULT FALSE,
  author_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_slug_locale UNIQUE(slug, locale),
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9\-]+$')
);
```

## Reserved Slugs

The following slugs cannot be used for pages as they conflict with system routes:

- `api`, `auth`, `dashboard`, `admin`
- `login`, `logout`, `signup`, `register`
- `settings`, `profile`, `account`
- Entity slugs (e.g., `products`, `users`)

See `core/lib/constants/reserved-slugs.ts` for the complete list.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable description",
  "details": [...]  // Optional: Zod validation errors
}
```

**Common Status Codes**:
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Usage Examples

### JavaScript/TypeScript

```typescript
// Create a page
const response = await fetch('/api/v1/pages', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slug: 'new-page',
    title: 'My New Page',
    blocks: [],
  }),
})
const page = await response.json()

// Update page blocks
await fetch(`/api/v1/pages/${page.id}`, {
  method: 'PATCH',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    blocks: [
      { id: 'block-1', blockSlug: 'hero', props: { title: 'Hello' } }
    ],
    published: true,
  }),
})

// List published pages
const listResponse = await fetch('/api/v1/pages?published=true', {
  credentials: 'include',
})
const { pages, pagination } = await listResponse.json()
```

### Using TanStack Query (React)

```typescript
// In your React component
const { data, isLoading } = useQuery({
  queryKey: ['pages', { published: true }],
  queryFn: async () => {
    const res = await fetch('/api/v1/pages?published=true', {
      credentials: 'include',
    })
    return res.json()
  },
})

const saveMutation = useMutation({
  mutationFn: async (data) => {
    const res = await fetch(`/api/v1/pages/${pageId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['pages'] })
  },
})
```

## Next Steps

1. **[Public Rendering](./07-public-rendering.md)** - How pages are displayed publicly
2. **[Block System](./03-block-system.md)** - Understanding blocks
3. **[User Guide](./08-user-guide.md)** - Creating pages in the editor

---

> **Security Note**: The API validates that users are authenticated for all operations. Entity authors are tracked via `userId` for audit purposes.

> **Builder Note**: The `blocks` field is only processed when the `x-builder-source` header is present. Direct API calls without this header cannot modify blocks.

**Last Updated**: 2025-12-17
**Version**: 1.2.0
**Status**: Stable
