# Notes API

Manage notes and comments on CRM records. Notes can be linked to contacts, companies, and opportunities with support for pinning and privacy settings.

## Overview

The Notes API allows you to create, read, update, and delete note records. Notes provide a way to capture important information and comments about CRM entities.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Notes
`GET /api/v1/notes`

Returns a paginated list of notes.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `type` (string, optional): Filter by type (general, call, meeting, email, followup, feedback, reminder)
- `contactId` (string, optional): Filter by contact
- `companyId` (string, optional): Filter by company
- `opportunityId` (string, optional): Filter by opportunity
- `search` (string, optional): Search by title or content
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "note_abc123",
      "title": "Meeting Summary",
      "content": "Discussed product roadmap and next steps...",
      "type": "meeting",
      "isPinned": true,
      "isPrivate": false,
      "contactId": "contact_456",
      "companyId": "company_xyz",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 234,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Note
`GET /api/v1/notes/[id]`

Returns a single note by ID.

### Create Note
`POST /api/v1/notes`

Create a new note record.

**Request Body:**
```json
{
  "title": "Call Notes",
  "content": "Key points from the call...",
  "type": "call",
  "contactId": "contact_456",
  "isPinned": false,
  "isPrivate": false
}
```

### Update Note
`PATCH /api/v1/notes/[id]`

Update an existing note. Supports partial updates.

### Delete Note
`DELETE /api/v1/notes/[id]`

Delete a note record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | text | No | Note title (optional) |
| content | textarea | Yes | Note content |
| type | select | No | Type: general, call, meeting, email, followup, feedback, reminder |
| isPinned | boolean | No | Is note pinned/important |
| isPrivate | boolean | No | Is note private to creator |
| entityType | select | No | Related entity type: lead, contact, company, opportunity, campaign |
| entityId | text | No | ID of related entity |
| contactId | relation | No | Related contact (→ contacts) |
| companyId | relation | No | Related company (→ companies) |
| opportunityId | relation | No | Related opportunity (→ opportunities) |
| attachments | json | No | Array of attachment objects |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Relationships

| Relation | Entity | Description |
|----------|--------|-------------|
| contactId | contacts | Related contact |
| companyId | companies | Related company |
| opportunityId | opportunities | Related opportunity |

## Features

- **Searchable**: title, content
- **Sortable**: Most fields
- **Privacy**: Private notes only visible to creator

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Note doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Contacts](/api/v1/contacts)** - Related contact
- **[Companies](/api/v1/companies)** - Related company
- **[Opportunities](/api/v1/opportunities)** - Related opportunity
