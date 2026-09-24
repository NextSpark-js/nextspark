# Opportunities API

Manage sales opportunities in the pipeline. Opportunities track deals from initial contact through close, with pipeline stages, amounts, and probabilities.

## Overview

The Opportunities API allows you to create, read, update, and delete opportunity records. Opportunities represent potential sales deals and are linked to companies, contacts, and pipelines.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Opportunities
`GET /api/v1/opportunities`

Returns a paginated list of opportunities.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `status` (string, optional): Filter by status (open, won, lost, abandoned)
- `companyId` (string, optional): Filter by company
- `pipelineId` (string, optional): Filter by pipeline
- `search` (string, optional): Search by name
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "opp_abc123",
      "name": "Enterprise License Deal",
      "companyId": "company_xyz",
      "contactId": "contact_456",
      "pipelineId": "pipeline_001",
      "stageId": "stage_negotiation",
      "amount": 50000,
      "currency": "USD",
      "probability": 75,
      "expectedRevenue": 37500,
      "closeDate": "2024-03-15",
      "status": "open",
      "assignedTo": "user_789",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 28,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Opportunity
`GET /api/v1/opportunities/[id]`

Returns a single opportunity by ID.

### Create Opportunity
`POST /api/v1/opportunities`

Create a new opportunity record.

**Request Body:**
```json
{
  "name": "New Product Launch",
  "companyId": "company_xyz",
  "pipelineId": "pipeline_001",
  "stageId": "stage_discovery",
  "amount": 25000,
  "currency": "USD",
  "probability": 30,
  "closeDate": "2024-06-30",
  "type": "new_business"
}
```

### Update Opportunity
`PATCH /api/v1/opportunities/[id]`

Update an existing opportunity. Supports partial updates.

### Delete Opportunity
`DELETE /api/v1/opportunities/[id]`

Delete an opportunity record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | text | Yes | Opportunity name or title |
| companyId | relation | Yes | Company (→ companies) |
| contactId | relation | No | Primary contact (→ contacts) |
| pipelineId | relation | Yes | Pipeline (→ pipelines) |
| stageId | text | Yes | Current stage in pipeline |
| amount | number | Yes | Deal amount value |
| currency | select | No | Currency: USD, EUR, GBP, MXN, etc. |
| probability | number | No | Win probability percentage (0-100) |
| expectedRevenue | number | Auto | Calculated: amount × probability |
| closeDate | date | Yes | Expected or actual close date |
| type | select | No | Type: new_business, existing_business, renewal, upgrade, downgrade |
| source | select | No | Source: web, referral, cold_call, etc. |
| competitor | text | No | Main competitor for this deal |
| status | select | No | Status: open, won, lost, abandoned |
| lostReason | text | No | Reason if opportunity was lost |
| assignedTo | user | No | Sales rep assigned |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Relationships

| Relation | Entity | Description |
|----------|--------|-------------|
| companyId | companies | Company this opportunity is for |
| contactId | contacts | Primary contact for this deal |
| pipelineId | pipelines | Pipeline this opportunity is in |

## Features

- **Searchable**: name, competitor, lost reason
- **Sortable**: Most fields
- **Bulk Operations**: Supported
- **Import/Export**: Supported
- **Metadata**: Supported

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Opportunity doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Companies](/api/v1/companies)** - Associated company
- **[Contacts](/api/v1/contacts)** - Primary contact
- **[Pipelines](/api/v1/pipelines)** - Pipeline configuration
- **[Activities](/api/v1/activities)** - Related activities
- **[Notes](/api/v1/notes)** - Notes about this opportunity
