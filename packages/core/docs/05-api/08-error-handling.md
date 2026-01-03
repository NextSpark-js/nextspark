# API Error Handling

**Standardized errors • HTTP status codes • Error codes • Recovery patterns**

---

## Table of Contents

- [Overview](#overview)
- [Error Response Format](#error-response-format)
- [HTTP Status Codes](#http-status-codes)
- [Error Code Catalog](#error-code-catalog)
- [Authentication Errors (401, 403)](#authentication-errors-401-403)
- [Validation Errors (400, 422)](#validation-errors-400-422)
- [Not Found Errors (404)](#not-found-errors-404)
- [Rate Limit Errors (429)](#rate-limit-errors-429)
- [Server Errors (500)](#server-errors-500)
- [Client-Side Error Handling](#client-side-error-handling)
- [Error Recovery Patterns](#error-recovery-patterns)
- [Debugging Errors](#debugging-errors)

---

## Overview

The API v1 uses **standardized error responses** across all endpoints. Every error includes:
- ✅ **Consistent format** - Same structure for all errors
- ✅ **HTTP status codes** - Standard RESTful status codes
- ✅ **Error codes** - Machine-readable error identifiers
- ✅ **Error messages** - Human-readable descriptions
- ✅ **Additional details** - Context-specific error information
- ✅ **Recovery hints** - Actionable guidance for clients

**Error Philosophy:**
- Errors are predictable and documented
- Status codes follow HTTP standards
- Error codes enable programmatic handling
- Messages are clear and actionable
- Details provide debugging context

---

## Error Response Format

### Standard Error Response

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {
    // Additional context (optional)
  }
}
```

### Example: Authentication Error

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

### Example: Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "name": "Name is required",
    "price": "Price must be a positive number",
    "status": "Status must be one of: active, inactive"
  }
}
```

### Example: Not Found Error

```json
{
  "success": false,
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

---

## HTTP Status Codes

### Success Codes (2xx)

| Code | Meaning | When Used |
|------|---------|-----------|
| **200** | OK | Successful GET, PATCH, DELETE |
| **201** | Created | Successful POST (resource created) |

### Client Error Codes (4xx)

| Code | Meaning | When Used |
|------|---------|-----------|
| **400** | Bad Request | Invalid request format, malformed JSON |
| **401** | Unauthorized | Missing or invalid authentication |
| **403** | Forbidden | Valid auth but insufficient permissions |
| **404** | Not Found | Resource or endpoint doesn't exist |
| **405** | Method Not Allowed | HTTP method not supported |
| **422** | Unprocessable Entity | Validation failed |
| **429** | Too Many Requests | Rate limit exceeded |

### Server Error Codes (5xx)

| Code | Meaning | When Used |
|------|---------|-----------|
| **500** | Internal Server Error | Unexpected server error |
| **503** | Service Unavailable | Server temporarily unavailable |

---

## Error Code Catalog

### Authentication & Authorization

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_FAILED` | 401 | Missing or invalid credentials |
| `INVALID_API_KEY` | 401 | API key is invalid or expired |
| `INVALID_SESSION` | 401 | Session is expired or invalid |
| `FORBIDDEN` | 403 | Valid auth but insufficient permissions |
| `INSUFFICIENT_PERMISSIONS` | 403 | Missing required scope |

### Validation

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_FAILED` | 422 | One or more fields failed validation |
| `INVALID_REQUEST` | 400 | Malformed request (invalid JSON, etc.) |
| `MISSING_REQUIRED_FIELD` | 422 | Required field not provided |
| `INVALID_FIELD_TYPE` | 422 | Field has wrong data type |
| `INVALID_ENUM_VALUE` | 422 | Value not in allowed enum |

### Resources

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `ENTITY_NOT_FOUND` | 404 | Entity type not registered |
| `METHOD_NOT_ALLOWED` | 405 | Operation not supported for entity |

### Rate Limiting

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in time window |

### Server Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `SERVICE_UNAVAILABLE` | 503 | Server temporarily unavailable |

---

## Authentication Errors (401, 403)

### 401 Unauthorized

**When it occurs:**
- No authentication credentials provided
- Invalid API key
- Expired or invalid session

**Error Response:**
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

**Example Scenarios:**

**1. Missing Authorization Header:**
```bash
# Request
GET /api/v1/products
# (no Authorization header)

# Response (401)
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

**2. Invalid API Key:**
```bash
# Request
GET /api/v1/products
Authorization: Bearer sk_invalid_key

# Response (401)
{
  "success": false,
  "error": "Invalid API key",
  "code": "INVALID_API_KEY"
}
```

**3. Expired Session:**
```bash
# Request
GET /api/v1/products
Cookie: session=expired_token

# Response (401)
{
  "success": false,
  "error": "Session expired",
  "code": "INVALID_SESSION"
}
```

### 403 Forbidden

**When it occurs:**
- Valid authentication but insufficient permissions
- Missing required scope
- Role-based access restriction

**Error Response:**
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

**Example Scenarios:**

**1. Missing Required Scope:**
```bash
# Request (API key has products:read but trying to write)
POST /api/v1/products
Authorization: Bearer sk_live_readonly_key
Content-Type: application/json

{"name": "New Product", "price": 29.99}

# Response (403)
{
  "success": false,
  "error": "Missing required scope: products:write",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

**2. User-Scoped Resource Access:**
```bash
# Request (trying to access another user's resource)
GET /api/v1/products/other-user-product-id
Authorization: Bearer sk_live_abc123

# Response (403)
{
  "success": false,
  "error": "Access denied to this resource",
  "code": "FORBIDDEN"
}
```

---

## Validation Errors (400, 422)

### 400 Bad Request

**When it occurs:**
- Malformed JSON
- Invalid request format
- Missing Content-Type header

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid request format",
  "code": "INVALID_REQUEST"
}
```

**Example:**
```bash
# Request (malformed JSON)
POST /api/v1/products
Authorization: Bearer sk_live_abc123
Content-Type: application/json

{
  "name": "Product",
  "price": 29.99,  # Trailing comma
}

# Response (400)
{
  "success": false,
  "error": "Invalid JSON format",
  "code": "INVALID_REQUEST"
}
```

### 422 Unprocessable Entity

**When it occurs:**
- Valid JSON but fails field validation
- Missing required fields
- Invalid field types
- Values outside allowed range

**Error Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "field1": "Error message for field1",
    "field2": "Error message for field2"
  }
}
```

**Example Scenarios:**

**1. Missing Required Field:**
```bash
# Request
POST /api/v1/products
Authorization: Bearer sk_live_abc123
Content-Type: application/json

{
  "price": 29.99
  # Missing required 'name' field
}

# Response (422)
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "name": "Name is required"
  }
}
```

**2. Invalid Field Type:**
```bash
# Request
POST /api/v1/products
Authorization: Bearer sk_live_abc123
Content-Type: application/json

{
  "name": "Product",
  "price": "not-a-number"  // Should be number
}

# Response (422)
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "price": "Price must be a number"
  }
}
```

**3. Value Out of Range:**
```bash
# Request
POST /api/v1/products
Authorization: Bearer sk_live_abc123
Content-Type: application/json

{
  "name": "Product",
  "price": -10  // Negative price not allowed
}

# Response (422)
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "price": "Price must be a positive number"
  }
}
```

**4. Invalid Enum Value:**
```bash
# Request
POST /api/v1/products
Authorization: Bearer sk_live_abc123
Content-Type: application/json

{
  "name": "Product",
  "price": 29.99,
  "status": "pending"  // Only 'active' or 'inactive' allowed
}

# Response (422)
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "status": "Status must be one of: active, inactive"
  }
}
```

**5. Multiple Validation Errors:**
```bash
# Request
POST /api/v1/products
Authorization: Bearer sk_live_abc123
Content-Type: application/json

{
  "name": "",  // Empty (required)
  "price": -10,  // Negative (invalid)
  "status": "wrong"  // Invalid enum
}

# Response (422)
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "name": "Name is required",
    "price": "Price must be a positive number",
    "status": "Status must be one of: active, inactive"
  }
}
```

---

## Not Found Errors (404)

### Resource Not Found

**When it occurs:**
- Requested resource doesn't exist
- Invalid resource ID
- Resource was deleted

**Error Response:**
```json
{
  "success": false,
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

**Example:**
```bash
# Request
GET /api/v1/products/nonexistent-id
Authorization: Bearer sk_live_abc123

# Response (404)
{
  "success": false,
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

### Entity Not Found

**When it occurs:**
- Entity type not registered in registry
- Typo in entity name

**Error Response:**
```json
{
  "success": false,
  "error": "Entity not found",
  "code": "ENTITY_NOT_FOUND"
}
```

**Example:**
```bash
# Request
GET /api/v1/nonexistent-entity
Authorization: Bearer sk_live_abc123

# Response (404)
{
  "success": false,
  "error": "Entity not found",
  "code": "ENTITY_NOT_FOUND"
}
```

---

## Rate Limit Errors (429)

**When it occurs:**
- Too many requests in time window
- Rate limit exceeded for API key or user

**Error Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

**Headers:**
```text
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642435200
Retry-After: 60
```

**Example:**
```bash
# Request (1001st request in 1 minute)
GET /api/v1/products
Authorization: Bearer sk_live_abc123

# Response (429)
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 60 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

**Client Handling:**
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60
  console.log(`Rate limited. Retrying after ${retryAfter}s...`)
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
  // Retry request
}
```

---

## Server Errors (500)

### 500 Internal Server Error

**When it occurs:**
- Unexpected server error
- Unhandled exception
- Database connection failure

**Error Response:**
```json
{
  "success": false,
  "error": "An unexpected error occurred",
  "code": "INTERNAL_SERVER_ERROR"
}
```

**Example:**
```bash
# Request
GET /api/v1/products
Authorization: Bearer sk_live_abc123

