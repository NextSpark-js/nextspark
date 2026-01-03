# Plugin API Routes

## Introduction

Plugins can expose custom API endpoints for external access, data processing, and third-party integrations. This document covers API route patterns, authentication, handler structure, and best practices.

**URL Pattern**: `/api/v1/plugin/[plugin-name]/[endpoint]`

**Key Features:**
- **Dual Authentication** - Sessions + API keys
- **Type-Safe Handlers** - TypeScript request/response types
- **Automatic Discovery** - Routes registered during build
- **Input Validation** - Zod schemas for all inputs
- **Error Handling** - Consistent error responses

---

## Route File Structure

### Basic Route Handler

**Location**: `contents/plugins/[plugin]/api/[endpoint]/route.ts`

**Example**:
```typescript
// contents/plugins/my-plugin/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export async function POST(request: NextRequest) {
  // 1. Authenticate request
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // 2. Get plugin functions
  const { processData } = usePlugin('my-plugin')

  // 3. Validate input
  const body = await request.json()
  if (!body.input) {
    return NextResponse.json(
      { error: 'Input is required' },
      { status: 400 }
    )
  }

  // 4. Process request
  try {
    const result = await processData(body.input)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    status: 'healthy',
    plugin: 'my-plugin',
    version: '1.0.0'
  })
}
```

**URL**: `POST /api/v1/plugin/my-plugin/process`

---

## Authentication

### Dual Authentication System

**Supported Methods:**
1. **Session Authentication** - Cookie-based (web clients)
2. **API Key Authentication** - Header-based (external clients)

**Implementation**:
```typescript
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)

  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Access authenticated user
  const userId = authResult.session.user.id
  console.log('Authenticated user:', userId)

  // Process request...
}
```

---

### Session Authentication (Web Clients)

**How it works:**
- User logs in via web interface
- Session cookie set automatically
- Cookie sent with each request

**Example Request**:
```typescript
// Client-side fetch with credentials
const response = await fetch('/api/v1/plugin/my-plugin/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include', // ✅ Include session cookie
  body: JSON.stringify({ input: 'data' })
})
```

---

### API Key Authentication (External Clients)

**How it works:**
- User generates API key in settings
- Key sent in `Authorization` header
- Server validates key and returns user

**Example Request**:
```bash
curl -X POST \
  https://api.example.com/api/v1/plugin/my-plugin/process \
  -H 'Authorization: Bearer sk-...' \
  -H 'Content-Type: application/json' \
  -d '{"input": "data"}'
```

**Client Code**:
```typescript
const response = await fetch('/api/v1/plugin/my-plugin/process', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ input: 'data' })
})
```

---

## Input Validation

### Using Zod Schemas

**Define Schema**:
```typescript
// contents/plugins/my-plugin/lib/validation.ts
import { z } from 'zod'

export const ProcessInputSchema = z.object({
  input: z.string().min(1).max(10000),
  options: z.object({
    format: z.enum(['json', 'text', 'html']).optional(),
    timeout: z.number().min(1000).max(30000).optional()
  }).optional()
})

export type ProcessInput = z.infer<typeof ProcessInputSchema>
```

**Use in Route**:
```typescript
import { ProcessInputSchema } from '../lib/validation'

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate input with Zod
  try {
    const body = await request.json()
    const validated = ProcessInputSchema.parse(body)

    const { processData } = usePlugin('my-plugin')
    const result = await processData(validated.input, validated.options)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}
```

---

## Dynamic Route Parameters

### URL Parameters

**Route**: `api/[id]/route.ts`

```typescript
// contents/plugins/my-plugin/api/items/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const itemId = params.id

  const { getItem } = usePlugin('my-plugin')
  const item = await getItem(itemId)

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: item })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const itemId = params.id

  const { deleteItem } = usePlugin('my-plugin')
  await deleteItem(itemId)

  return NextResponse.json({ success: true })
}
```

**URL**: `/api/v1/plugin/my-plugin/items/123`

---

### Query Parameters

```typescript
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract query parameters
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const filter = searchParams.get('filter')

  const { getItems } = usePlugin('my-plugin')
  const items = await getItems({ page, limit, filter })

  return NextResponse.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total: items.length
    }
  })
}
```

**URL**: `/api/v1/plugin/my-plugin/items?page=2&limit=10&filter=active`

---

## Error Handling

### Standard Error Responses

```typescript
// 400 Bad Request
return NextResponse.json(
  { error: 'Invalid input', details: validationErrors },
  { status: 400 }
)

// 401 Unauthorized
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
)

// 403 Forbidden
return NextResponse.json(
  { error: 'Forbidden - insufficient permissions' },
  { status: 403 }
)

// 404 Not Found
return NextResponse.json(
  { error: 'Resource not found' },
  { status: 404 }
)

// 429 Too Many Requests
return NextResponse.json(
  { error: 'Rate limit exceeded' },
  { status: 429 }
)

// 500 Internal Server Error
return NextResponse.json(
  { error: 'Internal server error' },
  { status: 500 }
)
```

---

## Real-World Example: AI Plugin

```typescript
// contents/plugins/ai/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { usePlugin } from '@/core/lib/registries/plugin-registry'
import { z } from 'zod'

const GenerateSchema = z.object({
  prompt: z.string().min(1).max(10000),
  model: z.string().optional(),
  maxTokens: z.number().min(1).max(4000).optional()
})

export async function POST(request: NextRequest) {
  // Authenticate
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Validate input
    const body = await request.json()
    const { prompt, model, maxTokens } = GenerateSchema.parse(body)

    // Get AI functions
    const { selectModel, generateText, calculateCost } = usePlugin('ai')

    // Select model
    const selectedModel = model || selectModel('chat')

    // Generate text
    const result = await generateText({
      prompt,
      model: selectedModel,
      maxTokens: maxTokens || 1000
    })

    // Calculate cost
    const cost = calculateCost(result.usage.totalTokens, selectedModel)

    return NextResponse.json({
      success: true,
      data: {
        text: result.text,
        model: selectedModel,
        usage: result.usage,
        cost
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[AI Plugin] Generation error:', error)
    return NextResponse.json(
      { error: 'Text generation failed' },
      { status: 500 }
    )
  }
}
```

**URL**: `POST /api/v1/plugin/ai/generate`

---

## Summary

**API Route Essentials:**
- ✅ Always authenticate requests
- ✅ Validate all inputs with Zod
- ✅ Return consistent error responses
- ✅ Use TypeScript for type safety
- ✅ Handle errors gracefully

**URL Pattern**:
- `/api/v1/plugin/[plugin]/[endpoint]`

**Authentication Methods**:
- Session cookies (web clients)
- API keys (external clients)

**Status Codes**:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Rate Limited
- 500: Server Error

**Next:** [Plugin Components](./06-plugin-components.md) - Create React components in plugins

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
