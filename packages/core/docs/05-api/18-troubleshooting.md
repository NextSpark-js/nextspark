# API Troubleshooting

**Common issues • Debugging strategies • Solutions • Error resolution**

---

## Table of Contents

- [Overview](#overview)
- [Authentication Issues](#authentication-issues)
- [Request Errors](#request-errors)
- [Performance Problems](#performance-problems)
- [Data Issues](#data-issues)
- [Rate Limiting](#rate-limiting)
- [Debugging Tools](#debugging-tools)

---

## Overview

**Quick solutions** for common API v1 issues.

**Troubleshooting Strategy:**
1. Check error response code
2. Review error details
3. Verify authentication
4. Check request format
5. Review server logs
6. Test with curl/Postman

---

## Authentication Issues

### 401 Unauthorized

**Problem:** API returns 401 status code.

**Common Causes:**
- Missing or invalid API key
- Expired session
- Incorrect Authorization header format

**Solutions:**

```bash
# ❌ WRONG: Missing Bearer prefix
curl -H "Authorization: sk_test_abc123" \
  https://yourdomain.com/api/v1/tasks

# ✅ CORRECT: Proper Authorization header
curl -H "Authorization: Bearer sk_test_abc123" \
  https://yourdomain.com/api/v1/tasks

# ❌ WRONG: API key in URL
curl https://yourdomain.com/api/v1/tasks?apiKey=sk_test_abc123

# ✅ CORRECT: API key in header
curl -H "Authorization: Bearer sk_test_abc123" \
  https://yourdomain.com/api/v1/tasks
```

**Verify API Key:**
```typescript
// Check if API key is valid
const response = await fetch('/api/v1/tasks', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
})

if (response.status === 401) {
  console.error('Invalid API key')
  // Generate new API key in dashboard
}
```

---

### 403 Forbidden

**Problem:** API returns 403 status code.

**Common Causes:**
- Insufficient permissions (scope mismatch)
- Organization access denied
- Feature not enabled for account

**Solutions:**

```typescript
// Check API key scopes
const keyInfo = await fetch('/api/v1/api-keys/current', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})

const data = await keyInfo.json()
console.log('Scopes:', data.scopes)
// Expected: ['read', 'write', 'delete']

// If missing required scope, create new key with correct permissions
```

**Scope Requirements:**
- **GET requests** - Require `read` scope
- **POST/PATCH requests** - Require `write` scope
- **DELETE requests** - Require `delete` scope

---

### Session Expired

**Problem:** Session cookie expired during request.

**Solution:**

```typescript
// Implement session refresh
async function fetchWithSessionRefresh(url: string, options: RequestInit) {
  let response = await fetch(url, options)

  if (response.status === 401) {
    // Try refreshing session
    await fetch('/api/auth/refresh', { method: 'POST' })

    // Retry original request
    response = await fetch(url, options)
  }

  return response
}
```

---

## Request Errors

### 400 Bad Request - Invalid JSON

**Problem:** Malformed JSON in request body.

**Common Causes:**
- Missing quotes around keys
- Trailing commas
- Single quotes instead of double quotes
- Invalid escape sequences

**Solutions:**

```typescript
// ❌ WRONG: Invalid JSON
const badJson = `{
  title: 'Task 1',  // Missing quotes around key
  status: "todo",   // Trailing comma
}`

// ✅ CORRECT: Valid JSON
const goodJson = JSON.stringify({
  title: 'Task 1',
  status: 'todo'
})

// Always use JSON.stringify()
const response = await fetch('/api/v1/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

---

### 400 Bad Request - Validation Error

**Problem:** Request data fails validation.

**Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "title": "Title is required",
    "status": "Must be one of: todo, in_progress, completed"
  }
}
```

**Solution:**

```typescript
// Check validation errors
try {
  const response = await api.create('tasks', data)
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Display field-specific errors
    Object.entries(error.details).forEach(([field, message]) => {
      showFieldError(field, message)
    })
  }
}

// Validate data before sending
import { z } from 'zod'

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high'])
})

// Validate
const result = taskSchema.safeParse(data)
if (!result.success) {
  console.error('Validation errors:', result.error.errors)
}
```

---

### 404 Not Found

**Problem:** Entity or endpoint not found.

**Common Causes:**
- Incorrect entity ID
- Entity deleted
- Wrong endpoint URL
- Entity belongs to different user/organization

**Solutions:**

```typescript
// Check if entity exists
const response = await fetch('/api/v1/tasks/tsk_abc123', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})

if (response.status === 404) {
  const error = await response.json()
  console.log('Not found:', error.error)

  // Possible causes:
  // 1. ID is wrong
  // 2. Entity was deleted
  // 3. Entity belongs to different organization
}

// List all entities to verify
const list = await fetch('/api/v1/tasks', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
const { data } = await list.json()
console.log('Available task IDs:', data.map(t => t.id))
```

---

### 413 Payload Too Large

**Problem:** Request body exceeds size limit.

**Default Limits:**
- JSON body: 1MB
- File upload: 10MB

**Solutions:**

```typescript
// Compress large payloads
import pako from 'pako'

const largeData = { /* large object */ }
const compressed = pako.deflate(JSON.stringify(largeData))

const response = await fetch('/api/v1/tasks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Encoding': 'gzip',
    'Authorization': `Bearer ${apiKey}`
  },
  body: compressed
})

// Or split into multiple requests
const chunks = chunkArray(largeDataArray, 100)

for (const chunk of chunks) {
  await api.bulkCreate('tasks', chunk)
}
```

---

## Performance Problems

### Slow Requests

**Problem:** API requests taking too long (>2 seconds).

**Diagnosis:**

```typescript
// Measure request timing
const start = Date.now()

const response = await fetch('/api/v1/tasks?page=1&limit=1000')

const duration = Date.now() - start
console.log(`Request took ${duration}ms`)

// Check Server-Timing header
const serverTiming = response.headers.get('Server-Timing')
console.log('Server timing:', serverTiming)
// Example: "db;dur=1234, total;dur=1456"
```

**Common Causes:**
1. **Large page size** - Requesting too many items
2. **Complex filters** - Multiple nested filters
3. **Missing indexes** - Database queries not optimized
4. **N+1 queries** - Loading related data inefficiently

**Solutions:**

```typescript
// ❌ SLOW: Requesting 1000 items
const response = await api.list('tasks', { limit: 1000 })

// ✅ FAST: Use pagination
const response = await api.list('tasks', { limit: 20, page: 1 })

// ❌ SLOW: Complex filter
const filter = {
  $or: [
    { status: 'todo', priority: 'high' },
    { status: 'in_progress', assigneeId: { $null: false } }
  ]
}

// ✅ FAST: Simplified filter
const filter = { status: { $in: ['todo', 'in_progress'] } }

// Use cursor-based pagination for large datasets
const response = await fetch('/api/v1/tasks?cursor=tsk_abc123&limit=20')
```

---

### Timeout Errors

**Problem:** Request times out before completing.

**Default Timeout:** 30 seconds

**Solutions:**

```typescript
// Increase timeout for specific requests
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 60000) // 60s

try {
  const response = await fetch('/api/v1/tasks', {
    signal: controller.signal
  })
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Request timed out')
  }
} finally {
  clearTimeout(timeout)
}

// For long-running operations, use async jobs
const job = await fetch('/api/v1/jobs', {
  method: 'POST',
  body: JSON.stringify({
    operation: 'export_tasks',
    format: 'csv'
  })
})

// Poll for completion
const jobId = job.data.id
const result = await pollUntilComplete(`/api/v1/jobs/${jobId}`)
```

---

## Data Issues

### Missing Fields in Response

**Problem:** Expected fields not in API response.

**Diagnosis:**

```typescript
// Check which fields are returned
const response = await api.get('tasks', 'tsk_abc123')
console.log('Fields:', Object.keys(response.data))

// Request specific fields
const response = await fetch(
  '/api/v1/tasks/tsk_abc123?fields=id,title,status,assignee'
)
```

**Common Causes:**
- Field selection query parameter
- Field removed from schema
- Permission restriction

---

### Inconsistent Data

**Problem:** Data appears inconsistent or outdated.

**Solutions:**

```typescript
// Force cache bypass
const response = await fetch('/api/v1/tasks', {
  headers: {
    'Cache-Control': 'no-cache',
    'Authorization': `Bearer ${apiKey}`
  }
})

// Check ETag for cache validation
const etag = response.headers.get('ETag')
console.log('ETag:', etag)

// If using TanStack Query, invalidate cache
queryClient.invalidateQueries({ queryKey: ['tasks'] })

// Or refetch
queryClient.refetchQueries({ queryKey: ['tasks'] })
```

---

### Duplicate Entries

**Problem:** Creating duplicate entities.

**Diagnosis:**

```bash
# Check for duplicates
curl -X GET "https://yourdomain.com/api/v1/tasks?filter={\"title\":\"My Task\"}" \
  -H "Authorization: Bearer sk_test_abc123"
```

**Solutions:**

```typescript
// Use idempotency key
const response = await fetch('/api/v1/tasks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Idempotency-Key': 'unique-key-123'
  },
  body: JSON.stringify(data)
})

// Check for existing before creating
const existing = await api.list('tasks', {
  filter: { title: data.title }
})

if (existing.data.length === 0) {
  await api.create('tasks', data)
}
```

---

## Rate Limiting

### 429 Too Many Requests

**Problem:** Exceeded rate limits.

**Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 3600
}
```

**Solutions:**

```typescript
// Implement retry with backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options)

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      console.log(`Rate limited. Retrying in ${retryAfter}s`)

      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
      continue
    }

    return response
  }

  throw new Error('Max retries exceeded')
}

// Add delay between requests
async function batchWithDelay(items: any[], delay = 100) {
  const results = []

  for (const item of items) {
    results.push(await api.create('tasks', item))
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  return results
}

// Use bulk endpoints instead
await api.bulkCreate('tasks', items)
```

---

## Debugging Tools

### cURL Testing

```bash
# Basic GET request
curl -X GET "https://yourdomain.com/api/v1/tasks" \
  -H "Authorization: Bearer sk_test_abc123" \
  -v  # Verbose output

# POST request with JSON
curl -X POST "https://yourdomain.com/api/v1/tasks" \
  -H "Authorization: Bearer sk_test_abc123" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Task","status":"todo"}' \
  -v

# Include response headers
curl -i -X GET "https://yourdomain.com/api/v1/tasks" \
  -H "Authorization: Bearer sk_test_abc123"

# Save response to file
curl -X GET "https://yourdomain.com/api/v1/tasks" \
  -H "Authorization: Bearer sk_test_abc123" \
  -o response.json
```

### Request Logging

```typescript
// Log all API requests
const originalFetch = window.fetch

window.fetch = async (...args) => {
  const [url, options] = args

  console.group(`API Request: ${options?.method || 'GET'} ${url}`)
  console.log('Headers:', options?.headers)
  console.log('Body:', options?.body)

  const start = Date.now()
  const response = await originalFetch(...args)
  const duration = Date.now() - start

  console.log('Status:', response.status)
  console.log('Duration:', `${duration}ms`)
  console.groupEnd()

  return response
}
```

### Network Inspector

**Chrome DevTools:**
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Click request to see details
5. Check Headers, Preview, Response, Timing

**Common Checks:**
- Request headers (Authorization, Content-Type)
- Response status code
- Response body
- Timing (DNS, SSL, Request, Response)

---

### API Key Testing

```typescript
// Test API key validity
async function testApiKey(apiKey: string) {
  try {
    const response = await fetch('/api/v1/api-keys/current', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ API key valid')
      console.log('Scopes:', data.scopes)
      console.log('Expires:', data.expiresAt)
      return true
    } else {
      console.error('❌ API key invalid')
      return false
    }
  } catch (error) {
    console.error('❌ API key test failed:', error)
    return false
  }
}
```

---

### Health Check

```bash
# Check API health
curl https://yourdomain.com/api/health

# Expected response
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 123456,
  "database": "connected"
}
```

---

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `UNAUTHORIZED` | Missing/invalid auth | Check API key or session |
| `FORBIDDEN` | Insufficient permissions | Check scopes/permissions |
| `VALIDATION_ERROR` | Invalid request data | Check error.details |
| `NOT_FOUND` | Entity not found | Verify entity ID |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |
| `SERVER_ERROR` | Internal server error | Check logs, contact support |
| `INVALID_FILTER` | Malformed filter | Check filter syntax |
| `INVALID_PAGINATION` | Invalid page/limit | Use valid values |

---

## Getting Help

**Documentation:**
- [API Reference](./10-api-reference.md) - Complete endpoint docs
- [Integration Examples](./09-integration-examples.md) - Working code examples
- [Best Practices](./11-best-practices.md) - Recommended patterns

**Support Channels:**
- GitHub Issues: Report bugs and feature requests
- Discord Community: Get help from other developers
- Email Support: support@yourdomain.com

**When Reporting Issues:**
1. Include error code and message
2. Provide request/response examples
3. Specify API version
4. Include relevant logs
5. Describe expected vs actual behavior

**Documentation:** `core/docs/05-api/18-troubleshooting.md`
