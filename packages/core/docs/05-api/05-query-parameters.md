# Query Parameters

**Advanced filtering • Pagination • Sorting • Field selection • Full-text search**

---

## Table of Contents

- [Overview](#overview)
- [Pagination](#pagination)
- [Filtering](#filtering)
- [Sorting](#sorting)
- [Field Selection](#field-selection)
- [Search](#search)
- [Relations (Include)](#relations-include)
- [Date Range Filtering](#date-range-filtering)
- [Combining Parameters](#combining-parameters)
- [Performance Considerations](#performance-considerations)
- [Client Examples](#client-examples)

---

## Overview

The API v1 provides powerful query parameters for all LIST operations (`GET /api/v1/{entity}`). These parameters allow you to:

- **Paginate** through large datasets
- **Filter** records by field values
- **Sort** results by any field
- **Select** specific fields to reduce payload size
- **Search** across multiple text fields
- **Include** related data (eager loading)
- **Filter by date range** for time-based queries

**All query parameters are optional** and can be combined for precise control over API responses.

---

## Pagination

Pagination allows you to retrieve large datasets in manageable chunks.

### Parameters

```typescript
{
  page?: number      // Page number (1-indexed, default: 1)
  limit?: number     // Records per page (default: 20, max: 100)
}
```

### Example

```bash
# Get page 2 with 10 records per page
curl "https://yourdomain.com/api/v1/tasks?page=2&limit=10" \
  -H "Authorization: Bearer sk_live_abc123..."
```

### Response

```json
{
  "success": true,
  "data": [
    { "id": "tsk_011", "title": "Task 11" },
    { "id": "tsk_012", "title": "Task 12" },
    { "id": "tsk_013", "title": "Task 13" },
    // ... 7 more records
  ],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Pagination Headers

The API also returns pagination info in response headers:

```http
X-Total-Count: 150
X-Page: 2
X-Per-Page: 10
Link: </api/v1/tasks?page=3>; rel="next", </api/v1/tasks?page=1>; rel="prev"
```

### Default Behavior

```typescript
// No pagination parameters
GET /api/v1/tasks

// Equivalent to:
GET /api/v1/tasks?page=1&limit=20
```

### Limits

```typescript
// Maximum limit enforced
GET /api/v1/tasks?limit=1000  // ❌ Capped at 100

// Actual response: limit=100
```

### Best Practices

**✅ DO:**
- Use `limit=100` for bulk data exports
- Use `limit=10-20` for UI pagination
- Cache paginated responses client-side
- Use `hasNext` to determine if more pages exist

**❌ DON'T:**
- Request all data in single request (`limit=999999`)
- Implement infinite scroll without virtualization
- Ignore `totalPages` for navigation

---

## Filtering

Filter records by field values using the `filter` parameter.

### Basic Filtering

```typescript
{
  filter?: string  // JSON object encoded as string
}
```

### Example: Exact Match

```bash
# Filter by status = "completed"
curl "https://yourdomain.com/api/v1/tasks?filter=%7B%22status%22%3A%22completed%22%7D" \
  -H "Authorization: Bearer sk_live_abc123..."

# Decoded filter parameter:
# {"status":"completed"}
```

### Filter Operators

The filter parameter supports advanced operators:

```typescript
{
  field: {
    $eq: value           // Equals
    $ne: value           // Not equals
    $gt: value           // Greater than
    $gte: value          // Greater than or equal
    $lt: value           // Less than
    $lte: value          // Less than or equal
    $in: [values]        // In array
    $nin: [values]       // Not in array
    $contains: value     // Contains substring (case-insensitive)
    $startsWith: value   // Starts with
    $endsWith: value     // Ends with
    $null: boolean       // Is null
  }
}
```

### Examples

**Exact match:**
```bash
GET /api/v1/tasks?filter={"status":"completed"}
```

**Greater than:**
```bash
GET /api/v1/tasks?filter={"priority":{"$gt":"low"}}
```

**In array:**
```bash
GET /api/v1/tasks?filter={"status":{"$in":["todo","in_progress"]}}
```

**Contains (substring):**
```bash
GET /api/v1/tasks?filter={"title":{"$contains":"api"}}
# Matches: "API documentation", "Build API", "api testing"
```

**Multiple conditions (AND):**
```bash
GET /api/v1/tasks?filter={"status":"completed","priority":"high"}
# Returns: tasks where status=completed AND priority=high
```

**Null checks:**
```bash
GET /api/v1/tasks?filter={"assigneeId":{"$null":true}}
# Returns: unassigned tasks
```

### JavaScript Example

```typescript
// Build filter object
const filter = {
  status: { $in: ['todo', 'in_progress'] },
  priority: 'high',
  assigneeId: { $null: false }
}

// Encode for URL
const filterParam = encodeURIComponent(JSON.stringify(filter))

// Make request
const response = await fetch(
  `https://yourdomain.com/api/v1/tasks?filter=${filterParam}`,
  {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  }
)
```

### Filter Validation

**Valid filters:**
```typescript
✅ {"status":"completed"}
✅ {"priority":{"$gt":"low"}}
✅ {"createdAt":{"$gte":"2025-01-01T00:00:00Z"}}
```

**Invalid filters:**
```typescript
❌ {"$invalid":"operator"}     // Unknown operator
❌ {"unknownField":"value"}    // Field not in schema
❌ "not a json object"         // Invalid JSON
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid filter syntax",
  "code": "INVALID_FILTER",
  "details": {
    "filter": "Must be a valid JSON object"
  }
}
```

---

## Sorting

Sort results by any field in ascending or descending order.

### Parameters

```typescript
{
  sort?: string           // Field name to sort by
  order?: 'asc' | 'desc' // Sort order (default: 'asc')
}
```

### Examples

**Ascending (default):**
```bash
GET /api/v1/tasks?sort=createdAt
# Oldest tasks first
```

**Descending:**
```bash
GET /api/v1/tasks?sort=createdAt&order=desc
# Newest tasks first
```

**Sort by priority:**
```bash
GET /api/v1/tasks?sort=priority&order=desc
# High priority first
```

**Multiple sort fields:**
```bash
# Primary sort by status, secondary by priority
GET /api/v1/tasks?sort=status,priority&order=asc,desc
```

### Default Sorting

If no sort parameter provided, results are sorted by:
1. `createdAt` (descending) - Newest first
2. `id` (ascending) - Stable ordering

### Sort Validation

**Valid sort fields:**
```typescript
✅ ?sort=createdAt
✅ ?sort=updatedAt
✅ ?sort=title
✅ ?sort=priority
```

**Invalid sort fields:**
```typescript
❌ ?sort=invalidField    // Field not in schema
❌ ?sort=password        // Protected field (not sortable)
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid sort field",
  "code": "INVALID_SORT",
  "details": {
    "sort": "Field 'invalidField' does not exist or is not sortable"
  }
}
```

### Performance

Sorting is optimized when:
- ✅ Field has database index
- ✅ Combined with pagination (`limit`)
- ✅ Using `createdAt` or `id` (always indexed)

Sorting is slower when:
- ⚠️ Field is not indexed
- ⚠️ Sorting large datasets without pagination
- ⚠️ Multiple sort fields

---

## Field Selection

Select specific fields to reduce response payload size.

### Parameters

```typescript
{
  fields?: string  // Comma-separated field names
}
```

### Examples

**Select specific fields:**
```bash
GET /api/v1/tasks?fields=id,title,status
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "status": "in_progress"
    },
    {
      "id": "tsk_def456",
      "title": "Fix bug in authentication",
      "status": "todo"
    }
  ]
}
```

### Default Fields

If no `fields` parameter provided, **all fields** are returned (excluding protected fields like `password`).

### Protected Fields

Some fields are **never** returned in API responses:
- `password`
- `passwordHash`
- `apiKeyHash`
- `secretKey`

### Nested Field Selection

For included relations:

```bash
GET /api/v1/tasks?fields=id,title&include=assignee&includeFields[assignee]=id,name
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "assignee": {
        "id": "usr_xyz789",
        "name": "John Doe"
      }
    }
  ]
}
```

### Performance Benefits

Selecting specific fields can dramatically reduce response size:

```typescript
// Full response: ~5KB per record
GET /api/v1/tasks

// Minimal response: ~500 bytes per record (10x smaller!)
GET /api/v1/tasks?fields=id,title,status
```

**Use field selection when:**
- ✅ Building mobile apps (reduce bandwidth)
- ✅ Displaying tables (only show relevant columns)
- ✅ Autocomplete dropdowns (only need `id` and `name`)

---

## Search

Full-text search across multiple text fields.

### Parameters

```typescript
{
  search?: string  // Search query (case-insensitive)
}
```

### Example

```bash
GET /api/v1/tasks?search=api+documentation
```

**Searches across:**
- `title`
- `description`
- Any other text fields marked as searchable

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "description": "Write comprehensive API reference"
    },
    {
      "id": "tsk_def456",
      "title": "API testing",
      "description": "Test all API endpoints with documentation examples"
    }
  ]
}
```

### Search Behavior

**Case-insensitive:**
```bash
GET /api/v1/tasks?search=API
# Matches: "api", "API", "Api"
```

**Partial matching:**
```bash
GET /api/v1/tasks?search=doc
# Matches: "documentation", "docs", "documented"
```

**Multiple words (AND):**
```bash
GET /api/v1/tasks?search=api+testing
# Matches: records containing both "api" AND "testing"
```

### Combining Search with Filters

```bash
# Search + filter
GET /api/v1/tasks?search=api&filter={"status":"completed"}
# Returns: completed tasks matching "api"
```

### Performance

Search is optimized when:
- ✅ Database has full-text search index
- ✅ Combined with pagination
- ✅ Search query is specific (3+ characters)

Search is slower when:
- ⚠️ No full-text index
- ⚠️ Very short queries (1-2 characters)
- ⚠️ Searching across many text fields

---

## Relations (Include)

Eager load related data to avoid N+1 queries.

### Parameters

```typescript
{
  include?: string  // Comma-separated relation names
}
```

### Example

```bash
# Include assignee relation
GET /api/v1/tasks?include=assignee
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "assigneeId": "usr_xyz789",
      "assignee": {
        "id": "usr_xyz789",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "https://..."
      }
    }
  ]
}
```

### Multiple Relations

```bash
GET /api/v1/tasks?include=assignee,comments,tags
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "assignee": { /* user data */ },
      "comments": [
        { "id": "cmt_1", "text": "Great progress!" },
        { "id": "cmt_2", "text": "Almost done!" }
      ],
      "tags": [
        { "id": "tag_1", "name": "documentation" },
        { "id": "tag_2", "name": "api" }
      ]
    }
  ]
}
```

### Nested Relations

```bash
# Include assignee and their team
GET /api/v1/tasks?include=assignee.team
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "assignee": {
        "id": "usr_xyz789",
        "name": "John Doe",
        "team": {
          "id": "team_abc",
          "name": "Engineering"
        }
      }
    }
  ]
}
```

### Relation Field Selection

```bash
# Include assignee but only select specific fields
GET /api/v1/tasks?include=assignee&includeFields[assignee]=id,name
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "assignee": {
        "id": "usr_xyz789",
        "name": "John Doe"
        // email, avatar, etc. not included
      }
    }
  ]
}
```

### Available Relations

Relations are defined in entity config (`entityConfig.relations`):

```typescript
// Example: tasks entity
{
  "assignee": { "type": "belongsTo", "entity": "users" },
  "comments": { "type": "hasMany", "entity": "comments" },
  "tags": { "type": "manyToMany", "entity": "tags" }
}
```

**Check available relations:**
```bash
OPTIONS /api/v1/tasks
# Returns schema including relations
```

### Performance

**Efficient (1 query per relation):**
```bash
GET /api/v1/tasks?include=assignee,comments
# SQL: 3 queries (tasks, users, comments)
```

**Inefficient (N+1 problem):**
```bash
# ❌ DON'T: Fetch tasks, then fetch assignee for each task
GET /api/v1/tasks
for each task:
  GET /api/v1/users/{assigneeId}
# SQL: 1 + N queries
```

**✅ Best Practice:** Always use `include` for related data instead of separate requests.

---

## Date Range Filtering

Filter records by date range using special parameters.

### Parameters

```typescript
{
  startDate?: string  // ISO 8601 start date
  endDate?: string    // ISO 8601 end date
  dateField?: string  // Field to filter (default: 'createdAt')
}
```

### Examples

**Created in date range:**
```bash
GET /api/v1/tasks?startDate=2025-01-01&endDate=2025-01-31
# Returns: tasks created in January 2025
```

**Updated in date range:**
```bash
GET /api/v1/tasks?startDate=2025-01-15&endDate=2025-01-20&dateField=updatedAt
# Returns: tasks updated between Jan 15-20, 2025
```

**After specific date:**
```bash
GET /api/v1/tasks?startDate=2025-01-15
# Returns: tasks created on or after Jan 15, 2025
```

**Before specific date:**
```bash
GET /api/v1/tasks?endDate=2025-01-31
# Returns: tasks created on or before Jan 31, 2025
```

### Date Format

**Accepted formats:**
```typescript
✅ "2025-01-15"                    // Date only
✅ "2025-01-15T10:30:00Z"         // Full ISO 8601 with time
✅ "2025-01-15T10:30:00-05:00"    // With timezone
```

**Invalid formats:**
```typescript
❌ "01/15/2025"                   // US format
❌ "15-01-2025"                   // EU format
❌ "2025-1-15"                    // Missing leading zeros
```

### Timezone Handling

- All dates are stored in **UTC** in database
- If timezone not provided, **UTC is assumed**
- Client should convert to/from local timezone

**Example:**
```typescript
// User in PST (UTC-8) wants Jan 15 tasks
const localDate = new Date('2025-01-15T00:00:00-08:00')
const utcDate = localDate.toISOString() // "2025-01-15T08:00:00Z"

// Request with UTC date
const response = await fetch(
  `https://yourdomain.com/api/v1/tasks?startDate=${utcDate}`
)
```

### Combining with Other Filters

```bash
# Date range + status filter
GET /api/v1/tasks?startDate=2025-01-01&endDate=2025-01-31&filter={"status":"completed"}
# Returns: tasks completed in January 2025
```

---

## Combining Parameters

All query parameters can be combined for powerful queries.

### Example 1: Paginated, Filtered, Sorted

```bash
GET /api/v1/tasks?page=1&limit=20&filter={"status":"in_progress"}&sort=priority&order=desc
```

**Returns:**
- Page 1 of results
- 20 records per page
- Only tasks with status "in_progress"
- Sorted by priority (high to low)

### Example 2: Search + Date Range + Include

```bash
GET /api/v1/tasks?search=api&startDate=2025-01-01&endDate=2025-01-31&include=assignee
```

**Returns:**
- Tasks matching "api"
- Created in January 2025
- With assignee data included

### Example 3: Complex Filter + Field Selection

```bash
GET /api/v1/tasks?\
filter={"status":{"$in":["todo","in_progress"]},"priority":"high"}&\
fields=id,title,status,priority&\
sort=createdAt&\
order=desc&\
limit=50
```

**Returns:**
- High priority tasks that are todo or in_progress
- Only id, title, status, priority fields
- Sorted by creation date (newest first)
- Up to 50 results

### Parameter Precedence

When parameters conflict:
1. **Specific filters** override defaults
2. **Explicit field selection** overrides default fields
3. **Date range** combines with other filters (AND)
4. **Search** combines with filters (AND)

### URL Encoding

Always URL encode complex parameters:

```typescript
const filter = { status: { $in: ['todo', 'in_progress'] } }
const filterParam = encodeURIComponent(JSON.stringify(filter))

const url = `https://yourdomain.com/api/v1/tasks?filter=${filterParam}`
```

---

## Performance Considerations

### Indexing

**Fast queries (indexed fields):**
- ✅ `id` - Primary key
- ✅ `createdAt` - Always indexed
- ✅ `updatedAt` - Always indexed
- ✅ Foreign keys (e.g., `userId`, `assigneeId`)

**Slower queries (non-indexed fields):**
- ⚠️ Custom text fields (unless indexed)
- ⚠️ JSON fields
- ⚠️ Computed fields

### Pagination Best Practices

**✅ DO:**
```bash
# Paginate large datasets
GET /api/v1/tasks?limit=50

# Use cursor-based pagination for real-time data
GET /api/v1/tasks?after=tsk_abc123&limit=50
```

**❌ DON'T:**
```bash
# Fetch all records
GET /api/v1/tasks?limit=10000

# Deep pagination (slow)
GET /api/v1/tasks?page=9999
```

### Filtering Optimization

**✅ Fast:**
```bash
# Filter by indexed field
GET /api/v1/tasks?filter={"userId":"usr_abc123"}

# Simple equality
GET /api/v1/tasks?filter={"status":"completed"}
```

**⚠️ Slower:**
```bash
# Filter by non-indexed field
GET /api/v1/tasks?filter={"customField":"value"}

# Complex regex
GET /api/v1/tasks?filter={"title":{"$contains":"api"}}
```

### Response Size Optimization

**Reduce payload size:**
```bash
# Select only needed fields (10x smaller response)
GET /api/v1/tasks?fields=id,title

# Limit results
GET /api/v1/tasks?limit=10

# Don't include large relations unless needed
GET /api/v1/tasks?include=comments  # ❌ Might include 100+ comments per task
```

### Caching

The API includes cache headers for optimal performance:

```http
# Response headers
Cache-Control: public, max-age=60
ETag: "abc123xyz"
```

**Client-side caching:**
```typescript
// Use TanStack Query for automatic caching
const { data } = useQuery({
  queryKey: ['tasks', { page: 1, limit: 20, filter: { status: 'completed' } }],
  queryFn: () => fetchTasks({ page: 1, limit: 20, filter: { status: 'completed' } }),
  staleTime: 60000 // Cache for 1 minute
})
```

---

## Client Examples

### JavaScript (Fetch API)

```typescript
async function getTasks(options: {
  page?: number
  limit?: number
  filter?: Record<string, any>
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  include?: string[]
  fields?: string[]
}) {
  const params = new URLSearchParams()

  if (options.page) params.append('page', options.page.toString())
  if (options.limit) params.append('limit', options.limit.toString())
  if (options.filter) params.append('filter', JSON.stringify(options.filter))
  if (options.sort) params.append('sort', options.sort)
  if (options.order) params.append('order', options.order)
  if (options.search) params.append('search', options.search)
  if (options.include) params.append('include', options.include.join(','))
  if (options.fields) params.append('fields', options.fields.join(','))

  const response = await fetch(
    `https://yourdomain.com/api/v1/tasks?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }
  )

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

// Usage
const tasks = await getTasks({
  page: 1,
  limit: 20,
  filter: { status: { $in: ['todo', 'in_progress'] } },
  sort: 'priority',
  order: 'desc',
  include: ['assignee'],
  fields: ['id', 'title', 'status', 'priority']
})
```

### React (TanStack Query)

```typescript
import { useQuery } from '@tanstack/react-query'

interface TaskFilters {
  page?: number
  limit?: number
  status?: string[]
  priority?: string
  search?: string
}

function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())

      if (filters.status) {
        params.append('filter', JSON.stringify({
          status: { $in: filters.status }
        }))
      }

      if (filters.priority) {
        params.append('filter', JSON.stringify({
          priority: filters.priority
        }))
      }

      if (filters.search) {
        params.append('search', filters.search)
      }

      const response = await fetch(
        `https://yourdomain.com/api/v1/tasks?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      )

      return response.json()
    },
    staleTime: 60000 // Cache for 1 minute
  })
}

