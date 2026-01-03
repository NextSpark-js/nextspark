# Dynamic API Endpoints

**Auto-generated CRUD • Entity registry • Zero boilerplate • Type-safe**

---

## Table of Contents

- [Overview](#overview)
- [How Dynamic Endpoints Work](#how-dynamic-endpoints-work)
- [CRUD Operations](#crud-operations)
- [LIST Operation (GET)](#list-operation-get)
- [CREATE Operation (POST)](#create-operation-post)
- [READ Operation (GET by ID)](#read-operation-get-by-id)
- [UPDATE Operation (PATCH)](#update-operation-patch)
- [DELETE Operation (DELETE)](#delete-operation-delete)
- [Request Formats](#request-formats)
- [Response Formats](#response-formats)
- [Entity Configuration Impact](#entity-configuration-impact)
- [Public vs Authenticated Entities](#public-vs-authenticated-entities)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Dynamic endpoints** are automatically generated CRUD APIs based on entity configuration from the registry system. When you define an entity in `contents/entities/[entity]/`, the API instantly provides full CRUD operations without writing a single line of endpoint code.

**Key Features:**
- ✅ **Zero Boilerplate** - Define entity config, get API automatically
- ✅ **Full CRUD** - LIST, CREATE, READ, UPDATE, DELETE operations
- ✅ **Type-Safe** - Full TypeScript support from entity config
- ✅ **Performance** - Registry-based (6ms vs 140ms runtime discovery)
- ✅ **Dual Auth** - API Keys + Sessions supported
- ✅ **Rich Querying** - Pagination, filtering, sorting, field selection
- ✅ **Metadata Support** - Custom metadata integration
- ✅ **Child Entities** - Nested relationship loading
- ✅ **Validation** - Automatic from entity field definitions
- ✅ **RLS** - Row-level security built-in

**Code Reduction:**
```typescript
// ❌ Traditional: ~200 lines per entity
// - Manually define 5 route handlers
// - Duplicate auth, validation, pagination logic
// - Repeat for every new entity

// ✅ Dynamic: 0 lines! Just entity config
// Define entity config once → Full API ready
```

---

## How Dynamic Endpoints Work

### Architecture Flow

```text
1. Define Entity Config
   ↓
   contents/entities/products/products.config.ts
   ↓
2. Build Registry
   ↓
   npm run build:registry
   ↓
3. Registry Generated
   ↓
   core/lib/registries/entity-registry.ts
   {
     products: { name, tableName, fields, permissions, ... }
   }
   ↓
4. Request arrives
   ↓
   GET /api/v1/products
   ↓
5. Route Resolution (Next.js App Router)
   ↓
   app/api/v1/[entity]/route.ts → handleGenericList
   ↓
6. Entity Resolution (from URL)
   ↓
   resolveEntityFromUrl('/api/v1/products') → { entityConfig: products }
   ↓
7. Generic Handler Processing
   ↓
   - Authenticate (API Key OR Session)
   - Validate permissions (products:read)
   - Parse query params (pagination, filters, etc.)
   - Build SQL query from entity config
   - Execute with RLS
   - Format response
   ↓
8. Response
   ↓
   { success: true, data: [...], pagination: {...} }
```

### Generic Handler Routes

**List/Create Route:**
```typescript
// app/api/v1/[entity]/route.ts
import {
  handleGenericList,
  handleGenericCreate,
  handleGenericOptions
} from '@/core/lib/api/entity/generic-handler'

export const GET = handleGenericList      // LIST operation
export const POST = handleGenericCreate   // CREATE operation
export const OPTIONS = handleGenericOptions // CORS
```

**Read/Update/Delete Route:**
```typescript
// app/api/v1/[entity]/[id]/route.ts
import {
  handleGenericRead,
  handleGenericUpdate,
  handleGenericDelete,
  handleGenericOptions
} from '@/core/lib/api/entity/generic-handler'

export const GET = handleGenericRead       // READ operation
export const PATCH = handleGenericUpdate   // UPDATE operation
export const DELETE = handleGenericDelete  // DELETE operation
export const OPTIONS = handleGenericOptions // CORS
```

---

## CRUD Operations

### Operation Summary

| Operation | Method | Endpoint | Auth Required | Scope Required |
|-----------|--------|----------|---------------|----------------|
| **LIST** | GET | `/api/v1/[entity]` | Yes* | `{entity}:read` |
| **CREATE** | POST | `/api/v1/[entity]` | Yes | `{entity}:write` |
| **READ** | GET | `/api/v1/[entity]/[id]` | Yes* | `{entity}:read` |
| **UPDATE** | PATCH | `/api/v1/[entity]/[id]` | Yes | `{entity}:write` |
| **DELETE** | DELETE | `/api/v1/[entity]/[id]` | Yes | `{entity}:delete` |

\* Auth not required if entity has `access.public: true`

### Supported Query Parameters

| Parameter | Operations | Description |
|-----------|-----------|-------------|
| `page` | LIST | Page number (default: 1) |
| `limit` | LIST | Items per page (default: 10, max: 100) |
| `sortBy` | LIST | Field to sort by |
| `sortOrder` | LIST | Sort direction (`asc` or `desc`) |
| `fields` | LIST, READ | Select specific fields |
| `distinct` | LIST | Get distinct values (with `fields`) |
| `ids` | LIST | Get specific IDs (comma-separated) |
| `search` | LIST | Search across searchable fields |
| `from` / `to` | LIST | Date range filtering |
| `dateField` | LIST | Field for date range |
| `metas` | LIST, READ | Include metadata |
| `child` | LIST, READ | Include child entities |
| `{field}={value}` | LIST | Custom field filtering |

---

## LIST Operation (GET)

### Basic List

**Request:**
```bash
GET /api/v1/products
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Premium Widget",
      "price": 29.99,
      "status": "active",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Standard Widget",
      "price": 19.99,
      "status": "active",
      "createdAt": "2025-01-14T09:15:00Z",
      "updatedAt": "2025-01-14T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

### Paginated List

**Request:**
```bash
GET /api/v1/products?page=2&limit=20
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Filtered List

**Request:**
```bash
GET /api/v1/products?status=active&category=electronics
Authorization: Bearer sk_live_abc123...
```

**Response:** Only products matching ALL filters (AND logic)

### Sorted List

**Request:**
```bash
GET /api/v1/products?sortBy=createdAt&sortOrder=desc
Authorization: Bearer sk_live_abc123...
```

**Response:** Products sorted by creation date (newest first)

### Field Selection

**Request:**
```bash
GET /api/v1/products?fields=id,name,price
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Premium Widget",
      "price": 29.99
    }
  ],
  "pagination": {...}
}
```

### Specific IDs

**Request:**
```bash
GET /api/v1/products?ids=id1,id2,id3
Authorization: Bearer sk_live_abc123...
```

**Response:** Only products with specified IDs

### Distinct Values

**Request:**
```bash
GET /api/v1/products?fields=category&distinct=true
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "value": "electronics", "label": "electronics", "entityType": "products" },
    { "value": "furniture", "label": "furniture", "entityType": "products" },
    { "value": "clothing", "label": "clothing", "entityType": "products" }
  ]
}
```

### Date Range

**Request:**
```bash
GET /api/v1/products?from=2025-01-01&to=2025-01-31&dateField=createdAt
Authorization: Bearer sk_live_abc123...
```

**Response:** Products created between Jan 1-31, 2025

### Search

**Request:**
```bash
GET /api/v1/products?search=widget
Authorization: Bearer sk_live_abc123...
```

**Response:** Products matching "widget" in searchable fields

### With Metadata

**Request:**
```bash
GET /api/v1/products?metas=all
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Premium Widget",
      "price": 29.99,
      "metas": {
        "featured": "true",
        "badge": "bestseller"
      }
    }
  ],
  "pagination": {...}
}
```

### With Child Entities

**Request:**
```bash
GET /api/v1/products?child=all
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Premium Widget",
      "reviews": [
        { "id": "review-1", "rating": 5, "comment": "Great!" }
      ],
      "variants": [
        { "id": "variant-1", "color": "blue", "size": "M" }
      ]
    }
  ],
  "pagination": {...}
}
```

---

## CREATE Operation (POST)

### Basic Create

**Request:**
```bash
POST /api/v1/products
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "name": "New Product",
  "price": 49.99,
  "status": "active",
  "category": "electronics"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "New Product",
    "price": 49.99,
    "status": "active",
    "category": "electronics",
    "createdAt": "2025-01-15T12:00:00Z",
    "updatedAt": "2025-01-15T12:00:00Z"
  }
}
```

### Create with Metadata

**Request:**
```bash
POST /api/v1/products
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "name": "Featured Product",
  "price": 99.99,
  "status": "active",
  "metas": {
    "featured": "true",
    "badge": "new"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "name": "Featured Product",
    "price": 99.99,
    "status": "active",
    "metas": {
      "featured": "true",
      "badge": "new"
    },
    "createdAt": "2025-01-15T12:05:00Z",
    "updatedAt": "2025-01-15T12:05:00Z"
  }
}
```

### Validation Errors

**Request:**
```bash
POST /api/v1/products
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "name": "",  // ❌ Required field empty
  "price": -10  // ❌ Invalid value
}
```

**Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "name": "Name is required",
    "price": "Price must be a positive number"
  }
}
```

---

## READ Operation (GET by ID)

### Basic Read

**Request:**
```bash
GET /api/v1/products/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium Widget",
    "price": 29.99,
    "status": "active",
    "category": "electronics",
    "description": "High-quality premium widget...",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

### Read with Field Selection

**Request:**
```bash
GET /api/v1/products/550e8400-e29b-41d4-a716-446655440000?fields=id,name,price
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium Widget",
    "price": 29.99
  }
}
```

### Read with Metadata

**Request:**
```bash
GET /api/v1/products/550e8400-e29b-41d4-a716-446655440000?metas=all
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium Widget",
    "price": 29.99,
    "metas": {
      "featured": "true",
      "badge": "bestseller"
    }
  }
}
```

### Read with Children

**Request:**
```bash
GET /api/v1/products/550e8400-e29b-41d4-a716-446655440000?child=all
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium Widget",
    "price": 29.99,
    "reviews": [
      { "id": "review-1", "rating": 5, "comment": "Excellent!" },
      { "id": "review-2", "rating": 4, "comment": "Good value" }
    ],
    "variants": [
      { "id": "variant-1", "color": "blue", "size": "M" },
      { "id": "variant-2", "color": "red", "size": "L" }
    ]
  }
}
```

### Not Found

**Request:**
```bash
GET /api/v1/products/nonexistent-id
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": false,
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

---

## UPDATE Operation (PATCH)

### Basic Update

**Request:**
```bash
PATCH /api/v1/products/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "price": 39.99,
  "status": "inactive"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium Widget",
    "price": 39.99,  // Updated
    "status": "inactive",  // Updated
    "category": "electronics",  // Unchanged
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T13:00:00Z"  // Updated timestamp
  }
}
```

### Update with Metadata

**Request:**
```bash
PATCH /api/v1/products/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "metas": {
    "featured": "false",
    "badge": "sale"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium Widget",
    "price": 39.99,
    "metas": {
      "featured": "false",
      "badge": "sale"
    },
    "updatedAt": "2025-01-15T13:05:00Z"
  }
}
```

### Partial Update

```bash
# Only update one field
PATCH /api/v1/products/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "status": "active"
}
```

**Response:** Only `status` and `updatedAt` changed, all other fields unchanged

---

## DELETE Operation (DELETE)

### Basic Delete

**Request:**
```bash
DELETE /api/v1/products/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

### Delete Not Found

**Request:**
```bash
DELETE /api/v1/products/nonexistent-id
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": false,
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

### Soft Delete (if configured)

If entity has `softDelete: true`:

**Request:**
```bash
DELETE /api/v1/products/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium Widget",
    "deletedAt": "2025-01-15T14:00:00Z"  // Soft deleted
  }
}
```

---

## Request Formats

### Headers

**Required:**
```text
Authorization: Bearer sk_live_abc123...
Content-Type: application/json  (for POST/PATCH)
```

**Optional:**
```text
X-API-Key: sk_live_abc123...  (alternative to Authorization)
```

### Request Body (POST/PATCH)

**Format:**
```json
{
  "field1": "value1",
  "field2": 123,
  "field3": true,
  "metas": {
    "customKey": "customValue"
  }
}
```

**Rules:**
- Only include fields defined in entity config
- Use correct data types (string, number, boolean, etc.)
- Required fields must be present (POST)
- Metadata goes in `metas` object

---

## Response Formats

### Success Response (LIST)

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15
  }
}
```

### Success Response (CREATE/READ/UPDATE)

```json
{
  "success": true,
  "data": {
    "id": "...",
    "field1": "value1",
    ...
  }
}
```

### Success Response (DELETE)

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

---

## Entity Configuration Impact

### Entity Config Structure

```typescript
// contents/entities/products/products.config.ts
export const productEntityConfig = {
  name: 'products',
  slug: 'products',
  tableName: 'products',

  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'price', type: 'number', required: true, validation: { min: 0 } },
    { name: 'status', type: 'string', enum: ['active', 'inactive'] }
  ],

  permissions: {
    create: ['products:write'],
    read: ['products:read'],
    update: ['products:write'],
    delete: ['products:delete']
  },

  access: {
    public: false,  // Requires authentication
    shared: false   // User-scoped (RLS)
  },

  operations: {
    list: true,
    create: true,
    read: true,
    update: true,
    delete: true
  }
}
```

### Config → API Mapping

| Config | API Impact |
|--------|-----------|
| `fields` | Available fields in requests/responses |
| `permissions.actions` | Array of permission actions with roles |
| `access.public` | If true, no auth required for read |
| `access.shared` | If false, RLS applies (user-scoped) |
| `operations.list` | If false, LIST endpoint disabled |
| `operations.create` | If false, CREATE endpoint disabled |
| `tableName` | Database table to query |
| `slug` | URL path segment |

### Field Validation

```typescript
fields: [
  {
    name: 'price',
    type: 'number',
    required: true,
    validation: {
      min: 0,
      max: 10000
    }
  },
  {
    name: 'email',
    type: 'string',
    required: true,
    validation: {
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
    }
  }
]
```

**Automatic Validation:**
- Required fields enforced on CREATE
- Type validation (string, number, boolean)
- Enum validation (must be one of allowed values)
- Min/max validation for numbers
- Pattern validation for strings

---

## Public vs Authenticated Entities

### Authenticated Entity (Default)

```typescript
// Entity config
access: {
  public: false,
  shared: false
}

// API behavior:
// - Authentication required
// - Scope validation required
// - RLS applied (user-scoped data)
```

**Request:**
```bash
GET /api/v1/products
Authorization: Bearer sk_live_abc123...  # Required!
```

### Public Entity

```typescript
// Entity config
access: {
  public: true,
  shared: true
}

// API behavior:
// - No authentication required for read
// - Authentication required for write
// - No RLS (all users see same data)
```

**Request:**
```bash
# No auth needed for read
GET /api/v1/blog-posts

# Auth needed for write
POST /api/v1/blog-posts
Authorization: Bearer sk_live_abc123...
```

### Shared Entity

```typescript
// Entity config
access: {
  public: false,
  shared: true
}

// API behavior:
// - Authentication required
// - Scope validation required
// - No RLS (users see all data, not just their own)
```

---

## Examples

### Example 1: Complete Product CRUD

```bash
# 1. List products
GET /api/v1/products?page=1&limit=10&status=active
Authorization: Bearer sk_live_abc123...

# 2. Create product
POST /api/v1/products
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "name": "New Widget",
  "price": 29.99,
  "status": "active",
  "category": "electronics"
}

# Response: { success: true, data: { id: "new-id", ... } }

# 3. Read product
GET /api/v1/products/new-id
Authorization: Bearer sk_live_abc123...

# 4. Update product
PATCH /api/v1/products/new-id
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "price": 24.99
}

# 5. Delete product
DELETE /api/v1/products/new-id
Authorization: Bearer sk_live_abc123...
```

### Example 2: Advanced Filtering

```bash
# Multiple filters + sorting + pagination
GET /api/v1/products?status=active&category=electronics&price_min=20&price_max=50&sortBy=price&sortOrder=asc&page=1&limit=20
Authorization: Bearer sk_live_abc123...

# Returns: Active electronics products priced $20-50, sorted by price (low to high), page 1
```

### Example 3: Field Selection with Metadata

```bash
# Select specific fields + include metadata
GET /api/v1/products?fields=id,name,price&metas=all
Authorization: Bearer sk_live_abc123...

# Response:
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Premium Widget",
      "price": 29.99,
      "metas": {
        "featured": "true",
        "badge": "bestseller"
      }
    }
  ],
  "pagination": {...}
}
```

---

## Troubleshooting

### Issue 1: Entity Not Found (404)

**Symptoms:**
```json
{
  "success": false,
  "error": "Entity not found",
  "code": "NOT_FOUND"
}
```

**Causes:**
1. Entity not registered in registry
2. Typo in entity name
3. Registry not rebuilt after adding entity

**Solutions:**
```bash
# 1. Check entity exists
ls contents/entities/products/

# 2. Check registry includes entity
grep "products" core/lib/registries/entity-registry.ts

# 3. Rebuild registry
npm run build:registry

# 4. Verify entity name matches slug
# URL: /api/v1/products
# Config: slug: 'products'
```

### Issue 2: Operation Not Supported (405)

**Symptoms:**
```json
{
  "success": false,
  "error": "List operation not supported for this entity",
  "code": "METHOD_NOT_ALLOWED"
}
```

**Cause:** Entity config has operation disabled

**Solution:**
```typescript
// Enable operation in entity config
operations: {
  list: true,   // ✅ Enable LIST
  create: true,
  read: true,
  update: true,
  delete: true
}
```

### Issue 3: Validation Failed (422)

**Symptoms:**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "price": "Price must be a positive number"
  }
}
```

**Causes:**
1. Missing required field
2. Invalid data type
3. Fails validation rules
4. Invalid enum value

**Solutions:**
```typescript
// Check field requirements
fields: [
  { name: 'name', type: 'string', required: true },  // Must provide
  { name: 'price', type: 'number', validation: { min: 0 } },  // Must be >= 0
  { name: 'status', type: 'string', enum: ['active', 'inactive'] }  // Must be one of these
]
```

### Issue 4: Empty Response

**Symptoms:**
```json
{
  "success": true,
  "data": [],
  "pagination": { "total": 0 }
}
```

**Causes:**
1. No matching records
2. RLS filtering out all records (user-scoped data)
3. Filters too restrictive

**Solutions:**
```bash
# 1. Check database has records
SELECT * FROM products;

# 2. Check user has access (RLS)
SELECT * FROM products WHERE "userId" = 'current-user-id';

# 3. Remove filters to test
GET /api/v1/products  # No filters
```

### Issue 5: Performance Issues

**Symptoms:** Slow response times (>500ms)

**Causes:**
1. Large result set (no pagination)
2. Complex filters
3. Missing database indexes
4. Including too many child entities

**Solutions:**
```bash
# 1. Use pagination
GET /api/v1/products?page=1&limit=20  # ✅ Good

# 2. Use field selection
GET /api/v1/products?fields=id,name  # ✅ Minimal payload

# 3. Add database indexes
CREATE INDEX idx_products_status ON products(status);

# 4. Limit child entities
GET /api/v1/products?child=reviews  # Only one child type
```

---

## Summary

**Dynamic Endpoints provide:**
- ✅ **Zero boilerplate** - Define config, get full CRUD API
- ✅ **Full CRUD** - LIST, CREATE, READ, UPDATE, DELETE operations
- ✅ **Rich querying** - Pagination, filtering, sorting, field selection
- ✅ **Type-safe** - Full TypeScript support from entity config
- ✅ **Performance** - Registry-based (6ms vs 140ms)
- ✅ **Flexible** - Public or authenticated, shared or user-scoped
- ✅ **Validated** - Automatic validation from field definitions
- ✅ **Metadata support** - Custom metadata integration
- ✅ **Child entities** - Nested relationship loading

**When to use Dynamic Endpoints:**
- ✅ Standard CRUD operations
- ✅ Basic validation sufficient
- ✅ Standard permissions (scope-based)
- ✅ No complex business logic

**When to use Custom Endpoints:**
- ❌ Complex validation beyond field rules
- ❌ Special permissions (e.g., admin creates for others)
- ❌ Advanced relationships/joins
- ❌ Integration with external services
- ❌ Custom response formats

**Next Steps:**
- [Custom Endpoints](./04-custom-endpoints.md) - When you need special logic
- [Query Parameters](./05-query-parameters.md) - Complete parameter reference
- [Metadata in APIs](./06-metadata-in-apis.md) - Using custom metadata
- [Error Handling](./08-error-handling.md) - Complete error codes

**Documentation:** `core/docs/05-api/03-dynamic-endpoints.md`
