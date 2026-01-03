# API Best Practices

**Production-ready patterns • Security • Performance • Error handling • Versioning**

---

## Table of Contents

- [Overview](#overview)
- [API Design Principles](#api-design-principles)
- [Authentication and Security](#authentication-and-security)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Pagination and Filtering](#pagination-and-filtering)
- [Versioning Strategy](#versioning-strategy)
- [Documentation Standards](#documentation-standards)
- [Testing Best Practices](#testing-best-practices)
- [Production Checklist](#production-checklist)

---

## Overview

This guide documents **production-ready best practices** for the API v1 system, covering:

- ✅ **RESTful design** principles
- ✅ **Security** hardening
- ✅ **Performance** optimization
- ✅ **Error handling** patterns
- ✅ **Testing** strategies
- ✅ **Production** readiness

**Follow these practices** to build robust, scalable APIs.

---

## API Design Principles

### 1. Use RESTful Conventions

**✅ DO: Follow HTTP verbs correctly**
```typescript
GET    /api/v1/tasks          // List tasks
POST   /api/v1/tasks          // Create task
GET    /api/v1/tasks/:id      // Get single task
PATCH  /api/v1/tasks/:id      // Update task
DELETE /api/v1/tasks/:id      // Delete task
```

**❌ DON'T: Use non-RESTful verbs**
```typescript
❌ POST /api/v1/tasks/get
❌ GET  /api/v1/tasks/create
❌ POST /api/v1/tasks/:id/update
```

---

### 2. Use Plural Nouns for Resources

**✅ DO:**
```typescript
/api/v1/tasks
/api/v1/users
/api/v1/products
```

**❌ DON'T:**
```typescript
❌ /api/v1/task
❌ /api/v1/user
❌ /api/v1/product
```

---

### 3. Use Consistent Response Format

**✅ DO: Standardize all responses**
```typescript
// Success response
{
  "success": true,
  "data": { /* ... */ }
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**❌ DON'T: Mix response formats**
```typescript
❌ { "data": { /* ... */ } }        // Missing success field
❌ { "error": { /* ... */ } }        // Missing success field
❌ { "ok": true, "result": {} }     // Non-standard fields
```

---

### 4. Version Your API

**✅ DO: Use URL versioning**
```typescript
/api/v1/tasks
/api/v2/tasks
```

**Benefits:**
- Clear version boundaries
- Easy to maintain multiple versions
- Clients can opt-in to new versions

**❌ DON'T: Use header versioning (less explicit)**
```typescript
❌ GET /api/tasks
   Accept: application/vnd.api+json;version=2
```

---

### 5. Use Proper HTTP Status Codes

**Success codes:**
```typescript
200 OK           // Successful GET, PATCH, DELETE
201 Created      // Successful POST
204 No Content   // Successful DELETE (no response body)
```

**Client error codes:**
```typescript
400 Bad Request        // Invalid request (validation error)
401 Unauthorized       // Missing/invalid authentication
403 Forbidden          // Insufficient permissions
404 Not Found          // Resource not found
422 Unprocessable      // Valid syntax but semantic error
429 Too Many Requests  // Rate limit exceeded
```

**Server error codes:**
```typescript
500 Internal Server Error   // Unexpected server error
503 Service Unavailable     // Temporary outage
```

---

## Authentication and Security

### 1. Always Use HTTPS

**✅ DO: Enforce HTTPS in production**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Redirect HTTP to HTTPS
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    return NextResponse.redirect(
      `https://${request.headers.get('host')}${request.nextUrl.pathname}`,
      301
    )
  }
}
```

**❌ DON'T: Allow HTTP in production**

---

### 2. Validate API Keys Securely

**✅ DO: Hash API keys in database**
```typescript
import crypto from 'crypto'

export function hashApiKey(key: string): string {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex')
}

// Store only hash in database
await db.insert('api_keys', {
  hash: hashApiKey(apiKey),
  userId,
  scopes
})

// Validate by comparing hashes
const keyHash = hashApiKey(providedKey)
const storedKey = await db.findOne('api_keys', { hash: keyHash })
```

**❌ DON'T: Store plain text API keys**
```typescript
❌ await db.insert('api_keys', { key: apiKey })
```

---

### 3. Implement Rate Limiting

**✅ DO: Rate limit all endpoints**
```typescript
export async function checkRateLimit(
  userId: string,
  endpoint: string
) {
  const limit = 1000  // requests per hour
  const window = 3600 // 1 hour in seconds

  const count = await redis.incr(`rate_limit:${userId}:${endpoint}`)

  if (count === 1) {
    await redis.expire(`rate_limit:${userId}:${endpoint}`, window)
  }

  if (count > limit) {
    throw new Error('Rate limit exceeded')
  }

  return {
    limit,
    remaining: limit - count,
    reset: Date.now() + (window * 1000)
  }
}
```

---

### 4. Sanitize All Inputs

**✅ DO: Validate and sanitize**
```typescript
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(10000).trim().optional(),
  status: z.enum(['todo', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']).optional()
})

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Validate and sanitize
  const validated = createTaskSchema.parse(body)

  // Use validated data
  const task = await createTask(validated)

  return NextResponse.json({ success: true, data: task })
}
```

**❌ DON'T: Trust user input**
```typescript
❌ const { title, description } = await request.json()
❌ await db.insert('tasks', { title, description })  // No validation!
```

---

### 5. Implement Scope-Based Permissions

**✅ DO: Check scopes before operations**
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request)

  // Check for delete scope
  if (!auth.scopes.includes('delete')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions', code: 'INVALID_SCOPE' },
      { status: 403 }
    )
  }

  // Proceed with delete
  await deleteTask(params.id)

  return NextResponse.json({ success: true })
}
```

---

## Error Handling

### 1. Use Consistent Error Format

**✅ DO: Standardize error responses**
```typescript
interface ApiError {
  success: false
  error: string           // Human-readable message
  code: string           // Machine-readable code
  details?: Record<string, string>  // Field-level errors
}

// Example
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "title": "Title is required",
    "priority": "Must be one of: low, medium, high"
  }
}
```

---

### 2. Provide Helpful Error Messages

**✅ DO: Be specific and actionable**
```typescript
{
  "success": false,
  "error": "Task not found with ID 'tsk_abc123'",
  "code": "TASK_NOT_FOUND"
}
```

**❌ DON'T: Be vague**
```typescript
❌ { "error": "Not found" }
❌ { "error": "Invalid request" }
❌ { "error": "Error" }
```

---

### 3. Handle Errors Gracefully

**✅ DO: Catch and format all errors**
```typescript
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const tasks = await getTasks(auth.user.id)

    return NextResponse.json({
      success: true,
      data: tasks
    })
  } catch (error) {
    // Log error for debugging
    console.error('Error fetching tasks:', error)

    // Return user-friendly error
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired API key',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }

    // Default error
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
```

**❌ DON'T: Expose internal errors**
```typescript
❌ return NextResponse.json({ error: error.stack })
❌ return NextResponse.json({ error: error.message })  // May leak sensitive info
```

---

## Performance Optimization

### 1. Paginate Large Datasets

**✅ DO: Always paginate**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  const offset = (page - 1) * limit

  const tasks = await db.query(
    'SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  )

  const total = await db.count('tasks')

  return NextResponse.json({
    success: true,
    data: tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  })
}
```

**❌ DON'T: Return all records**
```typescript
❌ const tasks = await db.query('SELECT * FROM tasks')  // Could be 100k+ records!
```

---

### 2. Use Database Indexes

**✅ DO: Index frequently queried fields**
```sql
-- Index foreign keys
CREATE INDEX idx_tasks_user_id ON tasks(user_id);

-- Index commonly filtered fields
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);

-- Index commonly sorted fields
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
```

---

### 3. Implement Caching

**✅ DO: Cache frequently accessed data**
```typescript
import { redis } from '@/lib/redis'

export async function getTask(taskId: string) {
  // Check cache first
  const cached = await redis.get(`task:${taskId}`)
  if (cached) {
    return JSON.parse(cached)
  }

  // Fetch from database
  const task = await db.findOne('tasks', { id: taskId })

  // Cache for 1 hour
  await redis.setex(`task:${taskId}`, 3600, JSON.stringify(task))

  return task
}
```

**Cache invalidation:**
```typescript
export async function updateTask(taskId: string, data: any) {
  // Update database
  await db.update('tasks', { id: taskId }, data)

  // Invalidate cache
  await redis.del(`task:${taskId}`)

  return getTask(taskId)  // Returns fresh data
}
```

---

### 4. Use Field Selection

**✅ DO: Allow clients to request specific fields**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fields = searchParams.get('fields')?.split(',') || ['*']

  // Build SELECT query
  const select = fields.includes('*')
    ? '*'
    : fields.join(', ')

  const tasks = await db.query(`SELECT ${select} FROM tasks`)

  return NextResponse.json({ success: true, data: tasks })
}

// Usage
// GET /api/v1/tasks?fields=id,title,status
// Returns only: { id, title, status }
```

**Benefits:**
- Smaller response payloads
- Reduced bandwidth usage
- Faster JSON parsing

---

## Pagination and Filtering

### 1. Support Multiple Filter Operators

**✅ DO: Provide flexible filtering**
```typescript
interface FilterOperators {
  $eq?: any           // Equals
  $ne?: any           // Not equals
  $gt?: any           // Greater than
  $gte?: any          // Greater than or equal
  $lt?: any           // Less than
  $lte?: any          // Less than or equal
  $in?: any[]         // In array
  $nin?: any[]        // Not in array
  $contains?: string  // Contains substring
}

// Example usage
// GET /api/v1/tasks?filter={"status":{"$in":["todo","in_progress"]},"priority":"high"}
```

---

### 2. Support Sorting

**✅ DO: Allow sorting by any field**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') || 'createdAt'
  const order = searchParams.get('order') || 'desc'

  // Validate sort field (prevent SQL injection)
  const allowedSortFields = ['id', 'createdAt', 'updatedAt', 'priority', 'status']
  if (!allowedSortFields.includes(sort)) {
    return NextResponse.json(
      { success: false, error: 'Invalid sort field', code: 'INVALID_SORT' },
      { status: 400 }
    )
  }

  const tasks = await db.query(
    `SELECT * FROM tasks ORDER BY ${sort} ${order === 'asc' ? 'ASC' : 'DESC'}`
  )

  return NextResponse.json({ success: true, data: tasks })
}
```

---

### 3. Support Full-Text Search

**✅ DO: Implement search across text fields**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')

  if (search) {
    // PostgreSQL full-text search
    const tasks = await db.query(
      `SELECT * FROM tasks
       WHERE to_tsvector('english', title || ' ' || description)
       @@ plainto_tsquery('english', ?)`,
      [search]
    )

    return NextResponse.json({ success: true, data: tasks })
  }

  // Regular query if no search
  const tasks = await db.query('SELECT * FROM tasks')
  return NextResponse.json({ success: true, data: tasks })
}
```

---

## Versioning Strategy

### 1. Plan for Breaking Changes

**✅ DO: Version breaking changes**
```typescript
// v1 - Original API
GET /api/v1/tasks
{
  "id": "tsk_abc123",
  "name": "Task name"
}

// v2 - Breaking change (renamed field)
GET /api/v2/tasks
{
  "id": "tsk_abc123",
  "title": "Task title"  // Changed from "name" to "title"
}
```

**Maintain v1 while rolling out v2:**
```typescript
// app/api/v1/tasks/route.ts
export async function GET() {
  const tasks = await getTasks()
  return NextResponse.json({
    success: true,
    data: tasks.map(t => ({ id: t.id, name: t.title }))  // Map to old format
  })
}

// app/api/v2/tasks/route.ts
export async function GET() {
  const tasks = await getTasks()
  return NextResponse.json({
    success: true,
    data: tasks  // New format
  })
}
```

---

### 2. Deprecation Strategy

**✅ DO: Announce deprecations in advance**
```http
# Add deprecation header
Deprecation: true
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
Link: </docs/migration-guide-v2>; rel="deprecation"

{
  "success": true,
  "data": [...],
  "warning": "This API version will be deprecated on 2025-12-31. Please migrate to /api/v2"
}
```

---

## Documentation Standards

### 1. Document All Endpoints

**✅ DO: Provide comprehensive documentation**
```markdown
## GET /api/v1/tasks

List all tasks for the authenticated user.

**Authentication:** Required (API Key or Session)

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Results per page (default: 20, max: 100)
- `filter` (object, optional) - Filter criteria
- `sort` (string, optional) - Sort field (default: createdAt)
- `order` (string, optional) - Sort order: asc or desc (default: desc)

**Example Request:**
```bash
curl "https://yourdomain.com/api/v1/tasks?page=1&limit=10" \
  -H "Authorization: Bearer sk_live_abc123..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Task title",
      "status": "todo",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid API key
- `429 Too Many Requests` - Rate limit exceeded
```

---

## Testing Best Practices

### 1. Test All HTTP Methods

**✅ DO: Test CRUD operations**
```typescript
describe('Tasks API', () => {
  it('should list tasks (GET)', async () => {
    const response = await fetch('/api/v1/tasks', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('should create task (POST)', async () => {
    const response = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'New task',
        status: 'todo'
      })
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.title).toBe('New task')
  })

  it('should update task (PATCH)', async () => {
    const response = await fetch('/api/v1/tasks/tsk_abc123', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'completed'
      })
    })

    expect(response.status).toBe(200)
  })

  it('should delete task (DELETE)', async () => {
    const response = await fetch('/api/v1/tasks/tsk_abc123', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    expect(response.status).toBe(200)
  })
})
```

---

### 2. Test Error Cases

**✅ DO: Test validation and auth errors**
```typescript
describe('Error Handling', () => {
  it('should return 401 without authentication', async () => {
    const response = await fetch('/api/v1/tasks')
    expect(response.status).toBe(401)
  })

  it('should return 400 for invalid data', async () => {
    const response = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: '',  // Invalid (empty)
        status: 'invalid_status'  // Invalid enum
      })
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe('VALIDATION_FAILED')
    expect(data.details).toBeDefined()
  })

  it('should return 404 for non-existent resource', async () => {
    const response = await fetch('/api/v1/tasks/tsk_nonexistent', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    expect(response.status).toBe(404)
  })
})
```

---

## Production Checklist

Before deploying to production, ensure:

### Security
- [ ] HTTPS enforced
- [ ] API keys hashed in database
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CORS configured correctly
- [ ] Authentication required on protected routes
- [ ] Scope-based permissions implemented

### Performance
- [ ] Database indexes created
- [ ] Caching implemented
- [ ] Pagination implemented
- [ ] Large response payloads optimized
- [ ] N+1 query problems resolved
- [ ] Connection pooling configured

### Reliability
- [ ] Error handling on all endpoints
- [ ] Logging implemented
- [ ] Monitoring configured
- [ ] Health check endpoint
- [ ] Graceful shutdown handling
- [ ] Database migrations tested

### Documentation
- [ ] All endpoints documented
- [ ] Authentication guide published
- [ ] Error codes documented
- [ ] Code examples provided
- [ ] Migration guides written
- [ ] API versioning documented

### Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Load testing performed
- [ ] Error cases tested
- [ ] Authentication tested
- [ ] Authorization tested

---

## Next Steps

- [Testing APIs](./17-testing-apis.md) - Complete API testing guide
- [Monitoring and Logging](./19-monitoring-and-logging.md) - Production monitoring
- [Troubleshooting](./18-troubleshooting.md) - Common issues and solutions
- [API Reference](./10-api-reference.md) - Complete endpoint reference

**Documentation:** `core/docs/05-api/11-best-practices.md`
