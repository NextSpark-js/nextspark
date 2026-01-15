# /how-to:create-api

Interactive guide to create custom API endpoints in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/nextjs-api-development/SKILL.md` - API routes and dual auth
- `.claude/skills/entity-api/SKILL.md` - Dynamic entity endpoints
- `.claude/skills/zod-validation/SKILL.md` - Input validation patterns

---

## Syntax

```
/how-to:create-api
/how-to:create-api [endpoint-name]
```

---

## Behavior

Guides the user through creating custom API endpoints with dual authentication, validation, and proper error handling.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding API Patterns
        └── Entity vs Custom endpoints

Step 2: Create Route Handler
        └── Next.js App Router API

Step 3: Implement Dual Authentication
        └── Session + API Key support

Step 4: Add Validation & Error Handling
        └── Zod schemas and responses

Step 5: Test Your Endpoint
        └── Verify with curl/Postman
```

---

## Step 1: Understanding API Patterns

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE AN API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding API Patterns

NextSpark has two types of API endpoints:

┌─────────────────────────────────────────────┐
│  ENTITY ENDPOINTS (Automatic)               │
│  ─────────────────────────────────────────  │
│  Path: /api/v1/entities/{entity}            │
│  Auto-generated from entity config          │
│  Standard CRUD operations                   │
│  ─────────────────────────────────────────  │
│  GET, POST, PATCH, DELETE                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  CUSTOM ENDPOINTS (Manual)                  │
│  ─────────────────────────────────────────  │
│  Path: /api/v1/{feature}/{action}           │
│  Custom business logic                      │
│  Complex operations                         │
│  ─────────────────────────────────────────  │
│  Full control over request/response         │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 When to Use Custom Endpoints:

• Business logic beyond CRUD
• Aggregations and reports
• Integration with external services
• Complex multi-step operations
• Batch operations
• Custom authentication flows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 File Structure:

app/api/v1/
├── entities/              # Auto-generated entity APIs
│   └── [entity]/
│       └── route.ts
├── billing/               # Custom: Billing endpoints
│   ├── checkout/route.ts
│   └── portal/route.ts
├── reports/               # Custom: Reporting endpoints
│   └── sales/route.ts
└── integrations/          # Custom: External integrations
    └── webhook/route.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Create Route Handler)
[2] Show me entity endpoint examples
[3] What's the difference in authentication?
```

---

## Step 2: Create Route Handler

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Create Route Handler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a new API route in Next.js App Router:
```

**📋 Route Handler Example:**

```typescript
// app/api/v1/reports/sales/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/auth/authenticateRequest'
import { checkPermission } from '@/core/lib/permissions/check'
import { createApiResponse, createApiError } from '@/core/lib/api/response'
import { SalesReportService } from '@/core/lib/services/sales-report.service'
import { z } from 'zod'

// Query parameters schema
const QuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
})

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate (supports both session and API key)
    const auth = await authenticateRequest(request)
    if (!auth.isAuthenticated) {
      return createApiError('Unauthorized', 401)
    }

    const { userId, teamId } = auth

    // 2. Check permissions
    const canViewReports = await checkPermission(userId, teamId, 'reports.view')
    if (!canViewReports) {
      return createApiError('Permission denied', 403)
    }

    // 3. Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const params = QuerySchema.parse(searchParams)

    // 4. Execute business logic
    const report = await SalesReportService.generate({
      teamId,
      startDate: params.startDate,
      endDate: params.endDate,
      groupBy: params.groupBy,
    })

    // 5. Return success response
    return createApiResponse({
      data: report,
      meta: {
        generatedAt: new Date().toISOString(),
        period: { start: params.startDate, end: params.endDate },
      },
    })
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return createApiError('Validation error', 400, error.errors)
    }

    // Log and return generic error
    console.error('[Sales Report API]', error)
    return createApiError('Internal server error', 500)
  }
}
```

**📋 Route Handler Pattern:**

1. Authenticate request
2. Check permissions
3. Validate input (query/body)
4. Execute business logic
5. Return standardized response
6. Handle errors gracefully

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Dual Authentication)
[2] Show me POST endpoint example
[3] How do I handle file uploads?
```

---

## Step 3: Implement Dual Authentication

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Implement Dual Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NextSpark supports dual authentication:
```

**📋 Auth Result Type:**

```typescript
// core/lib/auth/authenticateRequest.ts

type AuthResult = {
  isAuthenticated: boolean
  userId?: string
  teamId?: string
  authMethod: 'session' | 'api_key' | null
  apiKeyScopes?: string[]  // For API key auth
}

export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult>
```

**📋 Authentication Methods:**

**1. Session Authentication (Browser)**

User is logged in via browser. Session cookie sent automatically.

```typescript
// Request from browser (automatic)
const auth = await authenticateRequest(request)
// auth.authMethod === 'session'
```

**2. API Key Authentication (External)**

For server-to-server or external integrations.

