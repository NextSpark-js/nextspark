# Companies API

Manage customer and prospect companies. Companies serve as the central entity linking contacts, opportunities, and activities.

## Overview

The Companies API allows you to create, read, update, and delete company records. Companies represent organizations that your team works with and can be categorized by type (prospect, customer, partner, etc.).

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Companies
`GET /api/v1/companies`

Returns a paginated list of companies.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `type` (string, optional): Filter by type (prospect, customer, partner, competitor, vendor, other)
- `rating` (string, optional): Filter by rating (hot, warm, cold)
- `search` (string, optional): Search by name, email, industry
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "company_abc123",
      "name": "Acme Corporation",
      "legalName": "Acme Corp Inc.",
      "website": "https://acme.com",
      "email": "info@acme.com",
      "phone": "+1-555-0100",
      "industry": "Technology",
      "type": "customer",
      "size": "201-500",
      "rating": "hot",
      "country": "US",
      "assignedTo": "user_456",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 89,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Company
`GET /api/v1/companies/[id]`

Returns a single company by ID.

### Create Company
`POST /api/v1/companies`

Create a new company record.

**Request Body:**
```json
{
  "name": "New Tech Inc",
  "email": "info@newtech.com",
  "website": "https://newtech.com",
  "industry": "Software",
  "type": "prospect",
  "size": "51-200"
}
```

### Update Company
`PATCH /api/v1/companies/[id]`

Update an existing company. Supports partial updates.

### Delete Company
`DELETE /api/v1/companies/[id]`

Delete a company record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | text | Yes | Company display name |
| legalName | text | No | Legal registered name |
| taxId | text | No | Tax identification number |
| website | url | No | Company website URL |
| email | email | No | General company email |
| phone | text | No | Main phone number |
| industry | text | No | Industry sector |
| type | select | No | Type: prospect, customer, partner, competitor, vendor, other |
| size | select | No | Size: 1-10, 11-50, 51-200, 201-500, 500+ |
| annualRevenue | number | No | Annual revenue |
| address | textarea | No | Street address |
| city | text | No | City |
| state | text | No | State or province |
| country | text | No | Country |
| postalCode | text | No | Postal or ZIP code |
| logo | url | No | Company logo URL |
| rating | select | No | Sales rating: hot, warm, cold |
| assignedTo | user | No | Account manager assigned |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Features

- **Searchable**: name, legal name, tax ID, email, phone, industry, address, city, state, country, postal code
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
| 404 | Not Found - Company doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Contacts](/api/v1/contacts)** - People at this company
- **[Opportunities](/api/v1/opportunities)** - Sales opportunities
- **[Activities](/api/v1/activities)** - Activities with this company
- **[Notes](/api/v1/notes)** - Notes about this company
