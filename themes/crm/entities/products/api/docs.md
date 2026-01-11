# Products API

Manage products and services catalog. Products can be referenced in opportunities and quotes with pricing, commission rates, and categorization.

## Overview

The Products API allows you to create, read, update, and delete product records. Products represent the items and services your team sells and can be linked to opportunities.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Products
`GET /api/v1/products`

Returns a paginated list of products.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `type` (string, optional): Filter by type (product, service, subscription, bundle, addon)
- `isActive` (boolean, optional): Filter by active status
- `search` (string, optional): Search by code, name, category
- `sortBy` (string, optional): Field to sort by
- `sortOrder` (string, optional): Sort direction (asc, desc)

**Example Response:**
```json
{
  "data": [
    {
      "id": "product_abc123",
      "code": "PRD-001",
      "name": "Enterprise License",
      "category": "Software",
      "type": "subscription",
      "description": "Annual enterprise software license",
      "price": 5000,
      "cost": 1000,
      "currency": "USD",
      "unit": "year",
      "isActive": true,
      "commissionRate": 10,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Product
`GET /api/v1/products/[id]`

Returns a single product by ID.

### Create Product
`POST /api/v1/products`

Create a new product record.

**Request Body:**
```json
{
  "code": "SVC-002",
  "name": "Consulting Services",
  "category": "Services",
  "type": "service",
  "description": "Professional consulting services",
  "price": 150,
  "currency": "USD",
  "unit": "hour",
  "isActive": true
}
```

### Update Product
`PATCH /api/v1/products/[id]`

Update an existing product. Supports partial updates.

### Delete Product
`DELETE /api/v1/products/[id]`

Delete a product record.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | text | Yes | Product code or SKU |
| name | text | Yes | Product name |
| category | text | No | Product category |
| type | select | No | Type: product, service, subscription, bundle, addon |
| description | textarea | No | Product description |
| price | number | Yes | Standard selling price |
| cost | number | No | Product cost |
| currency | select | No | Currency: USD, EUR, GBP, MXN, etc. |
| unit | select | No | Unit: piece, hour, day, week, month, year, kg, lb, meter, foot, license, user |
| isActive | boolean | No | Is product currently active |
| minimumQuantity | number | No | Minimum order quantity |
| image | url | No | Product image URL |
| brochureUrl | url | No | Product brochure URL |
| commissionRate | number | No | Sales commission percentage |
| createdAt | datetime | Auto | Creation timestamp |
| updatedAt | datetime | Auto | Last update timestamp |

## Features

- **Searchable**: code, name, category, description
- **Sortable**: Most fields
- **Metadata**: Supported

## Permissions

- **Create/Update/Delete**: Owner only

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions (owner only) |
| 404 | Not Found - Product doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Opportunities](/api/v1/opportunities)** - Link products to deals
