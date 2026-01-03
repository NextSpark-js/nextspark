# Advanced API Features

**Bulk operations • Webhooks • File uploads • Real-time updates • Advanced patterns**

---

## Table of Contents

- [Overview](#overview)
- [Bulk Operations](#bulk-operations)
- [Webhooks](#webhooks)
- [File Uploads](#file-uploads)
- [Real-Time Updates](#real-time-updates)
- [Batch Requests](#batch-requests)
- [GraphQL Support](#graphql-support)

---

## Overview

Advanced features extend the API beyond basic CRUD operations:

- ✅ **Bulk operations** - Process multiple records efficiently
- ✅ **Webhooks** - Real-time event notifications
- ✅ **File uploads** - Handle multipart/form-data
- ✅ **Real-time updates** - Server-Sent Events (SSE)
- ✅ **Batch requests** - Multiple operations in one request
- ✅ **GraphQL** - Flexible query language (optional)

---

## Bulk Operations

### Bulk Create

Create multiple records in a single request.

**Endpoint:**
```http
POST /api/v1/import/{entity}
```

**Request:**
```json
{
  "items": [
    { "title": "Task 1", "status": "todo" },
    { "title": "Task 2", "status": "in_progress" },
    { "title": "Task 3", "status": "completed" }
  ],
  "options": {
    "skipInvalid": true,
    "returnFailures": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 1,
    "items": [
      { "id": "tsk_001", "title": "Task 1" },
      { "id": "tsk_002", "title": "Task 2" }
    ],
    "failures": [
      {
        "index": 2,
        "item": { "title": "Task 3" },
        "error": "Invalid status value"
      }
    ]
  }
}
```

**Implementation:**
```typescript
// app/api/v1/import/[entity]/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { entity: string } }
) {
  const body = await request.json()
  const { items, options = {} } = body

  const results = { created: [], failed: [] }

  for (const [index, item] of items.entries()) {
    try {
      const created = await createEntity(params.entity, item)
      results.created.push(created)
    } catch (error) {
      if (options.skipInvalid) {
        results.failed.push({ index, item, error: error.message })
      } else {
        throw error
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      created: results.created.length,
      failed: results.failed.length,
      items: results.created,
      ...(options.returnFailures && { failures: results.failed })
    }
  })
}
```

### Bulk Update

Update multiple records with different values.

**Request:**
```json
{
  "updates": [
    { "id": "tsk_001", "status": "completed" },
    { "id": "tsk_002", "priority": "high" },
    { "id": "tsk_003", "status": "in_progress" }
  ]
}
```

### Bulk Delete

Delete multiple records by IDs.

**Request:**
```json
{
  "ids": ["tsk_001", "tsk_002", "tsk_003"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": 3
  }
}
```

---

## Webhooks

Send real-time notifications when events occur.

### Register Webhook

```http
POST /api/v1/webhooks
```

**Request:**
```json
{
  "url": "https://your-app.com/webhooks/tasks",
  "events": ["task.created", "task.updated", "task.deleted"],
  "secret": "whsec_abc123..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "wh_abc123",
    "url": "https://your-app.com/webhooks/tasks",
    "events": ["task.created", "task.updated", "task.deleted"],
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

### Webhook Payload

When an event occurs, we send:

```json
{
  "id": "evt_abc123",
  "type": "task.created",
  "createdAt": "2025-01-15T10:00:00Z",
  "data": {
    "id": "tsk_abc123",
    "title": "New task",
    "status": "todo"
  }
}
```

### Verify Webhook Signature

```typescript
import crypto from 'crypto'

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return signature === expectedSignature
}

// In webhook handler
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-webhook-signature')!

  if (!verifyWebhookSignature(body, signature, webhookSecret)) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  const event = JSON.parse(body)
  await handleWebhookEvent(event)

  return NextResponse.json({ received: true })
}
```

---

## File Uploads

Handle file uploads with multipart/form-data.

### Upload Single File

```http
POST /api/v1/upload
Content-Type: multipart/form-data
```

**Implementation:**
```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    )
  }

  // Validate file
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: 'File too large' },
      { status: 400 }
    )
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    )
  }

  // Upload to storage (S3, etc.)
  const url = await uploadToStorage(file)

  return NextResponse.json({
    success: true,
    data: {
      url,
      filename: file.name,
      size: file.size,
      type: file.type
    }
  })
}
```

### Upload Multiple Files

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  const uploaded = []

  for (const file of files) {
    const url = await uploadToStorage(file)
    uploaded.push({ url, filename: file.name })
  }

  return NextResponse.json({
    success: true,
    data: { files: uploaded }
  })
}
```

