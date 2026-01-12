# Cards API

Manage task cards within lists (the main work items).

## Overview

The Cards API allows you to create, read, update, and delete card records. Cards are the individual task items that can be dragged between lists within a board.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Cards
`GET /api/v1/cards`

Returns a paginated list of cards.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `listId` (string, optional): Filter by parent list
- `boardId` (string, optional): Filter by parent board
- `priority` (string, optional): Filter by priority (low, medium, high, urgent)
- `assigneeId` (string, optional): Filter by assigned user
- `search` (string, optional): Search by title, description
- `sortBy` (string, optional): Field to sort by. Default: position
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "card_abc123",
      "title": "Implement user authentication",
      "description": "Add login and registration functionality",
      "position": 1,
      "dueDate": "2024-02-01",
      "priority": "high",
      "labels": ["feature", "urgent"],
      "assigneeId": "user_456",
      "listId": "list_xyz",
      "boardId": "board_abc",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Card
`GET /api/v1/cards/[id]`

Returns a single card by ID.

### Create Card
`POST /api/v1/cards`

Create a new card.

**Request Body:**
```json
{
  "title": "New Feature Request",
  "description": "Detailed description of the feature",
  "listId": "list_xyz789",
  "boardId": "board_abc123",
  "priority": "medium",
  "dueDate": "2024-02-15",
  "assigneeId": "user_456"
}
```

### Update Card
`PATCH /api/v1/cards/[id]`

Update an existing card. Supports partial updates.

### Move Card
`PATCH /api/v1/cards/[id]`

Move a card to a different list (drag & drop).

**Request Body:**
```json
{
  "listId": "list_newlist",
  "position": 3
}
```

### Delete Card
`DELETE /api/v1/cards/[id]`

Delete a card.

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| title | text | Yes | - | Card title |
| description | textarea | No | - | Detailed description |
| position | number | No | 0 | Display order within list |
| dueDate | date | No | - | Due date |
| priority | select | No | - | Priority: low, medium, high, urgent |
| labels | multiselect | No | - | Labels: urgent, important, bug, feature, enhancement, documentation |
| assigneeId | reference | No | - | Assigned user ID |
| listId | reference | Yes | - | Parent list ID |
| boardId | reference | Yes | - | Parent board ID |
| createdAt | datetime | Auto | - | Creation timestamp |
| updatedAt | datetime | Auto | - | Last update timestamp |

## Labels

Cards can have multiple labels for categorization:

| Label | Description |
|-------|-------------|
| urgent | Needs immediate attention |
| important | High importance |
| bug | Bug fix needed |
| feature | New feature |
| enhancement | Improvement to existing feature |
| documentation | Documentation work |

## Features

- **Searchable**: title, description
- **Sortable**: title, position, dueDate, priority, createdAt
- **Filterable**: priority, labels
- **Drag & Drop**: Move between lists
- **Bulk Operations**: Supported
- **Shared Access**: Cards are shared within the team

## Permissions

- **Create/Update/Move**: Owner, Admin, Member
- **Delete**: Owner, Admin

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Card, List, or Board doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Boards](/api/v1/boards)** - Parent boards
- **[Lists](/api/v1/lists)** - Parent lists
