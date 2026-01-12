# Tasks API

Manage tasks with status tracking, priorities, and metadata support. Tasks are team-scoped private entities.

## Overview

The Tasks API allows you to create, read, update, and delete task records. Tasks support status workflows, priority levels, due dates, and metadata. Each task belongs to a team and is filtered based on the authenticated user's team context.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Tasks
`GET /api/v1/tasks`

Returns a paginated list of tasks for the current team.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `status` (string, optional): Filter by status (todo, in-progress, review, done, blocked)
- `priority` (string, optional): Filter by priority (low, medium, high, urgent)
- `search` (string, optional): Search term for title/description
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "task_123",
      "title": "Implement new feature",
      "description": "Add user authentication flow",
      "status": "in-progress",
      "priority": "high",
      "dueDate": "2024-02-01",
      "estimatedHours": 8,
      "tags": ["feature", "auth"],
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

### Get Single Task
`GET /api/v1/tasks/[id]`

Returns a single task by ID.

**Path Parameters:**
- `id` (string, required): Task ID

### Create Task
`POST /api/v1/tasks`

Create a new task record.

**Request Body:**
```json
{
  "title": "New Task",
  "description": "Task details here",
  "status": "todo",
  "priority": "medium",
  "dueDate": "2024-02-15",
  "estimatedHours": 4,
  "tags": ["development"]
}
```

### Update Task
`PATCH /api/v1/tasks/[id]`

Update an existing task.

**Path Parameters:**
- `id` (string, required): Task ID

**Request Body:**
Any fields to update (partial update supported).

### Delete Task
`DELETE /api/v1/tasks/[id]`

Delete a task record.

**Path Parameters:**
- `id` (string, required): Task ID

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| title | text | Yes | - | Task title |
| description | textarea | No | - | Detailed description |
| status | select | No | todo | todo, in-progress, review, done, blocked |
| priority | select | No | medium | low, medium, high, urgent |
| tags | tags | No | [] | Task tags for categorization |
| dueDate | date | No | - | Task deadline |
| estimatedHours | number | No | - | Estimated time to complete |

## Metadata Support

Tasks support the metadata system. Use the metadata endpoints to store additional custom data:
- `POST /api/v1/tasks/[id]/meta` - Add metadata
- `GET /api/v1/tasks/[id]/meta` - Get metadata

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Task doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Dynamic Entity API](/api/v1/{entity})** - Generic entity operations documentation
- **[Teams](/api/v1/teams)** - Tasks are team-scoped
- **[Media](/api/v1/media)** - Upload attachments for tasks
