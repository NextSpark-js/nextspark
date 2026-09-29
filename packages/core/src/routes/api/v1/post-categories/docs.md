# Post Categories API

Manage blog post categories (taxonomies).

## Overview

The Post Categories API provides endpoints for managing blog post categories. Categories are stored in the `taxonomies` table with type `post_category`. Supports hierarchical categories with parent-child relationships.

## Authentication

- **GET** endpoints are public (no authentication required)
- **POST/PATCH/DELETE** endpoints require authentication via session cookie or API key

## Endpoints

### List Categories
`GET /api/v1/post-categories`

Returns all active post categories ordered by sort order and name.

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_123",
      "name": "Technology",
      "slug": "technology",
      "description": "Tech news and tutorials",
      "icon": "Cpu",
      "color": "#3b82f6",
      "parentId": null,
      "order": 1,
      "isDefault": false,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Create Category
`POST /api/v1/post-categories`

Create a new post category.

**Request Body:**
```json
{
  "name": "Technology",
  "slug": "technology",
  "description": "Tech news and tutorials",
  "icon": "Cpu",
  "color": "#3b82f6",
  "parentId": null,
  "order": 1,
  "isDefault": false
}
```

**Parameters:**
- `name` (string, required): Category display name (1-255 chars)
- `slug` (string, optional): URL-friendly identifier (auto-generated if not provided)
- `description` (string, optional): Category description
- `icon` (string, optional): Lucide icon name
- `color` (string, optional): Hex color code
- `parentId` (string, optional): Parent category ID for hierarchical categories
- `order` (number, optional): Sort order (default: 0)
- `isDefault` (boolean, optional): Mark as default category (default: false)

**Slug Rules:**
- Lowercase alphanumeric with dashes only
- 2-100 characters
- Pattern: `^[a-z0-9-]+$`
- Must be unique within post categories

### Get Category
`GET /api/v1/post-categories/[id]`

Returns a single category by ID.

**Path Parameters:**
- `id` (string, required): Category ID

### Update Category
`PATCH /api/v1/post-categories/[id]`

Update an existing category. Partial updates supported.

**Path Parameters:**
- `id` (string, required): Category ID

**Request Body:**
Any fields from the create schema (partial update).

### Delete Category
`DELETE /api/v1/post-categories/[id]`

Soft delete a category (sets `deletedAt`).

**Path Parameters:**
- `id` (string, required): Category ID

## Hierarchical Categories

Categories support parent-child relationships:

```json
{
  "name": "JavaScript",
  "slug": "javascript",
  "parentId": "cat_technology"
}
```

When listing categories, use `parentId` to build tree structures client-side.

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Validation error or slug already exists |
| 401 | Unauthorized - Authentication required for write operations |
| 404 | Not Found - Category or parent category not found |
| 500 | Server Error - Internal error |

## Usage Notes

- Categories are stored in the `taxonomies` table with `type = 'post_category'`
- Only active categories (`isActive = true`, `deletedAt IS NULL`) are returned
- Slugs are auto-generated from name if not provided
- The `order` field controls sort order in listings
