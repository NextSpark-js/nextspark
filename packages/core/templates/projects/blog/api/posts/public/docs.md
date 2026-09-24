# Public Posts API

Public feed of published blog posts. No authentication required.

## Overview

The Public Posts API provides read-only access to published blog posts. This endpoint is designed for public consumption by blog visitors and does not require authentication.

## Authentication

**No authentication required** - This is a public endpoint.

## Endpoints

### List Published Posts
`GET /api/v1/theme/blog/posts/public`

Returns a paginated list of published posts.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20, Max: 100
- `offset` (number, optional): Number of records to skip. Default: 0
- `category` (string, optional): Filter by category slug

**Example Request:**
```bash
curl https://example.com/api/v1/theme/blog/posts/public?limit=10&category=technology
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "post_abc123",
      "title": "Getting Started with Next.js",
      "slug": "getting-started-with-nextjs",
      "excerpt": "A comprehensive guide to building modern web apps",
      "featuredImage": "https://example.com/image.jpg",
      "featured": true,
      "publishedAt": "2024-01-15T10:30:00Z",
      "author": {
        "id": "user_123",
        "name": "John Doe",
        "username": "johndoe",
        "image": "https://example.com/avatar.jpg"
      },
      "categories": [
        {
          "id": "cat_123",
          "name": "Technology",
          "slug": "technology"
        }
      ]
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | Post unique identifier |
| title | string | Post title |
| slug | string | URL-friendly slug |
| excerpt | string | Brief description |
| featuredImage | string | Featured image URL |
| featured | boolean | Whether post is featured |
| publishedAt | datetime | Publication timestamp |
| author | object | Author information |
| author.id | string | Author user ID |
| author.name | string | Author display name |
| author.username | string | Author username |
| author.image | string | Author avatar URL |
| categories | array | Associated categories |

## Features

- **No Auth Required**: Accessible without authentication
- **Rate Limited**: 100 requests per minute per IP
- **Cached**: Responses cached for 60 seconds
- **Category Filter**: Filter posts by category slug

## Pagination

The API uses offset-based pagination:

```json
{
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

To get the next page:
```
GET /api/v1/theme/blog/posts/public?offset=20&limit=20
```

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid query parameters |
| 404 | Not Found - Category not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Related APIs

- **[Posts](/api/v1/posts)** - Authenticated CRUD operations
- **[Authors](/api/v1/theme/blog/authors)** - Author profiles
- **[Categories](/api/v1/categories)** - Category management