# Response (500)
{
  "success": false,
  "error": "An unexpected error occurred. Please try again later.",
  "code": "INTERNAL_SERVER_ERROR"
}
```

**Client Handling:**
- Retry with exponential backoff
- Log error for debugging
- Show user-friendly error message

### 503 Service Unavailable

**When it occurs:**
- Server under maintenance
- Temporary outage
- Database unavailable

**Error Response:**
```json
{
  "success": false,
  "error": "Service temporarily unavailable",
  "code": "SERVICE_UNAVAILABLE"
}
```

**Headers:**
```text
Retry-After: 300
```

---

## Client-Side Error Handling

### TypeScript Error Handler

```typescript
interface ApiError {
  success: false
  error: string
  code: string
  details?: Record<string, string>
}

interface ApiSuccess<T> {
  success: true
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type ApiResponse<T> = ApiSuccess<T> | ApiError

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  const result: ApiResponse<T> = await response.json()

  if (!result.success) {
    throw new ApiErrorClass(result.error, result.code, response.status, result.details)
  }

  return result.data
}

class ApiErrorClass extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, string>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Usage
try {
  const products = await fetchApi<Product[]>('/api/v1/products')
  console.log('Products:', products)
} catch (error) {
  if (error instanceof ApiErrorClass) {
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login'
    } else if (error.status === 422 && error.details) {
      // Show validation errors
      Object.entries(error.details).forEach(([field, message]) => {
        showFieldError(field, message)
      })
    } else {
      // Show generic error
      showError(error.message)
    }
  }
}
```

### React Hook for API Calls

```typescript
import { useState } from 'react'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
}

