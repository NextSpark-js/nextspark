# Pipelines API

Manage sales pipelines with customizable stages. Pipelines define the workflow for tracking opportunities from initial contact to close.

## Overview

The Pipelines API allows you to create, read, update, and delete pipeline configurations. Pipelines contain stages that define the sales process and are used by opportunities to track progress.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Pipelines
`GET /api/v1/pipelines`

Returns a paginated list of pipelines.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `type` (string, optional): Filter by type (sales, support, project, custom)
- `isActive` (boolean, optional): Filter by active status
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "pipeline_abc123",
      "name": "Sales Pipeline",
      "description": "Main sales process",
      "type": "sales",
      "isDefault": true,
      "isActive": true,
      "stages": [
        {"id": "discovery", "name": "Discovery", "probability": 10, "order": 1},
        {"id": "proposal", "name": "Proposal", "probability": 30, "order": 2},
        {"id": "negotiation", "name": "Negotiation", "probability": 60, "order": 3},
        {"id": "closed", "name": "Closed Won", "probability": 100, "order": 4}
      ],
      "dealRottenDays": 30,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Pipeline
`GET /api/v1/pipelines/[id]`

Returns a single pipeline by ID.

### Create Pipeline
`POST /api/v1/pipelines`

Create a new pipeline configuration.

**Request Body:**
```json
{
  "name": "New Sales Pipeline",
  "description": "Custom sales process",
  "type": "sales",
  "isActive": true,
  "stages": [
    {"id": "lead", "name": "Lead", "probability": 5, "order": 1},
    {"id": "qualified", "name": "Qualified", "probability": 25, "order": 2},
    {"id": "demo", "name": "Demo", "probability": 50, "order": 3},
    {"id": "proposal", "name": "Proposal", "probability": 75, "order": 4},
    {"id": "won", "name": "Won", "probability": 100, "order": 5}
  ],
  "dealRottenDays": 14
}
```

### Update Pipeline
`PATCH /api/v1/pipelines/[id]`

Update an existing pipeline. Supports partial updates.

### Delete Pipeline
`DELETE /api/v1/pipelines/[id]`

Delete a pipeline configuration. Note: Cannot delete pipelines with active opportunities.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | text | Yes | Pipeline name |
| description | textarea | No | Pipeline description |
| type | select | No | Type: sales, support, project, custom |
| isDefault | boolean | No | Is this the default pipeline |
| isActive | boolean | No | Is pipeline currently active |
| stages | json | Yes | Array of stage objects |
| dealRottenDays | number | No | Days until deal is considered stale |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Stage Object Structure

Each stage in the `stages` array should have:

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique stage identifier |
| name | string | Display name |
| probability | number | Win probability percentage |
| order | number | Sort order |
| color | string | Optional hex color for UI |

## Features

- **Searchable**: name, description
- **Sortable**: name, type, isDefault, isActive

## Permissions

- **Create/Update/Delete**: Owner only

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions (owner only) |
| 404 | Not Found - Pipeline doesn't exist |
| 409 | Conflict - Cannot delete pipeline with active opportunities |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Opportunities](/api/v1/opportunities)** - Deals using this pipeline
