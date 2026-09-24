# Lists API

Manage columns within boards (To Do, In Progress, Done, etc.).

## Overview

The Lists API allows you to create, read, update, and delete list records. Lists are the columns within a board that organize cards in a Kanban workflow.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Lists
`GET /api/v1/lists`

Returns a paginated list of lists.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `boardId` (string, optional): Filter by parent board
- `search` (string, optional): Search by name
- `sortBy` (string, optional): Field to sort by. Default: position
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "list_abc123",
      "name": "To Do",
      "position": 1,
      "boardId": "board_xyz789",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "list_def456",
      "name": "In Progress",
      "position": 2,
      "boardId": "board_xyz789",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "list_ghi789",
      "name": "Done",
      "position": 3,
      "boardId": "board_xyz789",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single List
`GET /api/v1/lists/[id]`

Returns a single list by ID.

### Create List
`POST /api/v1/lists`

Create a new list.

**Request Body:**
```json
{
  "name": "Review",
  "boardId": "board_xyz789",
  "position": 4
}
```

### Update List
`PATCH /api/v1/lists/[id]`

Update an existing list. Supports partial updates.

### Reorder Lists
`PATCH /api/v1/lists/[id]`

Update list position for drag & drop reordering.

**Request Body:**
```json
{
  "position": 2
}
```

### Delete List
`DELETE /api/v1/lists/[id]`

Delete a list. This will also delete all cards within the list.

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| name | text | Yes | - | List name |
| position | number | No | 0 | Display order within board |
| boardId | reference | Yes | - | Parent board ID |
| createdAt | datetime | Auto | - | Creation timestamp |
| updatedAt | datetime | Auto | - | Last update timestamp |

## Features

- **Searchable**: name
- **Sortable**: name, position, createdAt
- **Drag & Drop**: Update position for reordering
- **Cascade Delete**: Deleting a list removes all its cards

## Permissions

- **Create/Update/Delete**: Owner, Admin, Member
- **Delete**: Owner, Admin

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - List or Board doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Boards](/api/v1/boards)** - Parent boards
- **[Cards](/api/v1/cards)** - Cards within lists
