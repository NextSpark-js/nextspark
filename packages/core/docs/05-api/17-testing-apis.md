# Testing APIs

**Comprehensive testing strategies • Unit tests • Integration tests • E2E testing • Load testing**

---

## Table of Contents

- [Overview](#overview)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [E2E Testing with Cypress](#e2e-testing-with-cypress)
- [Load Testing](#load-testing)
- [Test Data Management](#test-data-management)
- [CI/CD Integration](#cicd-integration)

---

## Overview

**Complete testing strategy** for API v1 endpoints.

**Testing Levels:**
- ✅ **Unit Tests** - Test individual functions and handlers
- ✅ **Integration Tests** - Test API routes with database
- ✅ **E2E Tests** - Test complete user flows with Cypress
- ✅ **Load Tests** - Test performance under load
- ✅ **Contract Tests** - Validate API contracts

**Coverage Goals:**
- **90%+ coverage** on critical paths (authentication, CRUD operations)
- **80%+ coverage** on important features (filtering, pagination)
- **70%+ coverage** overall

---

## Unit Testing

### Testing Generic Handlers

```typescript
// core/lib/api/entity/generic-handler.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { handleGenericList, handleGenericCreate } from './generic-handler'
import { db } from '@/lib/db'

// Mock dependencies
vi.mock('@/lib/db')
vi.mock('@/lib/auth')

describe('handleGenericList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns list of entities', async () => {
    const mockTasks = [
      { id: 'tsk_001', title: 'Task 1', status: 'todo' },
      { id: 'tsk_002', title: 'Task 2', status: 'completed' }
    ]

    vi.mocked(db.findMany).mockResolvedValue({
      data: mockTasks,
      total: 2
    })

    const request = new NextRequest('http://localhost/api/v1/tasks?page=1&limit=20')
    const response = await handleGenericList(request, { params: { entity: 'tasks' } })

    const json = await response.json()

    expect(json).toEqual({
      success: true,
      data: mockTasks,
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    })
  })

  it('applies filters correctly', async () => {
    const filter = { status: { $in: ['todo', 'in_progress'] } }
    const encodedFilter = encodeURIComponent(JSON.stringify(filter))

    const request = new NextRequest(
      `http://localhost/api/v1/tasks?filter=${encodedFilter}`
    )

    await handleGenericList(request, { params: { entity: 'tasks' } })

    expect(db.findMany).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({
        filter: expect.objectContaining({
          status: { $in: ['todo', 'in_progress'] }
        })
      })
    )
  })

  it('validates pagination parameters', async () => {
    const request = new NextRequest('http://localhost/api/v1/tasks?page=-1&limit=1000')
    const response = await handleGenericList(request, { params: { entity: 'tasks' } })

    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('INVALID_PAGINATION')
  })

  it('handles database errors', async () => {
    vi.mocked(db.findMany).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost/api/v1/tasks')
    const response = await handleGenericList(request, { params: { entity: 'tasks' } })

    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.code).toBe('SERVER_ERROR')
  })
})

describe('handleGenericCreate', () => {
  it('creates entity with valid data', async () => {
    const newTask = {
      id: 'tsk_003',
      title: 'New Task',
      status: 'todo',
      createdAt: new Date().toISOString()
    }

    vi.mocked(db.create).mockResolvedValue(newTask)

    const request = new NextRequest('http://localhost/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Task', status: 'todo' })
    })

    const response = await handleGenericCreate(request, { params: { entity: 'tasks' } })
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json).toEqual({
      success: true,
      data: newTask
    })
  })

  it('validates required fields', async () => {
    const request = new NextRequest('http://localhost/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({ status: 'todo' }) // Missing title
    })

    const response = await handleGenericCreate(request, { params: { entity: 'tasks' } })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.details).toHaveProperty('title')
  })
})
```

### Testing Authentication

```typescript
// core/lib/api/auth/authenticate.test.ts
import { describe, it, expect, vi } from 'vitest'
import { authenticateRequest } from './authenticate'
import { NextRequest } from 'next/server'

describe('authenticateRequest', () => {
  it('authenticates with valid API key', async () => {
    const request = new NextRequest('http://localhost/api/v1/tasks', {
      headers: {
        'Authorization': 'Bearer sk_test_abc123'
      }
    })

    const result = await authenticateRequest(request)

    expect(result.success).toBe(true)
    expect(result.type).toBe('api_key')
    expect(result.user).toBeDefined()
  })

  it('authenticates with valid session', async () => {
    const request = new NextRequest('http://localhost/api/v1/tasks', {
      headers: {
        'Cookie': 'session=valid_session_token'
      }
    })

    const result = await authenticateRequest(request)

    expect(result.success).toBe(true)
    expect(result.type).toBe('session')
    expect(result.user).toBeDefined()
  })

  it('rejects invalid API key', async () => {
    const request = new NextRequest('http://localhost/api/v1/tasks', {
      headers: {
        'Authorization': 'Bearer invalid_key'
      }
    })

    const result = await authenticateRequest(request)

    expect(result.success).toBe(false)
    expect(result.type).toBe('none')
  })

  it('validates API key scopes', async () => {
    const request = new NextRequest('http://localhost/api/v1/tasks', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer sk_test_readonly'
      }
    })

    const result = await authenticateRequest(request)

    expect(result.success).toBe(false)
    expect(result.error).toContain('insufficient permissions')
  })
})
```

### Testing Rate Limiting

```typescript
// core/lib/api/rate-limit/check.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit } from './check'
import { redis } from '@/lib/redis'

