# Customers API

Manage customer records in the system. This endpoint supports full CRUD operations with team-based multi-tenancy.

## Overview

The Customers API allows you to create, read, update, and delete customer records. Each customer belongs to a team and is automatically filtered based on the authenticated user's team context.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Customers
`GET /api/v1/customers`

Returns a paginated list of customers for the current team.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `status` (string, optional): Filter by status (active, inactive, pending)
- `search` (string, optional): Search term for partial matching
- `searchField` (string, optional): Field to search in (name, email)
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "cust_123",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
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

### Get Single Customer
`GET /api/v1/customers/[id]`

Returns a single customer by ID.

**Path Parameters:**
- `id` (string, required): Customer ID

### Create Customer
`POST /api/v1/customers`

Create a new customer record.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "status": "active"
}
```

### Update Customer
`PATCH /api/v1/customers/[id]`

Update an existing customer.

**Path Parameters:**
- `id` (string, required): Customer ID

**Request Body:**
Any fields to update (partial update supported).

### Delete Customer
`DELETE /api/v1/customers/[id]`

Delete a customer record.

**Path Parameters:**
- `id` (string, required): Customer ID

## Admin Bypass

Superadmin users can access customers across all teams by sending:
- Header: `x-admin-bypass: confirm-cross-team-access`
- Optional header: `x-team-id: {team_id}` to filter a specific team

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Customer doesn't exist |
| 422 | Validation Error - Invalid data |