```typescript
// Request with API key header
// Authorization: Bearer sk_xxx
const auth = await authenticateRequest(request)
// auth.authMethod === 'api_key'
// auth.apiKeyScopes === ['reports:read', 'entities:read']
```

**📋 Using Authentication in Your Endpoint:**

```typescript
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)

  // Check if authenticated
  if (!auth.isAuthenticated) {
    return createApiError('Unauthorized', 401)
  }

  // Destructure common values
  const { userId, teamId, authMethod } = auth

  // Optional: Check API key scopes
  if (authMethod === 'api_key') {
    const hasScope = auth.apiKeyScopes?.includes('reports:read')
    if (!hasScope) {
      return createApiError('Insufficient scope', 403)
    }
  }

  // Continue with authenticated request...
}
```

**📋 API Key Scopes:**

Scopes control what an API key can access:

- `entities:read` - Read entity data
- `entities:write` - Create/update entities
- `entities:delete` - Delete entities
- `reports:read` - View reports
- `billing:manage` - Manage subscriptions
- `team:manage` - Manage team members

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Validation)
[2] How do I create API keys?
[3] Show me scope checking examples
```

---

## Step 4: Add Validation & Error Handling

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Add Validation & Error Handling
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Input Validation with Zod:**

```typescript
// Define request body schema
const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    price: z.number().positive(),
  })).min(1).max(50),
  notes: z.string().max(500).optional(),
  shippingAddress: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().length(2),
  }),
})

export async function POST(request: NextRequest) {
  // ... authentication ...

  try {
    // Parse and validate body
    const body = await request.json()
    const data = CreateOrderSchema.parse(body)

    // data is fully typed and validated
    const order = await OrderService.create(data)

    return createApiResponse({ data: order }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiError('Validation error', 400, {
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
    }
    throw error
  }
}
```

**📋 Standardized API Response Format:**

```json
// Success response
{
  "success": true,
  "data": { "..." },
  "meta": {
    "page": 1,
    "total": 100
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": [
      { "field": "items", "message": "Required" }
    ]
  }
}
```

**📋 Response Helpers:**

```typescript
import { createApiResponse, createApiError } from '@/core/lib/api/response'

// Success responses
createApiResponse({ data: result })                    // 200
createApiResponse({ data: result }, { status: 201 })   // 201 Created

// Error responses
createApiError('Unauthorized', 401)
createApiError('Not found', 404)
createApiError('Validation error', 400, { errors: [...] })
createApiError('Rate limit exceeded', 429, { retryAfter: 60 })
```

**📋 Error Handling Best Practices:**

```typescript
export async function POST(request: NextRequest) {
  try {
    // ... your logic ...
  } catch (error) {
    // 1. Validation errors (Zod)
    if (error instanceof z.ZodError) {
      return createApiError('Validation error', 400, error.errors)
    }

    // 2. Known business errors
    if (error instanceof InsufficientBalanceError) {
      return createApiError('Insufficient balance', 402, {
        required: error.required,
        available: error.available,
      })
    }

    // 3. Not found errors
    if (error instanceof NotFoundError) {
      return createApiError('Resource not found', 404)
    }

    // 4. Unknown errors (log and return generic)
    console.error('[API Error]', error)
    return createApiError('Internal server error', 500)
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Testing)
[2] Show me pagination examples
[3] How do I handle rate limiting?
```

---

## Step 5: Test Your Endpoint

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Test Your Endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Test with curl:**

```bash
# GET request with session cookie
curl http://localhost:3000/api/v1/reports/sales \
  -H "Cookie: better-auth.session_token=xxx"

# GET request with API key
curl http://localhost:3000/api/v1/reports/sales \
  -H "Authorization: Bearer sk_xxx"

# POST request with body
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-123",
    "items": [
      { "productId": "prod-456", "quantity": 2, "price": 29.99 }
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "postalCode": "10001",
      "country": "US"
    }
  }'
```

**📋 Test with Cypress (API tests):**

```typescript
// cypress/e2e/api/orders.cy.ts
describe('Orders API', () => {
  beforeEach(() => {
    cy.getApiKey().as('apiKey')
  })

  it('should create an order', function() {
    cy.request({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: {
        customerId: 'cust-123',
        items: [{ productId: 'prod-456', quantity: 2, price: 29.99 }],
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          postalCode: '10001',
          country: 'US',
        },
      },
    }).then((response) => {
      expect(response.status).to.eq(201)
      expect(response.body.success).to.be.true
      expect(response.body.data.id).to.exist
    })
  })

  it('should return validation error for invalid input', function() {
    cy.request({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: {
        customerId: 'invalid', // Not a UUID
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400)
      expect(response.body.success).to.be.false
    })
  })
})
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Custom API endpoint structure
• Dual authentication (session + API key)
• Input validation with Zod
• Standardized error handling
• Testing with curl and Cypress

📚 Related tutorials:
   • /how-to:create-entity - Auto-generated CRUD APIs
   • /how-to:set-scheduled-actions - Background tasks

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:create-entity` | Auto-generated entity APIs |
| `/session:test:write` | Write API tests |