vi.mock('@/lib/redis')

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows request within limit', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1)

    const result = await checkRateLimit('user_123', '/api/v1/tasks')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(999)
  })

  it('blocks request over limit', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1001)

    const result = await checkRateLimit('user_123', '/api/v1/tasks')

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeDefined()
  })

  it('sets expiry on first request', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1)

    await checkRateLimit('user_123', '/api/v1/tasks')

    expect(redis.expire).toHaveBeenCalledWith(
      'rate_limit:user_123:/api/v1/tasks',
      3600
    )
  })
})
```

---

## Integration Testing

### Testing Complete API Routes

```typescript
// app/api/v1/tasks/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { db } from '@/lib/db'
import { cleanupTestData, createTestUser } from '@/test/helpers'

describe('Tasks API', () => {
  let testUser: any
  let authHeader: string

  beforeEach(async () => {
    testUser = await createTestUser()
    authHeader = `Bearer ${testUser.apiKey}`
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('GET /api/v1/tasks', () => {
    it('returns user tasks', async () => {
      // Create test tasks
      await db.create('tasks', {
        userId: testUser.id,
        title: 'Task 1',
        status: 'todo'
      })
      await db.create('tasks', {
        userId: testUser.id,
        title: 'Task 2',
        status: 'completed'
      })

      const request = new NextRequest('http://localhost/api/v1/tasks', {
        headers: { Authorization: authHeader }
      })

      const response = await GET(request, { params: { entity: 'tasks' } })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(2)
    })

    it('filters tasks by status', async () => {
      await db.create('tasks', {
        userId: testUser.id,
        title: 'Todo Task',
        status: 'todo'
      })
      await db.create('tasks', {
        userId: testUser.id,
        title: 'Completed Task',
        status: 'completed'
      })

      const filter = { status: 'todo' }
      const encodedFilter = encodeURIComponent(JSON.stringify(filter))

      const request = new NextRequest(
        `http://localhost/api/v1/tasks?filter=${encodedFilter}`,
        { headers: { Authorization: authHeader } }
      )

      const response = await GET(request, { params: { entity: 'tasks' } })
      const json = await response.json()

      expect(json.data).toHaveLength(1)
      expect(json.data[0].status).toBe('todo')
    })

    it('paginates results', async () => {
      // Create 25 tasks
      for (let i = 0; i < 25; i++) {
        await db.create('tasks', {
          userId: testUser.id,
          title: `Task ${i}`,
          status: 'todo'
        })
      }

      const request = new NextRequest(
        'http://localhost/api/v1/tasks?page=1&limit=10',
        { headers: { Authorization: authHeader } }
      )

      const response = await GET(request, { params: { entity: 'tasks' } })
      const json = await response.json()

      expect(json.data).toHaveLength(10)
      expect(json.meta.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false
      })
    })

    it('requires authentication', async () => {
      const request = new NextRequest('http://localhost/api/v1/tasks')
      const response = await GET(request, { params: { entity: 'tasks' } })

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/v1/tasks', () => {
    it('creates task with valid data', async () => {
      const request = new NextRequest('http://localhost/api/v1/tasks', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'New Task',
          description: 'Task description',
          status: 'todo'
        })
      })

      const response = await POST(request, { params: { entity: 'tasks' } })
      const json = await response.json()

      expect(response.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data).toMatchObject({
        title: 'New Task',
        description: 'Task description',
        status: 'todo',
        userId: testUser.id
      })

      // Verify in database
      const created = await db.findOne('tasks', { id: json.data.id })
      expect(created).toBeDefined()
    })

    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost/api/v1/tasks', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Missing title'
        })
      })

      const response = await POST(request, { params: { entity: 'tasks' } })
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.code).toBe('VALIDATION_ERROR')
      expect(json.details).toHaveProperty('title')
    })

    it('sanitizes input data', async () => {
      const request = new NextRequest('http://localhost/api/v1/tasks', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '<script>alert("xss")</script>',
          status: 'todo'
        })
      })

      const response = await POST(request, { params: { entity: 'tasks' } })
      const json = await response.json()

      expect(json.data.title).not.toContain('<script>')
    })
  })
})
```

### Testing with Real Database

```typescript
// test/integration/database.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { migrate } from '@/lib/db/migrate'

