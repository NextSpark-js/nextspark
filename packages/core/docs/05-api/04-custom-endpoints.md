# Custom API Endpoints

**Custom route handlers • Plugin integration • Advanced patterns • When to use custom vs dynamic**

---

## Table of Contents

- [Overview](#overview)
- [When to Use Custom Endpoints](#when-to-use-custom-endpoints)
- [Creating Custom Endpoints](#creating-custom-endpoints)
- [Plugin Route Handlers](#plugin-route-handlers)
- [Request and Response Handling](#request-and-response-handling)
- [Middleware Integration](#middleware-integration)
- [Validation Patterns](#validation-patterns)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

While **dynamic endpoints** auto-generate CRUD APIs for entities, **custom endpoints** allow you to:

- **Implement complex business logic** beyond CRUD
- **Create specialized operations** (e.g., AI generation, webhooks)
- **Integrate third-party services** (e.g., payments, analytics)
- **Optimize specific use cases** with custom queries

**Key Difference:**
```typescript
// Dynamic endpoint (auto-generated)
GET /api/v1/tasks → Automatic CRUD

// Custom endpoint (manually created)
POST /api/v1/ai/generate → Custom logic
```

---

## When to Use Custom Endpoints

### ✅ Use Custom Endpoints When:

**1. Complex Business Logic**
```typescript
// Example: Generate AI content
POST /api/v1/ai/generate
{
  "prompt": "Write product description",
  "maxTokens": 150
}

// Not a simple CRUD operation - requires:
// - OpenAI API integration
// - Token counting
// - Rate limiting by credits
// - Response streaming
```

**2. Multi-Entity Operations**
```typescript
// Example: Bulk import
POST /api/v1/import/tasks
{
  "tasks": [...],  // Create tasks
  "assignUsers": true,  // Update users
  "notify": true  // Send notifications
}

// Touches multiple entities atomically
```

**3. Third-Party Integrations**
```typescript
// Example: Webhook receiver
POST /api/v1/webhooks/stripe
{
  "type": "payment.succeeded",
  "data": { /* ... */ }
}

// Processes external webhooks
```

**4. Specialized Queries**
```typescript
// Example: Analytics
GET /api/v1/analytics/dashboard
{
  "taskCompletionRate": 87,
  "averageTimeToComplete": "2.5 hours",
  "topPerformers": [...]
}

// Complex aggregations across multiple tables
```

---

### ❌ Use Dynamic Endpoints When:

**Simple CRUD operations:**
```typescript
// ✅ Use dynamic endpoint
GET    /api/v1/tasks
POST   /api/v1/tasks
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id

// ❌ Don't create custom endpoint for basic CRUD
```

---

## Creating Custom Endpoints

### Basic Pattern

**1. Create route file:**
```typescript
// app/api/v1/custom-route/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 2. Execute custom logic
    const result = await customLogic(auth.user)

    // 3. Return response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error in custom endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()

    // Validate input
    const validated = validateInput(body)

    // Execute logic
    const result = await createCustomResource(validated, auth.user)

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating resource:', error)
    return NextResponse.json(
      { success: false, error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
```

---

### Dynamic Route Parameters

**Capture URL parameters:**
```typescript
// app/api/v1/reports/[reportId]/export/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const { reportId } = params

  const report = await getReport(reportId)

  if (!report) {
    return NextResponse.json(
      { success: false, error: 'Report not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Generate export
  const exportData = await exportReport(report)

  return new NextResponse(exportData, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${reportId}.pdf"`
    }
  })
}
```

---

## Plugin Route Handlers

**Plugins can register custom routes** via the route handler registry.

### Register Plugin Route

**1. Define route handler:**
```typescript
// contents/plugins/ai-assistant/routes/generate.ts
import { NextRequest, NextResponse } from 'next/server'
import { RouteHandler } from '@/core/types/plugin'

export const generateRouteHandler: RouteHandler = {
  path: '/ai/generate',
  method: 'POST',
  handler: async (request: NextRequest) => {
    const body = await request.json()
    const { prompt, maxTokens = 100 } = body

    // Call OpenAI
    const response = await openai.createCompletion({
      model: 'gpt-4',
      prompt,
      max_tokens: maxTokens
    })

    return NextResponse.json({
      success: true,
      data: {
        text: response.choices[0].text,
        tokensUsed: response.usage.total_tokens
      }
    })
  },
  auth: 'required',  // Require authentication
  scopes: ['write'],  // Require write scope
  rateLimit: {
    limit: 20,
    window: '1h'
  }
}
```

**2. Register in plugin config:**
```typescript
// contents/plugins/ai-assistant/ai-assistant.config.ts
import { PluginConfig } from '@/core/types/plugin'
import { generateRouteHandler } from './routes/generate'

export const aiAssistantConfig: PluginConfig = {
  name: 'ai-assistant',
  version: '1.0.0',
  routes: [
    generateRouteHandler
  ]
}
```

**3. Access via API:**
```bash
POST /api/v1/ai/generate
Authorization: Bearer sk_live_abc123...
Content-Type: application/json

{
  "prompt": "Write a product description for wireless headphones",
  "maxTokens": 150
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Experience premium sound quality with our wireless headphones...",
    "tokensUsed": 142
  }
}
```

---

## Request and Response Handling

### Parse Request Body

**JSON:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  console.log(body)  // { field1: 'value1', ... }
}
```

**Form Data:**
```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const name = formData.get('name') as string
}
```

**URL Search Params:**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '20'
}
```

---

### Set Response Headers

**Custom headers:**
```typescript
export async function GET(request: NextRequest) {
  const data = await getData()

  return NextResponse.json(
    { success: true, data },
    {
      status: 200,
      headers: {
        'X-Custom-Header': 'value',
        'Cache-Control': 'public, max-age=3600',
        'X-Total-Count': data.length.toString()
      }
    }
  )
}
```

---

### Stream Responses

**Server-Sent Events (SSE):**
```typescript
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial message
      controller.enqueue(encoder.encode('data: {"status":"started"}\n\n'))

      // Process data
      for await (const chunk of processData()) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }

      // Complete
      controller.enqueue(encoder.encode('data: {"status":"completed"}\n\n'))
      controller.close()
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

