# Contacts API

Manage people contacts at companies. Contacts can be linked to companies and support social profiles, communication preferences, and contact history.

## Overview

The Contacts API allows you to create, read, update, and delete contact records. Contacts represent people at companies and can be associated with companies, opportunities, and activities.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Contacts
`GET /api/v1/contacts`

Returns a paginated list of contacts.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `companyId` (string, optional): Filter by associated company
- `search` (string, optional): Search by name, email, phone
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "contact_abc123",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@acme.com",
      "phone": "+1-555-0100",
      "mobile": "+1-555-0101",
      "companyId": "company_xyz",
      "position": "VP of Sales",
      "isPrimary": true,
      "lastContactedAt": "2024-01-15T14:30:00Z",
      "createdAt": "2024-01-10T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Contact
`GET /api/v1/contacts/[id]`

Returns a single contact by ID.

### Create Contact
`POST /api/v1/contacts`

Create a new contact record.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "phone": "+1-555-0200",
  "companyId": "company_xyz",
  "position": "CTO",
  "preferredChannel": "email"
}
```

### Update Contact
`PATCH /api/v1/contacts/[id]`

Update an existing contact. Supports partial updates.

### Delete Contact
`DELETE /api/v1/contacts/[id]`

Delete a contact record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| firstName | text | Yes | Contact first name |
| lastName | text | Yes | Contact last name |
| email | email | Yes | Email address |
| phone | text | No | Office phone number |
| mobile | text | No | Mobile phone number |
| companyId | relation | No | Associated company (→ companies) |
| position | text | No | Job position or title |
| department | text | No | Department in company |
| isPrimary | boolean | No | Is primary contact for company |
| birthDate | date | No | Contact birth date |
| linkedin | url | No | LinkedIn profile URL |
| twitter | text | No | Twitter/X handle |
| preferredChannel | select | No | Preferred channel: email, phone, whatsapp, linkedin, slack, other |
| timezone | text | No | Contact timezone |
| lastContactedAt | datetime | Auto | Last time contacted |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Relationships

| Relation | Entity | Description |
|----------|--------|-------------|
| companyId | companies | Company this contact works at |

## Features

- **Searchable**: first name, last name, email, phone, mobile, position, department
- **Sortable**: All fields except social profiles
- **Bulk Operations**: Supported
- **Import/Export**: Supported

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Contact doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Companies](/api/v1/companies)** - Associated companies
- **[Activities](/api/v1/activities)** - Activities with this contact
- **[Notes](/api/v1/notes)** - Notes about this contact
- **[Opportunities](/api/v1/opportunities)** - Related opportunities