describe('Database Integration', () => {
  beforeAll(async () => {
    // Run migrations
    await migrate()
  })

  afterAll(async () => {
    // Cleanup
    await db.raw('TRUNCATE TABLE tasks CASCADE')
  })

  it('performs CRUD operations', async () => {
    // Create
    const created = await db.create('tasks', {
      title: 'Test Task',
      status: 'todo',
      userId: 'test_user'
    })

    expect(created).toHaveProperty('id')
    expect(created.title).toBe('Test Task')

    // Read
    const found = await db.findOne('tasks', { id: created.id })
    expect(found).toEqual(created)

    // Update
    const updated = await db.update('tasks', created.id, {
      status: 'completed'
    })
    expect(updated.status).toBe('completed')

    // Delete
    await db.delete('tasks', created.id)
    const deleted = await db.findOne('tasks', { id: created.id })
    expect(deleted).toBeNull()
  })

  it('handles transactions', async () => {
    await db.transaction(async (trx) => {
      const task1 = await trx.create('tasks', {
        title: 'Task 1',
        status: 'todo',
        userId: 'test_user'
      })

      const task2 = await trx.create('tasks', {
        title: 'Task 2',
        status: 'todo',
        userId: 'test_user'
      })

      expect(task1).toBeDefined()
      expect(task2).toBeDefined()
    })

    const tasks = await db.findMany('tasks', {
      filter: { userId: 'test_user' }
    })

    expect(tasks.data).toHaveLength(2)
  })
})
```

---

## E2E Testing with Cypress

### Testing Complete User Flows

```typescript
// cypress/e2e/tasks.cy.ts
describe('Task Management', () => {
  beforeEach(() => {
    // Login before each test
    cy.session('user-session', () => {
      cy.visit('/login')
      cy.get('[data-cy=email-input]').type('test@example.com')
      cy.get('[data-cy=password-input]').type('password123')
      cy.get('[data-cy=login-button]').click()
      cy.url().should('include', '/dashboard')
    })
  })

  it('creates a new task', () => {
    cy.visit('/tasks')

    // Open create dialog
    cy.get('[data-cy=create-task-button]').click()

    // Fill form
    cy.get('[data-cy=task-title-input]').type('Test Task')
    cy.get('[data-cy=task-description-input]').type('Test Description')
    cy.get('[data-cy=task-status-select]').select('todo')
    cy.get('[data-cy=task-priority-select]').select('high')

    // Submit
    cy.get('[data-cy=submit-task-button]').click()

    // Verify created
    cy.contains('Test Task').should('be.visible')
    cy.contains('Test Description').should('be.visible')
  })

  it('filters tasks by status', () => {
    cy.visit('/tasks')

    // Apply filter
    cy.get('[data-cy=status-filter]').click()
    cy.get('[data-cy=status-option-todo]').click()

    // Verify filtered results
    cy.get('[data-cy=task-card]').each(($card) => {
      cy.wrap($card).find('[data-cy=task-status]').should('contain', 'todo')
    })
  })

  it('completes a task', () => {
    cy.visit('/tasks')

    // Find task
    cy.contains('Test Task').parents('[data-cy=task-card]').within(() => {
      // Click complete button
      cy.get('[data-cy=complete-button]').click()

      // Verify status updated
      cy.get('[data-cy=task-status]').should('contain', 'completed')
    })
  })

  it('deletes a task', () => {
    cy.visit('/tasks')

    // Find task
    cy.contains('Test Task').parents('[data-cy=task-card]').within(() => {
      cy.get('[data-cy=delete-button]').click()
    })

    // Confirm deletion
    cy.get('[data-cy=confirm-delete-button]').click()

    // Verify deleted
    cy.contains('Test Task').should('not.exist')
  })

  it('handles pagination', () => {
    cy.visit('/tasks')

    // Verify pagination controls
    cy.get('[data-cy=pagination]').should('be.visible')
    cy.get('[data-cy=current-page]').should('contain', '1')

    // Go to next page
    cy.get('[data-cy=next-page-button]').click()
    cy.get('[data-cy=current-page]').should('contain', '2')

    // Go back
    cy.get('[data-cy=prev-page-button]').click()
    cy.get('[data-cy=current-page]').should('contain', '1')
  })
})
```

### Testing API Endpoints

```typescript
// cypress/e2e/api/tasks.cy.ts
describe('Tasks API', () => {
  let apiKey: string

  before(() => {
    // Get API key
    cy.task('getApiKey', 'test@example.com').then((key) => {
      apiKey = key as string
    })
  })

  it('lists tasks', () => {
    cy.request({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('success', true)
      expect(response.body).to.have.property('data')
      expect(response.body.data).to.be.an('array')
    })
  })

  it('creates task', () => {
    cy.request({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: {
        title: 'API Test Task',
        description: 'Created via API',
        status: 'todo',
        priority: 'high'
      }
    }).then((response) => {
      expect(response.status).to.eq(201)
      expect(response.body.data).to.have.property('id')
      expect(response.body.data.title).to.eq('API Test Task')
    })
  })

  it('validates required fields', () => {
    cy.request({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: {
        description: 'Missing title'
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400)
      expect(response.body.code).to.eq('VALIDATION_ERROR')
      expect(response.body.details).to.have.property('title')
    })
  })

  it('enforces rate limits', () => {
    // Make 1001 requests
    const requests = Array.from({ length: 1001 }, () =>
      cy.request({
        method: 'GET',
        url: '/api/v1/tasks',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        failOnStatusCode: false
      })
    )

    cy.wrap(Promise.all(requests)).then((responses: any[]) => {
      const rateLimited = responses.filter((r) => r.status === 429)
      expect(rateLimited.length).to.be.greaterThan(0)
    })
  })
})
```

---

## Load Testing

### Artillery Configuration

```yaml
# artillery.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Spike"
  processor: "./artillery-processor.js"
  variables:
    apiKey: "sk_test_abc123"

