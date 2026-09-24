# Posts API

Manage blog posts with content builder, featured images, categories, and publication workflow.

## Overview

The Posts API allows you to create, read, update, and delete blog posts. Posts support a flexible content builder system, category organization, and a draft-to-published workflow.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

**Note:** For public access to published posts, use the [Public Posts API](/api/v1/theme/blog/posts/public) instead.

## Endpoints

### List Posts
`GET /api/v1/posts`

Returns a paginated list of posts.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `status` (string, optional): Filter by status (draft, published)
- `featured` (boolean, optional): Filter by featured flag
- `search` (string, optional): Search by title, excerpt, content
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "post_abc123",
      "title": "Getting Started with Next.js",
      "slug": "getting-started-with-nextjs",
      "excerpt": "A comprehensive guide to building modern web apps",
      "content": "[{\"type\":\"text\",\"content\":\"...\"}]",
      "featuredImage": "https://example.com/image.jpg",
      "featured": true,
      "status": "published",
      "publishedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-10T08:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Post
`GET /api/v1/posts/[id]`

Returns a single post by ID.

### Create Post
`POST /api/v1/posts`

Create a new blog post.

**Request Body:**
```json
{
  "title": "My New Post",
  "slug": "my-new-post",
  "excerpt": "A brief description of the post",
  "content": "[{\"type\":\"text\",\"content\":\"Post content here\"}]",
  "featuredImage": "https://example.com/image.jpg",
  "featured": false,
  "status": "draft"
}
```

### Update Post
`PATCH /api/v1/posts/[id]`

Update an existing post. Supports partial updates.

### Publish Post
`PATCH /api/v1/posts/[id]`

Publish a draft post by setting status and publishedAt.

**Request Body:**
```json
{
  "status": "published",
  "publishedAt": "2024-01-15T10:30:00Z"
}
```

### Delete Post
`DELETE /api/v1/posts/[id]`

Delete a post record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | text | Yes | Post title |
| slug | text | Yes | URL-friendly slug (auto-generated if not provided) |
| excerpt | text | No | Brief description for previews |
| content | json | No | Page builder content blocks |
| featuredImage | url | No | Featured image URL |
| featured | boolean | No | Whether post is featured. Default: false |
| status | select | No | Status: draft, published. Default: draft |
| publishedAt | datetime | No | Publication date/time |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Content Builder

Posts use a flexible content builder system. The `content` field stores an array of content blocks in JSON format:

```json
[
  {
    "type": "text",
    "content": "Paragraph content here..."
  },
  {
    "type": "heading",
    "level": 2,
    "content": "Section Title"
  },
  {
    "type": "image",
    "src": "https://example.com/image.jpg",
    "alt": "Image description"
  }
]
```

## Categories

Posts can be organized into categories using a many-to-many relationship. Categories are managed via the `/api/v1/categories` endpoint and linked to posts through a pivot table.

To filter posts by category, use the Public Posts API with the `category` query parameter.

## Features

- **Searchable**: title, excerpt, content
- **Sortable**: Most fields
- **Public Access**: Published posts available via public API
- **Metadata**: Supported

## Permissions

- **Create/Update/Delete**: Owner only (single-user blog mode)

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Post doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Categories](/api/v1/categories)** - Post categorization
- **[Public Posts](/api/v1/theme/blog/posts/public)** - Public feed (no auth required)
- **[Authors](/api/v1/theme/blog/authors)** - Author profiles
