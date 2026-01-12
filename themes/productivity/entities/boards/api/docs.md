# Boards API

Manage Trello-style boards for organizing lists and cards.

## Overview

The Boards API allows you to create, read, update, and archive board records. Boards are the top-level containers for organizing lists and cards in a Kanban-style workflow.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Boards
`GET /api/v1/boards`

Returns a paginated list of boards.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `archived` (boolean, optional): Filter by archived status
- `search` (string, optional): Search by name, description
- `sortBy` (string, optional): Field to sort by. Default: position
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "board_abc123",
      "name": "Product Development",
      "description": "Main product roadmap and feature tracking",
      "color": "blue",
      "archived": false,
      "position": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Board
`GET /api/v1/boards/[id]`

Returns a single board by ID.

### Create Board
`POST /api/v1/boards`

Create a new board.

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Board for tracking new project tasks",
  "color": "purple"
}
```

### Update Board
`PATCH /api/v1/boards/[id]`

Update an existing board. Supports partial updates.

### Archive Board
`PATCH /api/v1/boards/[id]`

Archive a board (soft delete).

**Request Body:**
```json
{
  "archived": true
}
```

### Delete Board
`DELETE /api/v1/boards/[id]`

Permanently delete a board. This will also delete all associated lists and cards.

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| name | text | Yes | - | Board name |
| description | textarea | No | - | Board description |
| color | select | No | blue | Background color (blue, green, purple, orange, red, pink, gray) |
| archived | boolean | No | false | Whether board is archived |
| position | number | No | 0 | Display order |
| createdAt | datetime | Auto | - | Creation timestamp |
| updatedAt | datetime | Auto | - | Last update timestamp |

## Features

- **Searchable**: name, description
- **Sortable**: name, position, createdAt
- **Shared Access**: Boards are shared within the team
- **Soft Delete**: Use archive instead of permanent delete

## Permissions

- **Create/Update**: Owner, Admin
- **Delete**: Owner only

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Board doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Lists](/api/v1/lists)** - Lists within boards
- **[Cards](/api/v1/cards)** - Cards within lists