function useApi<T>(endpoint: string, options?: RequestInit) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    fetchApi<T>(endpoint, options)
      .then(data => setState({ data, loading: false, error: null }))
      .catch(error => setState({ data: null, loading: false, error }))
  }, [endpoint])

  return state
}

// Usage
function ProductList() {
  const { data, loading, error } = useApi<Product[]>('/api/v1/products')

  if (loading) return <div>Loading...</div>
  if (error) {
    if (error.code === 'AUTHENTICATION_FAILED') {
      return <div>Please log in to view products.</div>
    }
    return <div>Error: {error.error}</div>
  }

  return (
    <div>
      {data?.map(product => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  )
}
```

---

## Error Recovery Patterns

### Pattern 1: Retry with Exponential Backoff

```typescript
async function fetchWithRetry<T>(
  endpoint: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchApi<T>(endpoint, options)
    } catch (error) {
      lastError = error as Error

      // Don't retry client errors (4xx)
      if (error instanceof ApiErrorClass && error.status < 500) {
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}
```

### Pattern 2: Graceful Degradation

```typescript
async function fetchProductsWithFallback(): Promise<Product[]> {
  try {
    return await fetchApi<Product[]>('/api/v1/products')
  } catch (error) {
    console.error('Failed to fetch products:', error)

    // Return cached data
    const cached = localStorage.getItem('products')
    if (cached) {
      return JSON.parse(cached)
    }

    // Return empty array as last resort
    return []
  }
}
```

### Pattern 3: User-Friendly Error Messages

```typescript
function getErrorMessage(error: ApiErrorClass): string {
  switch (error.code) {
    case 'AUTHENTICATION_FAILED':
      return 'Please log in to continue.'
    case 'INSUFFICIENT_PERMISSIONS':
      return 'You don't have permission to perform this action.'
    case 'VALIDATION_FAILED':
      return 'Please check the form and correct any errors.'
    case 'NOT_FOUND':
      return 'The requested item could not be found.'
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too many requests. Please wait a moment and try again.'
    case 'INTERNAL_SERVER_ERROR':
      return 'An unexpected error occurred. Please try again later.'
    default:
      return error.message || 'An error occurred. Please try again.'
  }
}
```

### Pattern 4: Form Validation Errors

```typescript
function handleValidationError(error: ApiErrorClass) {
  if (error.code === 'VALIDATION_FAILED' && error.details) {
    // Map API errors to form fields
    const formErrors: Record<string, string> = {}

    Object.entries(error.details).forEach(([field, message]) => {
      formErrors[field] = message
    })

    return formErrors
  }

  return {}
}

// Usage with React Hook Form
const { setError } = useForm()

try {
  await createProduct(data)
} catch (error) {
  if (error instanceof ApiErrorClass) {
    const formErrors = handleValidationError(error)

    Object.entries(formErrors).forEach(([field, message]) => {
      setError(field as any, { message })
    })
  }
}
```

---

## Debugging Errors

### Enable Detailed Logging

```typescript
// Add logging middleware
async function fetchApiWithLogging<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  console.group(`API Request: ${options.method || 'GET'} ${endpoint}`)
  console.log('Options:', options)

  try {
    const response = await fetch(endpoint, options)
    console.log('Status:', response.status)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))

    const result = await response.json()
    console.log('Response:', result)

    if (!result.success) {
      console.error('Error:', result)
      throw new ApiErrorClass(result.error, result.code, response.status, result.details)
    }

    console.groupEnd()
    return result.data
  } catch (error) {
    console.error('Exception:', error)
    console.groupEnd()
    throw error
  }
}
```

### Check Server Logs

```bash
# View API logs in development
npm run dev