---

## Middleware Integration

### Apply Authentication

**Use dual auth middleware:**
```typescript
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)

  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  // auth.type: 'api-key' | 'session'
  // auth.user: User object
  // auth.scopes: string[] (for API keys)

  return NextResponse.json({
    success: true,
    data: { userId: auth.user.id }
  })
}
```

---

### Apply Rate Limiting

**Custom rate limits:**
```typescript
import { checkRateLimit } from '@/core/lib/api/rate-limit'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)

  // Apply rate limit
  const rateLimit = await checkRateLimit(auth.user.id, 'ai/generate', {
    limit: 20,
    window: 3600  // 1 hour
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt
        }
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'Retry-After': rateLimit.resetAfter.toString()
        }
      }
    )
  }

  // Proceed with request
  const result = await processRequest()

  return NextResponse.json({
    success: true,
    data: result
  }, {
    headers: {
      'X-RateLimit-Limit': rateLimit.limit.toString(),
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': rateLimit.resetAt.toString()
    }
  })
}
```

---

## Validation Patterns

### Zod Schema Validation

**Define schemas:**
```typescript
import { z } from 'zod'

const generateAISchema = z.object({
  prompt: z.string().min(1).max(1000),
  maxTokens: z.number().min(10).max(500).optional(),
  temperature: z.number().min(0).max(1).optional(),
  model: z.enum(['gpt-4', 'gpt-3.5-turbo']).optional()
})

type GenerateAIInput = z.infer<typeof generateAISchema>
```