// Usage in component
function TaskList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useTasks({
    page,
    limit: 20,
    status: ['todo', 'in_progress'],
    search
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tasks..."
      />
      {data.data.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        onPageChange={setPage}
      />
    </div>
  )
}
```

### Python

```python
import requests
from typing import Optional, List, Dict
from urllib.parse import urlencode
import json

def get_tasks(
    api_key: str,
    page: Optional[int] = None,
    limit: Optional[int] = None,
    filter: Optional[Dict] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    search: Optional[str] = None,
    include: Optional[List[str]] = None,
    fields: Optional[List[str]] = None
):
    params = {}

    if page: params['page'] = page
    if limit: params['limit'] = limit
    if filter: params['filter'] = json.dumps(filter)
    if sort: params['sort'] = sort
    if order: params['order'] = order
    if search: params['search'] = search
    if include: params['include'] = ','.join(include)
    if fields: params['fields'] = ','.join(fields)

    url = f"https://yourdomain.com/api/v1/tasks?{urlencode(params)}"

    response = requests.get(
        url,
        headers={
            'Authorization': f'Bearer {api_key}'
        }
    )

    response.raise_for_status()
    return response.json()

# Usage
tasks = get_tasks(
    api_key='sk_live_abc123...',
    page=1,
    limit=20,
    filter={'status': {'$in': ['todo', 'in_progress']}},
    sort='priority',
    order='desc',
    include=['assignee'],
    fields=['id', 'title', 'status', 'priority']
)
```

---

## Next Steps

- [Metadata in APIs](./06-metadata-in-apis.md) - Metadata system integration
- [API Reference](./10-api-reference.md) - Complete endpoint reference
- [Dynamic Endpoints](./03-dynamic-endpoints.md) - Auto-generated CRUD endpoints
- [Best Practices](./11-best-practices.md) - API best practices guide

**Documentation:** `core/docs/05-api/05-query-parameters.md`
