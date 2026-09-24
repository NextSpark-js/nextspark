# Pages API

Manage builder-enabled pages in the system. Pages render at root URLs (e.g., /about, /contact) and support the page builder for content creation.

## Overview

The Pages API allows you to create, read, update, and delete pages with builder content. Pages are public content and can be accessed by all authenticated users.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Pages
`GET /api/v1/pages`

Returns a paginated list of pages.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `status` (string, optional): Filter by status (draft, published, scheduled, archived)
- `locale` (string, optional): Filter by locale (en, es)
- `search` (string, optional): Search term for title/slug
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "page_123",
      "title": "About Us",
      "slug": "about",
      "status": "published",
      "locale": "en",
      "blocks": [...],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Page
`GET /api/v1/pages/[id]`

Returns a single page by ID.

**Path Parameters:**
- `id` (string, required): Page ID

### Create Page
`POST /api/v1/pages`

Create a new page record.

**Request Body:**
```json
{
  "title": "Contact Us",
  "slug": "contact",
  "status": "draft",
  "locale": "en",
  "blocks": []
}
```

### Update Page
`PATCH /api/v1/pages/[id]`

Update an existing page.

**Path Parameters:**
- `id` (string, required): Page ID

**Request Body:**
Any fields to update (partial update supported).

### Delete Page
`DELETE /api/v1/pages/[id]`

Delete a page record.

**Path Parameters:**
- `id` (string, required): Page ID

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | text | Yes | Page title |
| slug | text | Yes | URL-friendly identifier |
| status | select | Yes | draft, published, scheduled, archived |
| locale | select | Yes | en, es |
| blocks | json | No | Page builder content |

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Page doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Dynamic Entity API](/api/v1/{entity})** - Generic entity operations documentation
- **[Blocks](/api/v1/blocks)** - Available page builder blocks
- **[Media](/api/v1/media)** - Upload images for pages
