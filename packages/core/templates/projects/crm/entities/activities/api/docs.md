# Activities API

Manage tasks and activities related to CRM records. Activities track calls, emails, meetings, and other interactions with contacts, companies, and opportunities.

## Overview

The Activities API allows you to create, read, update, and delete activity records. Activities help teams track their interactions and tasks across all CRM entities.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Activities
`GET /api/v1/activities`

Returns a paginated list of activities.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `type` (string, optional): Filter by type (call, email, meeting, task, note, demo, presentation)
- `status` (string, optional): Filter by status (scheduled, in_progress, completed, cancelled, overdue)
- `contactId` (string, optional): Filter by contact
- `companyId` (string, optional): Filter by company
- `opportunityId` (string, optional): Filter by opportunity
- `search` (string, optional): Search by subject
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "activity_abc123",
      "type": "meeting",
      "subject": "Product Demo",
      "description": "Demo of new features",
      "status": "scheduled",
      "priority": "high",
      "dueDate": "2024-01-20T14:00:00Z",
      "duration": 60,
      "location": "Zoom",
      "contactId": "contact_456",
      "companyId": "company_xyz",
      "assignedTo": "user_789",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Activity
`GET /api/v1/activities/[id]`

Returns a single activity by ID.

### Create Activity
`POST /api/v1/activities`

Create a new activity record.

**Request Body:**
```json
{
  "type": "call",
  "subject": "Follow-up call",
  "description": "Discuss proposal",
  "status": "scheduled",
  "priority": "medium",
  "dueDate": "2024-01-22T10:00:00Z",
  "duration": 30,
  "contactId": "contact_456"
}
```

### Update Activity
`PATCH /api/v1/activities/[id]`

Update an existing activity. Supports partial updates.

### Delete Activity
`DELETE /api/v1/activities/[id]`

Delete an activity record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | select | Yes | Type: call, email, meeting, task, note, demo, presentation |
| subject | text | Yes | Activity subject or title |
| description | textarea | No | Detailed description |
| status | select | No | Status: scheduled, in_progress, completed, cancelled, overdue |
| priority | select | No | Priority: low, medium, high, urgent |
| dueDate | datetime | No | When activity is due |
| completedAt | datetime | Auto | When activity was completed |
| duration | number | No | Duration in minutes |
| outcome | textarea | No | Activity outcome or result |
| location | text | No | Location for meetings |
| contactId | relation | No | Related contact (→ contacts) |
| companyId | relation | No | Related company (→ companies) |
| opportunityId | relation | No | Related opportunity (→ opportunities) |
| assignedTo | user | No | User assigned |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Relationships

| Relation | Entity | Description |
|----------|--------|-------------|
| contactId | contacts | Related contact |
| companyId | companies | Related company |
| opportunityId | opportunities | Related opportunity |

## Features

- **Searchable**: subject, description, outcome, location
- **Sortable**: Most fields
- **Bulk Operations**: Supported
- **Metadata**: Supported

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Activity doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Contacts](/api/v1/contacts)** - Related contact
- **[Companies](/api/v1/companies)** - Related company
- **[Opportunities](/api/v1/opportunities)** - Related opportunity
