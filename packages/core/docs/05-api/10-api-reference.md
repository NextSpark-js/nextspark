# API Reference

**Complete endpoint catalog • All HTTP methods • Request/response schemas**

---

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Common Headers](#common-headers)
- [Dynamic Entity Endpoints](#dynamic-entity-endpoints)
- [System Endpoints](#system-endpoints)
- [Custom Plugin Endpoints](#custom-plugin-endpoints)
- [Response Format](#response-format)
- [Error Codes](#error-codes)

---

## Overview

This reference documents all available API endpoints in the v1 API. The API follows RESTful conventions and provides both auto-generated dynamic endpoints (based on entity registry) and custom endpoints (defined by plugins).

**API Version:** v1
**Base URL:** `https://yourdomain.com/api/v1`
**Content-Type:** `application/json`
**Authentication:** API Key (header) or Session (cookie)

---

## Base URL

```text
Production:  https://yourdomain.com/api/v1
Development: http://localhost:5173/api/v1
```

All endpoint paths in this reference are relative to the base URL.

---

## Authentication

All endpoints require authentication unless explicitly marked as **Public**.

**API Key Authentication (External Clients):**
```http
GET /api/v1/tasks
Authorization: Bearer sk_live_abc123...
```

**Session Authentication (Dashboard):**
```http
GET /api/v1/tasks
Cookie: better-auth.session_token=...
```

See [Authentication](./02-authentication.md) for detailed authentication documentation.

---

## Common Headers

### Request Headers

```http
# Required for all requests
Authorization: Bearer {api_key}
Content-Type: application/json

# Optional
X-Request-ID: {unique_request_id}
Accept-Language: en
X-API-Version: v1
```

### Response Headers

```http
# Standard response headers
Content-Type: application/json
X-Request-ID: {unique_request_id}
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200

# Pagination headers (LIST operations)
X-Total-Count: 150
X-Page: 1
X-Per-Page: 20
Link: </api/v1/tasks?page=2>; rel="next"
```

---

## Dynamic Entity Endpoints

Dynamic endpoints are **auto-generated** for all entities in the registry. Each entity gets a full CRUD API with zero boilerplate.

**Available Entities:**
- `tasks` - Task management
- `products` - Product catalog
- `orders` - Order processing
- `customers` - Customer database
- (All entities from `ENTITY_REGISTRY`)

### LIST - Get All Records

```http
GET /api/v1/{entity}
```

**Description:** Retrieve a paginated list of records.

**Query Parameters:**
```typescript
{
  // Pagination
  page?: number        // Default: 1
  limit?: number       // Default: 20, Max: 100

  // Filtering
  filter?: string      // JSON object for filtering
  search?: string      // Full-text search

  // Sorting
  sort?: string        // Field name
  order?: 'asc' | 'desc'  // Default: 'asc'

  // Field selection
  fields?: string      // Comma-separated field names
  include?: string     // Comma-separated relations

  // Date range
  startDate?: string   // ISO 8601
  endDate?: string     // ISO 8601
}
```

**Example Request:**
```bash
curl "https://yourdomain.com/api/v1/tasks?page=1&limit=10&sort=createdAt&order=desc" \
  -H "Authorization: Bearer sk_live_abc123..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "description": "Write comprehensive API reference",
      "status": "in_progress",
      "priority": "high",
      "assigneeId": "usr_xyz789",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions (missing `read` scope)
- `429 Too Many Requests` - Rate limit exceeded

---

### CREATE - Create New Record

```http
POST /api/v1/{entity}
```

**Description:** Create a new record.

**Request Body:**
```typescript
{
  // Entity-specific fields (see entity schema)
  [key: string]: any
}
```

**Example Request:**
```bash
curl -X POST "https://yourdomain.com/api/v1/tasks" \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New task",
    "description": "Task description",
    "status": "todo",
    "priority": "medium"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "tsk_def456",
    "title": "New task",
    "description": "Task description",
    "status": "todo",
    "priority": "medium",
    "createdAt": "2025-01-15T15:00:00Z",
    "updatedAt": "2025-01-15T15:00:00Z"
  }
}
```

**Status Codes:**
- `201 Created` - Success
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions (missing `write` scope)
- `422 Unprocessable Entity` - Invalid data format
- `429 Too Many Requests` - Rate limit exceeded

---

### READ - Get Single Record

```http
GET /api/v1/{entity}/{id}
```

**Description:** Retrieve a single record by ID.

**Path Parameters:**
- `id` - Record ID (e.g., `tsk_abc123`)

**Query Parameters:**
```typescript
{
  fields?: string      // Comma-separated field names
  include?: string     // Comma-separated relations
}
```

**Example Request:**
```bash
curl "https://yourdomain.com/api/v1/tasks/tsk_abc123?include=assignee,comments" \
  -H "Authorization: Bearer sk_live_abc123..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "tsk_abc123",
    "title": "Complete API documentation",
    "description": "Write comprehensive API reference",
    "status": "in_progress",
    "priority": "high",
    "assigneeId": "usr_xyz789",
    "assignee": {
      "id": "usr_xyz789",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "comments": [
      {
        "id": "cmt_123",
        "text": "Great progress!",
        "createdAt": "2025-01-15T12:00:00Z"
      }
    ],
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T14:20:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions (missing `read` scope)
- `404 Not Found` - Record not found
- `429 Too Many Requests` - Rate limit exceeded

---

### UPDATE - Update Record

```http
PATCH /api/v1/{entity}/{id}
```

**Description:** Update an existing record (partial update).

**Path Parameters:**
- `id` - Record ID

**Request Body:**
```typescript
{
  // Only include fields to update
  [key: string]: any
}
```

**Example Request:**
```bash
curl -X PATCH "https://yourdomain.com/api/v1/tasks/tsk_abc123" \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "priority": "low"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "tsk_abc123",
    "title": "Complete API documentation",
    "description": "Write comprehensive API reference",
    "status": "completed",
    "priority": "low",
    "assigneeId": "usr_xyz789",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T16:00:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions (missing `write` scope)
- `404 Not Found` - Record not found
- `422 Unprocessable Entity` - Invalid data format
- `429 Too Many Requests` - Rate limit exceeded

---

### DELETE - Delete Record

```http
DELETE /api/v1/{entity}/{id}
```

**Description:** Permanently delete a record.

**Path Parameters:**
- `id` - Record ID

**Example Request:**
```bash
curl -X DELETE "https://yourdomain.com/api/v1/tasks/tsk_abc123" \
  -H "Authorization: Bearer sk_live_abc123..."
```

**Example Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions (missing `delete` scope)
- `404 Not Found` - Record not found
- `429 Too Many Requests` - Rate limit exceeded

---

### OPTIONS - Get Endpoint Metadata

```http
OPTIONS /api/v1/{entity}
```

**Description:** Get metadata about the entity and its schema.

**Example Request:**
```bash
curl -X OPTIONS "https://yourdomain.com/api/v1/tasks" \
  -H "Authorization: Bearer sk_live_abc123..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "entity": "tasks",
    "methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    "schema": {
      "id": { "type": "string", "required": false, "generated": true },
      "title": { "type": "string", "required": true, "maxLength": 200 },
      "description": { "type": "string", "required": false },
      "status": { "type": "enum", "values": ["todo", "in_progress", "completed"], "default": "todo" },
      "priority": { "type": "enum", "values": ["low", "medium", "high"], "default": "medium" },
      "assigneeId": { "type": "string", "required": false },
      "createdAt": { "type": "datetime", "required": false, "generated": true },
      "updatedAt": { "type": "datetime", "required": false, "generated": true }
    },
    "relations": {
      "assignee": { "type": "belongsTo", "entity": "users", "foreignKey": "assigneeId" },
      "comments": { "type": "hasMany", "entity": "comments", "foreignKey": "taskId" }
    },
    "permissions": {
      "read": true,
      "write": true,
      "delete": false
    },
    "rateLimit": {
      "limit": 1000,
      "window": "1h"
    }
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Missing or invalid authentication
- `404 Not Found` - Entity not found in registry

---

## System Endpoints

System endpoints provide core functionality like authentication, health checks, and API key management.

### Health Check

```http
GET /api/health
```

**Description:** Check API health status (no authentication required).

**Example Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Status Codes:**
- `200 OK` - API is healthy
- `503 Service Unavailable` - API is down

---

### Get API Keys (Dashboard)

```http
GET /api/v1/keys
```

**Description:** List all API keys for the authenticated user (session auth only).

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "key_abc123",
      "name": "Production API Key",
      "key": "sk_live_abc123...",
      "scopes": ["read", "write"],
      "createdAt": "2025-01-01T00:00:00Z",
      "lastUsedAt": "2025-01-15T10:30:00Z",
      "expiresAt": null
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated with session

---

### Create API Key (Dashboard)

```http
POST /api/v1/keys
```

**Description:** Create a new API key (session auth only).

**Request Body:**
```typescript
{
  name: string                    // Key name
  scopes: string[]               // Permissions: read, write, delete
  expiresAt?: string | null      // Optional expiration (ISO 8601)
}
```

**Example Request:**
```bash
curl -X POST "https://yourdomain.com/api/v1/keys" \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App Key",
    "scopes": ["read", "write"],
    "expiresAt": "2026-01-01T00:00:00Z"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_def456",
    "name": "Mobile App Key",
    "key": "sk_live_def456xyz...",
    "scopes": ["read", "write"],
    "createdAt": "2025-01-15T10:30:00Z",
    "expiresAt": "2026-01-01T00:00:00Z"
  },
  "warning": "Save this key securely. It will not be shown again."
}
```

**Status Codes:**
- `201 Created` - Success
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Not authenticated with session

---

### Revoke API Key (Dashboard)

```http
DELETE /api/v1/keys/{keyId}
```

**Description:** Revoke an API key (session auth only).

**Path Parameters:**
- `keyId` - API key ID

**Example Response:**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated with session
- `404 Not Found` - Key not found

---

## Custom Plugin Endpoints

Plugins can register custom endpoints that extend the API beyond auto-generated CRUD.

### Example: AI Text Generation

```http
POST /api/v1/ai/generate
```

**Description:** Generate text using AI (custom plugin endpoint).

**Request Body:**
```typescript
{
  prompt: string          // Text prompt
  maxTokens?: number     // Max tokens (default: 100)
  temperature?: number   // Creativity (0-1, default: 0.7)
}
```

**Example Request:**
```bash
curl -X POST "https://yourdomain.com/api/v1/ai/generate" \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a product description for wireless headphones",
    "maxTokens": 150,
    "temperature": 0.8
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "text": "Experience premium sound quality with our wireless headphones...",
    "tokensUsed": 142,
    "model": "gpt-4"
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid prompt
- `401 Unauthorized` - Missing or invalid authentication
- `402 Payment Required` - Insufficient credits
- `429 Too Many Requests` - Rate limit exceeded

---

## Response Format

All API responses follow a consistent format.

### Success Response

```typescript
{
  success: true
  data: any                    // Response data
  pagination?: {               // Only for LIST operations
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

### Error Response

```typescript
{
  success: false
  error: string                // Human-readable error message
  code: string                 // Machine-readable error code
  details?: Record<string, string>  // Field-level errors
}
```

**Example Error:**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "title": "Title is required",
    "status": "Must be one of: todo, in_progress, completed"
  }
}
```

---

## Error Codes

Complete list of error codes returned by the API.

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_FAILED` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `ENTITY_NOT_FOUND` | 404 | Entity not in registry |
| `INVALID_SCOPE` | 403 | Missing required scope |
| `EXPIRED_KEY` | 401 | API key has expired |
| `INVALID_FILTER` | 400 | Invalid filter syntax |
| `INVALID_SORT` | 400 | Invalid sort field |
| `DATABASE_ERROR` | 500 | Database operation failed |

See [Error Handling](./08-error-handling.md) for detailed error documentation.

---

## Rate Limiting

All endpoints are subject to rate limiting.

**Default Limits:**
- **API Key Auth:** 1,000 requests/hour per key
- **Session Auth:** 100 requests/hour per user

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

See [Rate Limiting](./07-rate-limiting.md) for detailed rate limit documentation.

---

## Next Steps

- [Query Parameters](./05-query-parameters.md) - Advanced filtering and pagination
- [Authentication](./02-authentication.md) - Detailed authentication guide
- [Error Handling](./08-error-handling.md) - Complete error handling documentation
- [Best Practices](./11-best-practices.md) - API best practices

**Documentation:** `core/docs/05-api/10-api-reference.md`