scenarios:
  - name: "List tasks"
    flow:
      - get:
          url: "/api/v1/tasks?page=1&limit=20"
          headers:
            Authorization: "Bearer {{ apiKey }}"
          expect:
            - statusCode: 200

  - name: "Create task"
    flow:
      - post:
          url: "/api/v1/tasks"
          headers:
            Authorization: "Bearer {{ apiKey }}"
            Content-Type: "application/json"
          json:
            title: "Load test task"
            status: "todo"
          expect:
            - statusCode: 201

  - name: "Update task"
    flow:
      - post:
          url: "/api/v1/tasks"
          headers:
            Authorization: "Bearer {{ apiKey }}"
          json:
            title: "Task to update"
          capture:
            json: "$.data.id"
            as: "taskId"
      - patch:
          url: "/api/v1/tasks/{{ taskId }}"
          headers:
            Authorization: "Bearer {{ apiKey }}"
          json:
            status: "completed"
          expect:
            - statusCode: 200
```

### Load Test Script

```javascript
// artillery-processor.js
module.exports = {
  setAuthToken: function(context, events, done) {
    // Set API key from environment
    context.vars.apiKey = process.env.API_KEY
    return done()
  },

  logResponse: function(requestParams, response, context, ee, next) {
    // Log slow requests
    if (response.timings.phases.total > 1000) {
      console.log(`Slow request: ${requestParams.url} took ${response.timings.phases.total}ms`)
    }
    return next()
  }
}
```

---

## Test Data Management

### Test Fixtures

```typescript
// test/fixtures/tasks.ts
export const taskFixtures = {
  todoTask: {
    title: 'Todo Task',
    description: 'This is a todo task',
    status: 'todo' as const,
    priority: 'medium' as const
  },

  completedTask: {
    title: 'Completed Task',
    description: 'This task is done',
    status: 'completed' as const,
    priority: 'high' as const
  },

  invalidTask: {
    // Missing required title
    description: 'Invalid task',
    status: 'todo' as const
  }
}

// Usage
import { taskFixtures } from '@/test/fixtures/tasks'

it('creates task', async () => {
  const response = await api.create('tasks', taskFixtures.todoTask)
  expect(response.data.status).toBe('todo')
})
```

### Database Seeding

```typescript
// test/helpers/seed.ts
import { db } from '@/lib/db'

export async function seedTestData() {
  // Create test user
  const user = await db.create('users', {
    email: 'test@example.com',
    name: 'Test User',
    password: await hash('password123')
  })

  // Create test tasks
  const tasks = await Promise.all([
    db.create('tasks', {
      userId: user.id,
      title: 'Task 1',
      status: 'todo'
    }),
    db.create('tasks', {
      userId: user.id,
      title: 'Task 2',
      status: 'in_progress'
    }),
    db.create('tasks', {
      userId: user.id,
      title: 'Task 3',
      status: 'completed'
    })
  ])

  return { user, tasks }
}

export async function cleanupTestData() {
  await db.raw('TRUNCATE TABLE tasks CASCADE')
  await db.raw('TRUNCATE TABLE users CASCADE')
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Run migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run E2E tests
        run: pnpm cypress run
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Next Steps

- [Troubleshooting](./18-troubleshooting.md) - Common issues and solutions
- [Monitoring](./19-monitoring-and-logging.md) - Production monitoring
- [Best Practices](./11-best-practices.md) - API best practices

**Documentation:** `core/docs/05-api/17-testing-apis.md`
