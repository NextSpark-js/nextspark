# Testing API Endpoints

## Introduction

API endpoint testing validates that your REST APIs work correctly, handle errors gracefully, and enforce authentication and permissions properly.

**Approach:** Use both Jest (unit) and Cypress (integration) for comprehensive API coverage.

---

## Jest API Tests

### Testing Route Handlers

```typescript
// core/tests/jest/api/tasks.test.ts
import { GET, POST } from '@/app/api/v1/tasks/route'
import { NextRequest } from 'next/server'

describe('Tasks API', () => {
  describe('GET /api/v1/tasks', () => {
    it('should return tasks list', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tasks')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('should require authentication', async () => {
      // Test without auth headers
      const request = new NextRequest('http://localhost:3000/api/v1/tasks')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/v1/tasks', () => {
    it('should create task with valid data', async () => {
      const body = {
        title: 'Test Task',
        description: 'Test Description'
      }

      const request = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify(body)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.title).toBe('Test Task')
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
    })
  })
})
```

---

## Cypress API Tests

### Testing with Real HTTP Requests

```typescript
// core/tests/cypress/e2e/api/tasks-api.cy.ts
describe('Tasks API', () => {
  const API_KEY = Cypress.env('VALID_API_KEY')
  const BASE_URL = Cypress.env('API_BASE_URL')

  describe('GET /api/v1/tasks', () => {
    it('should fetch tasks successfully', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/tasks`,
        headers: {
          'x-api-key': API_KEY
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('data')
        expect(response.body.data).to.be.an('array')
      })
    })

    it('should return 401 without API key', () => {
      cy.request({
        method: 'GET',
        url: `${BASE_URL}/api/v1/tasks`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
      })
    })
  })

  describe('POST /api/v1/tasks', () => {
    it('should create task', () => {
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/v1/tasks`,
        headers: {
          'x-api-key': API_KEY
        },
        body: {
          title: 'Test Task',
          description: 'Created via API test'
        }
      }).then((response) => {
        expect(response.status).to.eq(201)
        expect(response.body.data).to.have.property('id')
        expect(response.body.data.title).to.eq('Test Task')
      })
    })
  })
})
```

---

## Testing Authentication

### Session-Based Auth

```typescript
it('should access protected endpoint with session', () => {
  // Login first
  cy.login('user@example.com', 'password')

  // Access protected endpoint
  cy.request('/api/v1/profile').then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.data.email).to.eq('user@example.com')
  })
})
```

### API Key Auth

```typescript
it('should access endpoint with valid API key', () => {
  cy.request({
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': Cypress.env('VALID_API_KEY')
    }
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})
```

---

## Testing Error Handling

```typescript
describe('Error Handling', () => {
  it('should return 404 for non-existent resource', () => {
    cy.request({
      url: '/api/v1/tasks/non-existent-id',
      headers: { 'x-api-key': API_KEY },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(404)
      expect(response.body.error).to.exist
    })
  })

  it('should return 400 for invalid data', () => {
    cy.request({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { 'x-api-key': API_KEY },
      body: { /* missing required fields */ },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400)
      expect(response.body.error).to.contain('validation')
    })
  })
})
```

---

## Testing Query Parameters

```typescript
it('should filter tasks by status', () => {
  cy.request({
    url: '/api/v1/tasks?status=completed',
    headers: { 'x-api-key': API_KEY }
  }).then((response) => {
    expect(response.status).to.eq(200)
    response.body.data.forEach(task => {
      expect(task.status).to.eq('completed')
    })
  })
})

it('should paginate results', () => {
  cy.request({
    url: '/api/v1/tasks?limit=10&offset=0',
    headers: { 'x-api-key': API_KEY }
  }).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.data.length).to.be.lte(10)
    expect(response.body).to.have.property('pagination')
  })
})
```

---

## Best Practices

### ✅ DO

```typescript
// Test all HTTP methods
describe('CRUD Operations', () => {
  it('GET - List', () => {})
  it('GET - Detail', () => {})
  it('POST - Create', () => {})
  it('PUT - Update', () => {})
  it('DELETE - Delete', () => {})
})

// Test authentication
it('should require authentication', () => {})
it('should enforce permissions', () => {})

// Test error cases
it('should return 404 for invalid ID', () => {})
it('should validate input data', () => {})

// Clean up test data
afterEach(() => {
  // Delete created entities
})
```

### ❌ DON'T

```typescript
// Skip authentication tests
// Authentication is critical!

// Leave test data in database
// Always clean up

// Test only happy paths
// Test errors, edge cases, permissions
```

---

## Quick Reference

```typescript
// Cypress API testing
cy.request({
  method: 'POST',
  url: '/api/endpoint',
  headers: { 'x-api-key': key },
  body: { data },
  failOnStatusCode: false  // Test error responses
})

// Common assertions
expect(response.status).to.eq(200)
expect(response.body).to.have.property('data')
expect(response.body.data).to.be.an('array')
expect(response.headers['content-type']).to.include('application/json')
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development
