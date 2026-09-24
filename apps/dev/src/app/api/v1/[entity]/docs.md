# Dynamic Entity API

Generic CRUD endpoints for all registered entities. These routes dynamically handle any entity configured in the system.

## Overview

The Dynamic Entity API provides a unified interface for managing all registered entities in the system. Instead of creating separate API routes for each entity type, this single dynamic route handles all CRUD operations based on the entity configuration.

When you access `/api/v1/products`, `/api/v1/tasks`, `/api/v1/orders`, etc., you're using this dynamic routing system that reads the entity configuration and handles the request accordingly.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

The entity's `access` configuration determines visibility rules (public, shared, etc.).

## Entity Resolution

URLs are resolved using the entity's `tableName` (typically plural). For example:
- `/api/v1/products` → resolves to `product` entity
- `/api/v1/tasks` → resolves to `task` entity
- `/api/v1/team-members` → resolves to `teamMember` entity

## Endpoints

### List Entities
`GET /api/v1/{entity}`

Returns a paginated list of entities.

**URL Examples:**
```
GET /api/v1/tasks       # List tasks
GET /api/v1/products    # List products
GET /api/v1/orders      # List orders
```

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `search` (string, optional): Search term (searches searchable fields)
- `sortBy` (string, optional): Field to sort by (must be sortable)
- `sortOrder` (string, optional): Sort direction - "asc" or "desc"
- `{fieldName}` (any, optional): Filter by any filterable field

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "title": "Example item",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0
  },
  "info": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Filtering Examples:**
```
GET /api/v1/tasks?status=todo
GET /api/v1/products?category=electronics&inStock=true
GET /api/v1/orders?search=john&sortBy=createdAt&sortOrder=desc
```

### Create Entity
`POST /api/v1/{entity}`

Create a new entity record.

**URL Examples:**
```
POST /api/v1/tasks      # Create task
POST /api/v1/products   # Create product
POST /api/v1/orders     # Create order
```

**Request Body:**
The request body must include all required fields defined in the entity configuration.

```json
{
  "title": "New item",
  "description": "Item details",
  "status": "draft"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "new123",
    "title": "New item",
    "description": "Item details",
    "status": "draft",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "info": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Validation:**
- Required fields must be provided
- Field values are validated against the entity schema
- Unique constraints are enforced (e.g., slugs)

---

## Single Entity Endpoints

### Get Entity by ID
`GET /api/v1/{entity}/{id}`

Returns a single entity by its ID.

**URL Examples:**
```
GET /api/v1/tasks/abc123       # Get task by ID
GET /api/v1/products/prod456   # Get product by ID
```

**Path Parameters:**
- `id` (string, required): Entity ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "Example item",
    "description": "Full details",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-16T14:20:00Z"
  },
  "info": {
    "timestamp": "2024-01-16T14:20:00Z"
  }
}
```

### Update Entity
`PATCH /api/v1/{entity}/{id}`

Update an existing entity. Supports partial updates.

**URL Examples:**
```
PATCH /api/v1/tasks/abc123     # Update task
PATCH /api/v1/products/prod456 # Update product
```

**Path Parameters:**
- `id` (string, required): Entity ID

**Request Body (partial update):**
```json
{
  "status": "completed",
  "notes": "Updated notes"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "Example item",
    "status": "completed",
    "notes": "Updated notes",
    "updatedAt": "2024-01-16T14:25:00Z"
  },
  "info": {
    "timestamp": "2024-01-16T14:25:00Z"
  }
}
```

### Delete Entity
`DELETE /api/v1/{entity}/{id}`

Delete an entity record.

**URL Examples:**
```
DELETE /api/v1/tasks/abc123      # Delete task
DELETE /api/v1/products/prod456  # Delete product
```

**Path Parameters:**
- `id` (string, required): Entity ID

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "abc123"
  },
  "info": {
    "timestamp": "2024-01-16T14:30:00Z"
  }
}
```

---

## Child Entity Endpoints

For entities with child relationships (e.g., order items under orders):

### List Child Entities
`GET /api/v1/{entity}/{id}/child/{childType}`

Returns child entities for a parent entity.

**URL Examples:**
```
GET /api/v1/orders/ord123/child/order-items     # List order items
GET /api/v1/customers/cust456/child/contacts    # List customer contacts
```

**Path Parameters:**
- `id` (string, required): Parent entity ID
- `childType` (string, required): Child entity type name

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "item1",
      "parentId": "ord123",
      "productId": "prod456",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "info": {
    "timestamp": "2024-01-16T14:30:00Z"
  }
}
```

### Create Child Entity
`POST /api/v1/{entity}/{id}/child/{childType}`

Create a child entity under a parent.

**URL Examples:**
```
POST /api/v1/orders/ord123/child/order-items    # Create order item
POST /api/v1/customers/cust456/child/contacts   # Create contact
```

**Request Body:**
```json
{
  "productId": "prod789",
  "quantity": 3,
  "price": 19.99
}
```

**Note:** The `parentId` is automatically set from the URL parameter.

### Single Child Entity Operations
`GET/PATCH/DELETE /api/v1/{entity}/{id}/child/{childType}/{childId}`

Manage individual child entities.

**URL Examples:**
```
GET    /api/v1/orders/ord123/child/order-items/item1   # Get item
PATCH  /api/v1/orders/ord123/child/order-items/item1   # Update item
DELETE /api/v1/orders/ord123/child/order-items/item1   # Delete item
```

---

## Entity Configuration Properties

Each entity's behavior is controlled by its configuration:

| Property | Description |
|----------|-------------|
| `access.public` | Whether non-authenticated users can read |
| `access.shared` | Whether all team members can see all records |
| `access.api` | Whether entity has API endpoints |
| `access.metadata` | Whether entity supports metadata system |
| `ui.features.searchable` | Whether search is enabled |
| `ui.features.sortable` | Whether sorting is enabled |
| `ui.features.filterable` | Whether filtering is enabled |

## Field Types

Entities support various field types:

| Type | Description |
|------|-------------|
| `text` | Single-line text input |
| `textarea` | Multi-line text |
| `richtext` | Rich text editor (HTML) |
| `number` | Numeric values |
| `select` | Single selection from options |
| `multiselect` | Multiple selections |
| `checkbox` | Boolean toggle |
| `date` | Date picker |
| `datetime` | Date and time picker |
| `image` | Image upload/URL |
| `relation` | Reference to another entity |
| `relation-multi` | Multiple references |
| `json` | JSON data |
| `tags` | Tag array |

## Row Level Security (RLS)

All entity queries respect PostgreSQL Row Level Security:
- Team-scoped entities filter by the user's active team
- Shared entities allow read access to all team members
- Private entities filter by `createdBy` user
- Superadmin/developer roles can bypass RLS for management

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters or validation error |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions or RLS violation |
| 404 | Not Found - Entity type or record not found |
| 409 | Conflict - Duplicate key or constraint violation |
| 422 | Validation Error - Invalid field values |
| 500 | Server Error - Internal error |

## Related APIs

- **[API Keys](/api/v1/api-keys)** - Manage API keys for authentication
- **[Teams](/api/v1/teams)** - Team management and member access
- **[Media](/api/v1/media)** - File uploads for entity fields
- **[Blocks](/api/v1/blocks)** - Page builder blocks for builder-enabled entities

## See Also

For entity-specific documentation with field details, see the individual entity docs:
- Tasks: `/api/v1/tasks` (entity-specific docs)
- Pages: `/api/v1/pages` (entity-specific docs)
- Posts: `/api/v1/posts` (entity-specific docs)
