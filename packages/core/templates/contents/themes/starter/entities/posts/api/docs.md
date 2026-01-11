# Posts API

Manage blog posts with builder support and taxonomies. Posts render at /blog/[slug] and support categories, featured images, and excerpts.

## Overview

The Posts API allows you to create, read, update, and delete blog posts with builder content. Posts support the page builder for content creation and include taxonomy management for categories.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Posts
`GET /api/v1/posts`

Returns a paginated list of posts.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `status` (string, optional): Filter by status (draft, published, scheduled, archived)
- `search` (string, optional): Search term for title/excerpt
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "post_123",
      "title": "Getting Started with NextSpark",
      "slug": "getting-started",
      "status": "published",
      "excerpt": "Learn how to build amazing apps with NextSpark",
      "featuredImage": "/uploads/hero.jpg",
      "blocks": [...],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Post
`GET /api/v1/posts/[id]`

Returns a single post by ID.

**Path Parameters:**
- `id` (string, required): Post ID

### Create Post
`POST /api/v1/posts`

Create a new post record.

**Request Body:**
```json
{
  "title": "My New Blog Post",
  "slug": "my-new-blog-post",
  "status": "draft",
  "excerpt": "A brief introduction to my post",
  "blocks": []
}
```

### Update Post
`PATCH /api/v1/posts/[id]`

Update an existing post.

**Path Parameters:**
- `id` (string, required): Post ID

**Request Body:**
Any fields to update (partial update supported).

### Delete Post
`DELETE /api/v1/posts/[id]`

Delete a post record.

**Path Parameters:**
- `id` (string, required): Post ID

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | text | Yes | Post title |
| slug | text | Yes | URL-friendly identifier |
| status | select | Yes | draft, published, scheduled, archived |
| excerpt | textarea | No | Short summary of the post |
| featuredImage | image | No | Main image for the post |
| blocks | json | No | Page builder content |

## Taxonomies

Posts support the following taxonomies:
- **categories** (post_category): Multiple categories can be assigned

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Post doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Dynamic Entity API](/api/v1/{entity})** - Generic entity operations documentation
- **[Post Categories](/api/v1/post-categories)** - Manage blog post categories
- **[Blocks](/api/v1/blocks)** - Available page builder blocks
- **[Media](/api/v1/media)** - Upload featured images
