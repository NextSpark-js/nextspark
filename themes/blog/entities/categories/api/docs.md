# Categories API

Manage blog categories for organizing and filtering posts.

## Overview

The Categories API allows you to create, read, update, and delete category records. Categories provide a hierarchical organization system for blog posts through a many-to-many relationship.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Categories
`GET /api/v1/categories`

Returns a paginated list of categories.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `search` (string, optional): Search by name, description
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "category_abc123",
      "name": "Technology",
      "slug": "technology",
      "description": "Posts about tech and software development",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Category
`GET /api/v1/categories/[id]`

Returns a single category by ID.

### Create Category
`POST /api/v1/categories`

Create a new category.

**Request Body:**
```json
{
  "name": "Technology",
  "slug": "technology",
  "description": "Posts about tech and software development"
}
```

### Update Category
`PATCH /api/v1/categories/[id]`

Update an existing category. Supports partial updates.

### Delete Category
`DELETE /api/v1/categories/[id]`

Delete a category record. This will remove the category from all associated posts.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | text | Yes | Category name |
| slug | text | Yes | URL-friendly slug (auto-generated if not provided) |
| description | textarea | No | Category description |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Post-Category Relationship

Categories are linked to posts through a `post_categories` pivot table. When filtering posts by category:

1. Use the [Public Posts API](/api/v1/theme/blog/posts/public) with `category` query parameter
2. Query the pivot table directly for advanced filtering

## Features

- **Searchable**: name, description
- **Sortable**: All fields
- **Metadata**: Supported

## Permissions

- **Create/Update/Delete**: Owner only

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Category doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Posts](/api/v1/posts)** - Blog posts
- **[Public Posts](/api/v1/theme/blog/posts/public)** - Filter by category