# Look for error messages
[API] Error in GET /api/v1/products: VALIDATION_FAILED
[API] Details: { "price": "Price must be a positive number" }
```

### Common Debug Checklist

**Authentication Issues:**
- [ ] API key format correct (`sk_{env}_{64 hex chars}`)
- [ ] Authorization header present
- [ ] Key not expired
- [ ] Key has required scopes

**Validation Issues:**
- [ ] Request body is valid JSON
- [ ] All required fields provided
- [ ] Field types match entity config
- [ ] Values within allowed ranges
- [ ] Enum values are valid

**Not Found Issues:**
- [ ] Resource ID is correct
- [ ] Resource exists in database
- [ ] User has access (RLS)
- [ ] Entity name matches slug

**Performance Issues:**
- [ ] Using pagination
- [ ] Not fetching too much data
- [ ] Database indexes exist
- [ ] No N+1 queries

---

## Summary

**Error Handling provides:**
- ✅ **Standardized format** - Consistent across all endpoints
- ✅ **HTTP status codes** - Standard RESTful codes
- ✅ **Error codes** - Machine-readable identifiers
- ✅ **Detailed messages** - Human-readable descriptions
- ✅ **Validation details** - Field-level error information
- ✅ **Recovery patterns** - Retry, fallback, degradation
- ✅ **Client libraries** - TypeScript error handling utilities

**Error Categories:**
- **4xx Client Errors** - Authentication, validation, not found
- **5xx Server Errors** - Internal errors, service unavailable

**Best Practices:**
- Always check `success` field in responses
- Handle validation errors at field level
- Implement retry logic for server errors
- Show user-friendly error messages
- Log errors for debugging
- Use exponential backoff for retries

**Next Steps:**
- [API Reference](./10-api-reference.md) - Complete endpoint catalog
- [Troubleshooting](./18-troubleshooting.md) - Common issues and solutions
- [Authentication](./02-authentication.md) - Authentication error details
- [Dynamic Endpoints](./03-dynamic-endpoints.md) - Validation error details

**Documentation:** `core/docs/05-api/08-error-handling.md`