**Validate in route:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate
    const validated = generateAISchema.parse(body)

    // Use validated data (type-safe)
    const result = await generateAI(validated)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_FAILED',
          details: error.errors.reduce((acc, err) => {
            acc[err.path.join('.')] = err.message
            return acc
          }, {} as Record<string, string>)
        },
        { status: 400 }
      )
    }

    throw error
  }
}
```

---

## Error Handling

### Standard Error Pattern

**Create error helper:**
```typescript
export function createErrorResponse(
  error: string,
  code: string,
  status: number,
  details?: Record<string, any>
) {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
      ...(details && { details })
    },
    { status }
  )
}
```

**Use in routes:**
```typescript
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)

    if (!auth.success) {
      return createErrorResponse(
        'Unauthorized',
        'UNAUTHORIZED',
        401
      )
    }

    const data = await getData()

    if (!data) {
      return createErrorResponse(
        'Resource not found',
        'NOT_FOUND',
        404
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return createErrorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    )
  }
}
```

---

## Examples

### Example 1: AI Text Generation

```typescript
// app/api/v1/ai/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { checkRateLimit } from '@/core/lib/api/rate-limit'
import { z } from 'zod'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const generateSchema = z.object({
  prompt: z.string().min(1).max(1000),
  maxTokens: z.number().min(10).max(500).default(100),
  temperature: z.number().min(0).max(1).default(0.7)
})

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 2. Rate limit (20 requests/hour)
    const rateLimit = await checkRateLimit(auth.user.id, 'ai/generate', {
      limit: 20,
      window: 3600
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      )
    }

    // 3. Validate input
    const body = await request.json()
    const { prompt, maxTokens, temperature } = generateSchema.parse(body)

    // 4. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature
    })

    // 5. Return result
    return NextResponse.json({
      success: true,
      data: {
        text: completion.choices[0].message.content,
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_FAILED',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('AI generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
```

---

### Example 2: Webhook Receiver

```typescript
// app/api/v1/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // Handle event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object
        await handlePaymentSuccess(paymentIntent)
        break

      case 'customer.subscription.updated':
        const subscription = event.data.object
        await handleSubscriptionUpdate(subscription)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  // Update order status
  await db.update('orders', {
    where: { paymentIntentId: paymentIntent.id },
    data: { status: 'paid' }
  })

  // Send confirmation email
  await sendEmail({
    to: paymentIntent.customer_email,
    subject: 'Payment confirmed',
    template: 'payment-success'
  })
}

async function handleSubscriptionUpdate(subscription: any) {
  // Update user subscription
  await db.update('users', {
    where: { stripeCustomerId: subscription.customer },
    data: {
      subscriptionStatus: subscription.status,
      subscriptionPlan: subscription.items.data[0].price.id
    }
  })
}
```

---

### Example 3: Bulk Import

```typescript
// app/api/v1/import/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  status: z.enum(['todo', 'in_progress', 'completed']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium')
})

const importSchema = z.object({
  tasks: z.array(taskSchema).min(1).max(100),
  assignUsers: z.boolean().default(false),
  notify: z.boolean().default(false)
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { tasks, assignUsers, notify } = importSchema.parse(body)

    // Use transaction for atomicity
    const result = await db.transaction(async (tx) => {
      const created = []
      const failed = []

      for (const task of tasks) {
        try {
          // Create task
          const newTask = await tx.insert('tasks', {
            ...task,
            userId: auth.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          })

          // Assign users if requested
          if (assignUsers && task.assigneeId) {
            await tx.insert('task_assignments', {
              taskId: newTask.id,
              userId: task.assigneeId
            })
          }

          created.push(newTask)
        } catch (error) {
          failed.push({
            task,
            error: error.message
          })
        }
      }

      // Send notifications if requested
      if (notify && created.length > 0) {
        await sendBulkNotifications(created, auth.user.id)
      }

      return { created, failed }
    })

    return NextResponse.json({
      success: true,
      data: {
        imported: result.created.length,
        failed: result.failed.length,
        tasks: result.created,
        errors: result.failed
      }
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_FAILED' },
        { status: 400 }
      )
    }

    console.error('Import error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
```

---

## Next Steps

- [Advanced Features](./12-advanced-features.md) - Bulk operations, webhooks, file uploads
- [Dynamic Endpoints](./03-dynamic-endpoints.md) - Auto-generated CRUD endpoints
- [Best Practices](./11-best-practices.md) - API best practices guide
- [Testing APIs](./17-testing-apis.md) - Testing custom endpoints

**Documentation:** `core/docs/05-api/04-custom-endpoints.md`