### Client Usage

```typescript
async function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/v1/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  })

  return response.json()
}

// Usage in React
function FileUpload() {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = await uploadFile(file)
    console.log('Uploaded:', result.data.url)
  }

  return <input type="file" onChange={handleUpload} />
}
```

---

## Real-Time Updates

Use Server-Sent Events (SSE) for real-time updates.

### SSE Endpoint

```typescript
// app/api/v1/stream/tasks/route.ts
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode('data: {"type":"connected"}\n\n')
      )

      // Subscribe to task updates
      const unsubscribe = subscribeToTaskUpdates((task) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(task)}\n\n`)
        )
      })

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        controller.close()
      })
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### Client Usage

```typescript
function useTaskUpdates() {
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    const eventSource = new EventSource('/api/v1/stream/tasks')

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'task.created') {
        setTasks(prev => [...prev, data.task])
      } else if (data.type === 'task.updated') {
        setTasks(prev =>
          prev.map(t => t.id === data.task.id ? data.task : t)
        )
      } else if (data.type === 'task.deleted') {
        setTasks(prev => prev.filter(t => t.id !== data.taskId))
      }
    }

    return () => eventSource.close()
  }, [])

  return tasks
}
```

---

## Batch Requests

Execute multiple API calls in a single HTTP request.

**Request:**
```json
{
  "requests": [
    {
      "id": "req1",
      "method": "GET",
      "path": "/tasks/tsk_001"
    },
    {
      "id": "req2",
      "method": "POST",
      "path": "/tasks",
      "body": { "title": "New task" }
    },
    {
      "id": "req3",
      "method": "PATCH",
      "path": "/tasks/tsk_002",
      "body": { "status": "completed" }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "responses": [
    {
      "id": "req1",
      "status": 200,
      "body": { "id": "tsk_001", "title": "Task 1" }
    },
    {
      "id": "req2",
      "status": 201,
      "body": { "id": "tsk_003", "title": "New task" }
    },
    {
      "id": "req3",
      "status": 200,
      "body": { "id": "tsk_002", "status": "completed" }
    }
  ]
}
```

**Implementation:**
```typescript
// app/api/v1/batch/route.ts
export async function POST(request: NextRequest) {
  const { requests } = await request.json()
  const responses = []

  for (const req of requests) {
    try {
      const response = await executeRequest(req)
      responses.push({
        id: req.id,
        status: response.status,
        body: response.body
      })
    } catch (error) {
      responses.push({
        id: req.id,
        status: error.status || 500,
        body: { error: error.message }
      })
    }
  }

  return NextResponse.json({
    success: true,
    responses
  })
}
```

---

## GraphQL Support

Optional GraphQL endpoint for flexible queries.

### Schema

```graphql
type Task {
  id: ID!
  title: String!
  description: String
  status: String!
  priority: String!
  assignee: User
  createdAt: String!
  updatedAt: String!
}

type Query {
  task(id: ID!): Task
  tasks(
    page: Int
    limit: Int
    filter: TaskFilter
  ): TaskConnection!
}

type Mutation {
  createTask(input: CreateTaskInput!): Task!
  updateTask(id: ID!, input: UpdateTaskInput!): Task!
  deleteTask(id: ID!): Boolean!
}
```

### Query Example

```graphql
query GetTasks {
  tasks(page: 1, limit: 10, filter: { status: "todo" }) {
    edges {
      node {
        id
        title
        status
        assignee {
          id
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
```

---

## Next Steps

- [Caching and Performance](./13-caching-and-performance.md) - Performance optimization
- [Testing APIs](./17-testing-apis.md) - Testing advanced features
- [Custom Endpoints](./04-custom-endpoints.md) - Building custom endpoints

**Documentation:** `core/docs/05-api/12-advanced-features.md`
