# API Introduction

**API v1 architecture • RESTful design • Dual authentication • Auto-generated endpoints**

---

## Table of Contents

- [Overview](#overview)
- [Why API v1?](#why-api-v1)
- [Core Architecture](#core-architecture)
- [RESTful Design Principles](#restful-design-principles)
- [Dual Authentication System](#dual-authentication-system)
- [Dynamic Entity Endpoints](#dynamic-entity-endpoints)
- [Route Structure](#route-structure)
- [API Design Philosophy](#api-design-philosophy)
- [Quick Start](#quick-start)
- [Common Use Cases](#common-use-cases)
- [Performance Characteristics](#performance-characteristics)
- [Next Steps](#next-steps)

---

## Overview

The **API v1** provides a comprehensive RESTful interface to interact with your SaaS application programmatically. Built on Next.js 15 App Router with TypeScript, it offers:

**Key Features:**
- ✅ **Dual Authentication** - API Keys (external) + Sessions (dashboard)
- ✅ **Auto-Generated Endpoints** - Dynamic CRUD from entity registry
- ✅ **Type-Safe** - Full TypeScript support with auto-generated types
- ✅ **Performance-Optimized** - Built-time registry (zero runtime discovery)
- ✅ **Extensible** - Custom overrides for special business logic
- ✅ **Secure** - Scope-based permissions, rate limiting, input validation
- ✅ **RESTful** - Standard HTTP methods and status codes
- ✅ **Well-Documented** - Complete OpenAPI-style documentation

**Base URL:** `https://yourdomain.com/api/v1`

**Version:** 1.0 (stable)

---

## Why API v1?

### The Problem with Traditional APIs

Traditional API implementations suffer from:
- ❌ **Manual endpoint creation** - Every entity needs custom routes
- ❌ **Code duplication** - Similar CRUD logic repeated across endpoints
- ❌ **Maintenance burden** - New entities require extensive boilerplate
- ❌ **Inconsistency** - Different patterns for similar operations
- ❌ **Testing overhead** - Each endpoint needs custom tests

### The API v1 Solution

```typescript
// ❌ OLD WAY - Manual endpoint for every entity (200+ lines per entity)
// app/api/products/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  // ... pagination logic
  // ... filtering logic
  // ... sorting logic
  // ... metadata logic
  // ... permission logic
  // ... 150 more lines of boilerplate
}

// ✅ NEW WAY - Dynamic endpoint from entity config (ZERO lines!)
// Just define entity config in contents/entities/products/products.config.ts
// GET /api/v1/products automatically available with:
// - Pagination, filtering, sorting
// - Metadata integration
// - Permission checking
// - Rate limiting
// - Error handling
```

**Result:** **90%+ code reduction**, instant endpoint availability for new entities

---

## Core Architecture

### Architecture Diagram

```text
┌─────────────────────────────────────────────────────────┐
│                    Client Application                    │
│  (React, Mobile App, Third-party Service, cURL)         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ HTTPS Request
                   │ Authorization: Bearer sk_xxx OR Cookie
                   ▼
┌─────────────────────────────────────────────────────────┐
│               Next.js 15 API Layer (v1)                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1. Route Resolution (Next.js App Router)          │ │
│  │     /api/v1/[entity]/ → Dynamic route match        │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  2. Authentication (Dual System)                   │ │
│  │     API Key OR Session → User identification       │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  3. Rate Limiting (Per API Key/User)               │ │
│  │     Check limits → Return 429 if exceeded          │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  4. Entity Resolution (Registry-based)             │ │
│  │     ENTITY_REGISTRY.get(entity) → Config + Schema  │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  5. Permission Validation (Scope-based)            │ │
│  │     Check scopes → Return 403 if unauthorized      │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  6. Request Processing (Generic Handler)           │ │
│  │     Pagination → Filtering → Sorting → Execute     │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  7. Database Query (Row-Level Security)            │ │
│  │     PostgreSQL + RLS → Secure data access          │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  8. Response Formatting (Standardized)             │ │
│  │     { success, data, metadata, pagination }        │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ JSON Response
                   ▼
┌─────────────────────────────────────────────────────────┐
│                  Client Application                      │
│       (Handles response, displays data, retries)        │
└─────────────────────────────────────────────────────────┘
```

### Key Components

**1. Route Resolution (`app/api/v1/[entity]/route.ts`)**
- Next.js dynamic routes match incoming requests
- Priority: Core paths → Overrides → Dynamic → 404

**2. Authentication Layer (`core/lib/api/auth/dual-auth.ts`)**
- Validates API Key OR Session
- Returns unified auth object with user + scopes

**3. Rate Limiter (`core/lib/api/rate-limit.ts`)**
- Per-key/user rate limiting
- Configurable limits per scope

**4. Entity Registry (`core/lib/registries/entity-registry.ts`)**
- Build-time entity configuration
- Zero runtime I/O (pre-loaded)

**5. Generic Handler (`core/lib/api/entity/generic-handler.ts`)**
- Unified CRUD operations
- Supports pagination, filtering, sorting, metadata

**6. Response Formatter (`core/lib/api/helpers.ts`)**
- Standardized JSON responses
- Consistent error formatting

---

## RESTful Design Principles

### HTTP Methods

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| **GET** | Retrieve resource(s) | ✅ Yes | ✅ Yes |
| **POST** | Create new resource | ❌ No | ❌ No |
| **PATCH** | Partial update | ✅ Yes | ❌ No |
| **DELETE** | Remove resource | ✅ Yes | ❌ No |

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| **200** | OK | Successful GET/PATCH/DELETE |
| **201** | Created | Successful POST |
| **400** | Bad Request | Invalid request format |
| **401** | Unauthorized | Missing/invalid credentials |
| **403** | Forbidden | Valid credentials but insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **422** | Unprocessable Entity | Validation failed |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server-side error |

### Resource Naming

```text
GET    /api/v1/products          # List products (plural, lowercase)
POST   /api/v1/products          # Create product
GET    /api/v1/products/123      # Get specific product
PATCH  /api/v1/products/123      # Update product
DELETE /api/v1/products/123      # Delete product

# Nested resources (child entities)
GET    /api/v1/products/123/reviews      # List product reviews
POST   /api/v1/products/123/reviews      # Create product review
```

### Pagination

```text
GET /api/v1/products?page=2&limit=20

Response:
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

### Filtering

```text
GET /api/v1/products?status=active&category=electronics

Response includes only products matching all filters
```

### Sorting

```text
GET /api/v1/products?sortBy=createdAt&sortOrder=desc

Response sorted by creation date (newest first)
```

---

## Dual Authentication System

### Authentication Overview

API v1 supports **two authentication methods** that work seamlessly together:

**1. API Key Authentication (External Integrations)**
- For third-party services, mobile apps, scripts
- Scope-based permissions
- Rate limiting per key
- Header: `Authorization: Bearer sk_xxx`

**2. Session Authentication (Dashboard Users)**
- For logged-in dashboard users
- Cookie-based (automatic from browser)
- Full dashboard permissions
- No additional headers needed

### Authentication Flow

```typescript
// Server automatically tries both methods:
// 1. Check for session cookie → If valid, use session auth
// 2. If no session, check Authorization header → If valid, use API key
// 3. If both fail → Return 401 Unauthorized

// Example authentication flow:
const authResult = await authenticateRequest(request)

if (!authResult.success) {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  )
}

// authResult contains:
// - type: 'api_key' | 'session'
// - user: { id, email, role, ... }
// - scopes: ['products:read', 'products:write', ...]
```

### API Key Example

```bash
# Using API Key
curl https://api.example.com/api/v1/products \
  -H "Authorization: Bearer sk_live_abc123xyz"

# Response:
{
  "success": true,
  "data": [
    { "id": "1", "name": "Product A", ... }
  ]
}
```

### Session Example

```typescript
// Frontend (logged in user)
const response = await fetch('/api/v1/products', {
  credentials: 'include' // Send session cookie
})

// Session cookie automatically sent
// No Authorization header needed
```

---

## Dynamic Entity Endpoints

### What Are Dynamic Endpoints?

Dynamic endpoints are **auto-generated CRUD APIs** based on entity configuration from the registry system. When you define an entity in `contents/entities/[entity]/`, the API automatically provides full CRUD operations.

### How It Works

**1. Define Entity Config:**
```typescript
// contents/entities/products/products.config.ts
export const productEntityConfig = {
  name: 'products',
  tableName: 'products',
  fields: [
    { name: 'id', type: 'uuid', primaryKey: true },
    { name: 'name', type: 'string', required: true },
    { name: 'price', type: 'number', required: true },
    { name: 'status', type: 'string', enum: ['active', 'inactive'] }
  ],
  permissions: {
    create: ['products:write'],
    read: ['products:read'],
    update: ['products:write'],
    delete: ['products:delete']
  }
}
```

**2. Build Registry:**
```bash
npm run build:registry
```

**3. Endpoints Auto-Available:**
```text
✅ GET    /api/v1/products          # List products
✅ POST   /api/v1/products          # Create product
✅ GET    /api/v1/products/:id      # Get specific product
✅ PATCH  /api/v1/products/:id      # Update product
✅ DELETE /api/v1/products/:id      # Delete product
```

**No additional code required!** The generic handler processes all requests using entity config from the registry.

### What's Included

Every dynamic endpoint automatically supports:
- ✅ **Authentication** - API Key OR Session validation
- ✅ **Authorization** - Scope-based permission checking
- ✅ **Validation** - Field validation from entity config
- ✅ **Pagination** - `?page=1&limit=10`
- ✅ **Filtering** - `?status=active`
- ✅ **Sorting** - `?sortBy=createdAt&sortOrder=desc`
- ✅ **Field Selection** - `?fields=id,name,price`
- ✅ **Metadata** - `?metas=all` for custom metadata
- ✅ **Child Entities** - `?child=all` for relationships
- ✅ **Rate Limiting** - Per-key limits
- ✅ **Error Handling** - Standardized error responses
- ✅ **CORS** - Configured for API access
- ✅ **Type Safety** - Full TypeScript support

---

## Route Structure

### Complete Route Hierarchy

```text
app/api/v1/
├── [entity]/                    # 🔥 Dynamic entity endpoints (most entities)
│   ├── route.ts                 # GET (list) / POST (create)
│   └── [id]/
│       └── route.ts             # GET (read) / PATCH (update) / DELETE
│
├── (contents)/                  # 🎯 Custom overrides (special business logic)
│   └── tasks/                   # Example: custom task implementation
│       ├── route.ts
│       └── [id]/route.ts
│
├── users/                       # 🔒 Core user management (not dynamic)
│   ├── route.ts                 # GET /api/v1/users, POST /api/v1/users
│   └── [id]/
│       └── route.ts             # GET/PATCH/DELETE /api/v1/users/:id
│
├── api-keys/                    # 🔑 API key management (not dynamic)
│   ├── route.ts                 # GET /api/v1/api-keys, POST /api/v1/api-keys
│   └── [id]/
│       └── route.ts             # GET/PATCH/DELETE /api/v1/api-keys/:id
│
└── auth/                        # 🛡️ Authentication endpoints (not dynamic)
    └── route.ts                 # POST /api/v1/auth (token refresh, etc.)
```

### Resolution Priority

When a request comes in for `/api/v1/products/`, the router checks in this order:

**1. Core Paths (Highest Priority)**
- Is it `users`, `api-keys`, or `auth`?
- If yes → Use core implementation

**2. Custom Overrides (High Priority)**
- Does `/api/v1/(contents)/products/` exist?
- If yes → Use custom override logic

**3. Dynamic Endpoints (Standard)**
- Is `products` in ENTITY_REGISTRY?
- If yes → Use generic handler with entity config

**4. Not Found (404)**
- Entity not registered
- Return 404 error

### Example Resolution

```bash
# Request: GET /api/v1/products

# Step 1: Check core paths
# 'products' !== 'users' && 'products' !== 'api-keys' && 'products' !== 'auth'
# ❌ Not a core path

# Step 2: Check custom overrides
# Check if app/api/v1/(contents)/products/route.ts exists
# ❌ File doesn't exist (using dynamic)

# Step 3: Check entity registry
# ENTITY_REGISTRY.products → Found!
# ✅ Use generic handler with products entity config

# Result: Generic handler processes request using:
# - Entity: 'products'
# - Config: From ENTITY_REGISTRY.products
# - Handler: GET list operation
```

---

## API Design Philosophy

### 1. Convention Over Configuration

**Philosophy:** Sensible defaults reduce boilerplate.

```typescript
// ❌ Traditional API - Explicit everything
app.get('/products', authenticate, authorize('products:read'),
  paginate, filter, sort, (req, res) => {
    // 50 lines of query logic
  })

// ✅ API v1 - Convention-based
// Just define entity config → All features auto-included
```

### 2. Progressive Disclosure

**Philosophy:** Simple by default, powerful when needed.

```typescript
// Simple case - Just works
GET /api/v1/products

// Advanced case - Full control
GET /api/v1/products?page=2&limit=50&status=active&sortBy=price&sortOrder=asc&fields=id,name,price&metas=all
```

### 3. Zero Runtime Discovery

**Philosophy:** Build-time generation for instant performance.

```typescript
// ❌ Runtime discovery (140ms)
const entities = await fs.readdir('entities/')
const config = await import(`./entities/${entity}/config.ts`)

// ✅ Build-time registry (6ms)
const config = ENTITY_REGISTRY[entity]  // Pre-loaded
```

### 4. Security by Default

**Philosophy:** Every endpoint requires authentication.

```typescript
// ✅ No public endpoints without explicit opt-in
// ✅ Scope-based permissions for all operations
// ✅ Row-level security in database queries
// ✅ Rate limiting by default
// ✅ Input validation required
```

### 5. Type Safety Everywhere

**Philosophy:** Leverage TypeScript for reliability.

```typescript
// ✅ Auto-generated types from entity configs
type ProductResponse = EntityResponse<'products'>

// ✅ Type-safe API helpers
const response = createSuccessResponse<Product>(product)

// ✅ Type-safe error codes
return createErrorResponse(ErrorCode.VALIDATION_FAILED, 422)
```

---

## Quick Start

### 1. Generate API Key

```typescript
// Dashboard → Settings → API Keys → Create New Key
const apiKey = 'sk_live_abc123xyz'

// Select scopes:
// ✅ products:read
// ✅ products:write
// ✅ products:delete
```

### 2. Make First Request

```bash
# List products
curl https://api.example.com/api/v1/products \
  -H "Authorization: Bearer sk_live_abc123xyz"

# Response:
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Premium Widget",
      "price": 29.99,
      "status": "active",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### 3. Create Resource

```bash
curl -X POST https://api.example.com/api/v1/products \
  -H "Authorization: Bearer sk_live_abc123xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Product",
    "price": 49.99,
    "status": "active"
  }'

# Response (201 Created):
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "New Product",
    "price": 49.99,
    "status": "active",
    "createdAt": "2025-01-15T11:00:00Z"
  }
}
```

### 4. Update Resource

```bash
curl -X PATCH https://api.example.com/api/v1/products/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer sk_live_abc123xyz" \
  -H "Content-Type: application/json" \
  -d '{ "price": 39.99 }'

# Response (200 OK):
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "New Product",
    "price": 39.99,
    "status": "active",
    "updatedAt": "2025-01-15T11:15:00Z"
  }
}
```

### 5. Delete Resource

```bash
curl -X DELETE https://api.example.com/api/v1/products/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer sk_live_abc123xyz"

# Response (200 OK):
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

## Common Use Cases

### Use Case 1: Mobile App Integration

```typescript
// Mobile app using API keys for all requests
const API_KEY = 'sk_mobile_xyz123'

async function fetchProducts() {
  const response = await fetch('https://api.example.com/api/v1/products', {
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  })

  const result = await response.json()

  if (result.success) {
    return result.data
  }

  throw new Error(result.error)
}
```

### Use Case 2: Dashboard Integration

```typescript
// React dashboard using TanStack Query + Session auth
import { useQuery } from '@tanstack/react-query'

function ProductList() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      // No Authorization header needed - session cookie sent automatically
      const response = await fetch('/api/v1/products', {
        credentials: 'include'
      })

      const result = await response.json()
      return result.data
    }
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {data?.map(product => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  )
}
```

### Use Case 3: Third-Party Integration

```python
# Python script using API key
import requests

API_KEY = 'sk_integration_xyz'
BASE_URL = 'https://api.example.com/api/v1'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# List products
response = requests.get(f'{BASE_URL}/products', headers=headers)
products = response.json()['data']

# Create product
new_product = {
    'name': 'Automated Product',
    'price': 99.99,
    'status': 'active'
}

response = requests.post(
    f'{BASE_URL}/products',
    headers=headers,
    json=new_product
)

created = response.json()['data']
print(f"Created product: {created['id']}")
```

### Use Case 4: Webhook Consumer

```typescript
// External service receiving webhooks and querying API
export async function handleWebhook(event: WebhookEvent) {
  const API_KEY = process.env.API_KEY

  // Fetch related product data
  const response = await fetch(
    `https://api.example.com/api/v1/products/${event.productId}`,
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    }
  )

  const result = await response.json()

  if (result.success) {
    await processProduct(result.data)
  }
}
```

---

## Performance Characteristics

### Response Times

| Operation | Avg Time | Notes |
|-----------|----------|-------|
| **LIST (10 items)** | ~50ms | Includes auth + query |
| **LIST (100 items)** | ~120ms | Pagination recommended |
| **GET (single)** | ~30ms | Cached in registry |
| **CREATE** | ~80ms | Includes validation |
| **UPDATE** | ~70ms | Partial update |
| **DELETE** | ~60ms | Soft delete available |

### Optimization Tips

**1. Use Pagination**
```bash
# ✅ Good - Paginated
GET /api/v1/products?page=1&limit=20

# ❌ Bad - Fetching all records
GET /api/v1/products?limit=10000
```

**2. Select Only Needed Fields**
```bash
# ✅ Good - Minimal payload
GET /api/v1/products?fields=id,name,price

# ❌ Bad - All fields (including large text)
GET /api/v1/products
```

**3. Use Filtering**
```bash
# ✅ Good - Filter server-side
GET /api/v1/products?status=active

# ❌ Bad - Filter client-side
GET /api/v1/products (fetch all, filter locally)
```

### Caching Strategy

```typescript
// API responses include cache headers
Cache-Control: private, max-age=60

// ETags for conditional requests
ETag: "abc123xyz"

// Use If-None-Match for efficiency
curl -H "If-None-Match: abc123xyz" /api/v1/products
// → 304 Not Modified (if unchanged)
```

---

## Next Steps

**For detailed information, see:**

1. **[Authentication](./02-authentication.md)** - API Keys, Sessions, Scopes
2. **[Dynamic Endpoints](./03-dynamic-endpoints.md)** - Auto-generated CRUD
3. **[Query Parameters](./05-query-parameters.md)** - Filtering, pagination, sorting
4. **[Error Handling](./08-error-handling.md)** - Error codes and recovery
5. **[Integration Examples](./09-integration-examples.md)** - TanStack Query, fetch, Python
6. **[API Reference](./10-api-reference.md)** - Complete endpoint catalog

**Common tasks:**
- Generate API key → [Authentication](./02-authentication.md#generating-api-keys)
- Create custom endpoint → [Custom Endpoints](./04-custom-endpoints.md)
- Implement rate limiting → [Rate Limiting](./07-rate-limiting.md)
- Test API endpoints → [Testing APIs](./17-testing-apis.md)

**Documentation:** `core/docs/05-api/01-introduction.md`
