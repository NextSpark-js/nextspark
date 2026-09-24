# Leads API

Manage prospective customers before conversion. Leads are team-shared and support full CRUD operations with import/export.

## Overview

The Leads API allows you to create, read, update, and delete lead records. Leads represent potential customers in the early stages of the sales funnel before they become contacts or opportunities.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Leads
`GET /api/v1/leads`

Returns a paginated list of leads.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `status` (string, optional): Filter by status (new, contacted, qualified, proposal, negotiation, converted, lost)
- `source` (string, optional): Filter by lead source
- `search` (string, optional): Search term for company name, contact name, email
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "lead_abc123",
      "companyName": "Acme Corp",
      "contactName": "John Smith",
      "email": "john@acme.com",
      "phone": "+1-555-0100",
      "source": "web",
      "status": "qualified",
      "score": 75,
      "industry": "Technology",
      "assignedTo": "user_456",
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

### Get Single Lead
`GET /api/v1/leads/[id]`

Returns a single lead by ID.

### Create Lead
`POST /api/v1/leads`

Create a new lead record.

**Request Body:**
```json
{
  "companyName": "New Prospect Inc",
  "contactName": "Jane Doe",
  "email": "jane@newprospect.com",
  "phone": "+1-555-0200",
  "source": "referral",
  "status": "new",
  "industry": "Healthcare",
  "companySize": "51-200"
}
```

### Update Lead
`PATCH /api/v1/leads/[id]`

Update an existing lead. Supports partial updates.

### Delete Lead
`DELETE /api/v1/leads/[id]`

Delete a lead record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyName | text | Yes | Name of the prospect company |
| contactName | text | Yes | Name of the contact person |
| email | email | Yes | Email address |
| phone | text | No | Phone number |
| website | url | No | Company website |
| source | select | No | Lead source: web, referral, cold_call, trade_show, social_media, email, advertising, partner, other |
| status | select | No | Status: new, contacted, qualified, proposal, negotiation, converted, lost |
| score | number | No | Lead score (0-100) |
| industry | text | No | Industry sector |
| companySize | select | No | Company size: 1-10, 11-50, 51-200, 201-500, 500+ |
| budget | number | No | Estimated budget amount |
| assignedTo | user | No | Sales rep assigned |
| notes | textarea | No | Internal notes |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Features

- **Searchable**: company name, contact name, email, industry, notes
- **Sortable**: All fields except notes
- **Bulk Operations**: Supported
- **Import/Export**: Supported

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Lead doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Contacts](/api/v1/contacts)** - Convert leads to contacts
- **[Companies](/api/v1/companies)** - Company records
- **[Opportunities](/api/v1/opportunities)** - Sales opportunities
