# Authors API

Public author profiles and post listings. No authentication required.

## Overview

The Authors API provides read-only access to author profiles and their published posts. This endpoint is designed for public consumption and does not require authentication.

## Authentication

**No authentication required** - This is a public endpoint.

## Endpoints

### List Authors
`GET /api/v1/theme/blog/authors`

Returns a list of all authors who have published posts.

**Example Request:**
```bash
curl https://example.com/api/v1/theme/blog/authors
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "user_abc123",
      "name": "John Doe",
      "username": "johndoe",
      "bio": "Full-stack developer and tech writer",
      "image": "https://example.com/avatar.jpg",
      "postCount": 15
    },
    {
      "id": "user_def456",
      "name": "Jane Smith",
      "username": "janesmith",
      "bio": "Product designer and UX enthusiast",
      "image": "https://example.com/avatar2.jpg",
      "postCount": 8
    }
  ]
}
```

### Get Author Profile
`GET /api/v1/theme/blog/authors/[username]`

Returns an author's profile with their published posts.

**Path Parameters:**
- `username` (string, required): Author's username

**Example Request:**
```bash
curl https://example.com/api/v1/theme/blog/authors/johndoe
```

**Example Response:**
```json
{
  "author": {
    "id": "user_abc123",
    "name": "John Doe",
    "username": "johndoe",
    "bio": "Full-stack developer and tech writer",
    "image": "https://example.com/avatar.jpg"
  },
  "posts": [
    {
      "id": "post_123",
      "title": "Getting Started with Next.js",
      "slug": "getting-started-with-nextjs",
      "excerpt": "A comprehensive guide...",
      "featuredImage": "https://example.com/image.jpg",
      "publishedAt": "2024-01-15T10:30:00Z",
      "categories": [
        {
          "id": "cat_123",
          "name": "Technology",
          "slug": "technology"
        }
      ]
    }
  ],
  "stats": {
    "totalPosts": 15
  }
}
```

## Response Fields

### Author Object

| Field | Type | Description |
|-------|------|-------------|
| id | string | Author user ID |
| name | string | Author display name |
| username | string | Author username (URL-friendly) |
| bio | string | Author biography |
| image | string | Author avatar URL |
| postCount | number | Number of published posts (list endpoint only) |

### Author Profile Response

| Field | Type | Description |
|-------|------|-------------|
| author | object | Author profile information |
| posts | array | Array of published posts |
| stats.totalPosts | number | Total number of published posts |

## Features

- **No Auth Required**: Accessible without authentication
- **Rate Limited**: 100 requests per minute per IP
- **Cached**: Responses cached for 60 seconds
- **Sorted by Post Count**: Authors with more posts appear first

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Author not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Related APIs

- **[Public Posts](/api/v1/theme/blog/posts/public)** - Public post feed
- **[Posts](/api/v1/posts)** - Authenticated CRUD operations
