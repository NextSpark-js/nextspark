# Integration Testing

## Introduction

Integration tests verify that **multiple components work together correctly**. They test the interaction between different layers (API + Database, Frontend + Backend).

---

## API + Database Integration

### Testing Complete Flow

```typescript
describe('Task API Integration', () => {
  beforeEach(async () => {
    // Setup test database
    await setupTestDatabase()
  })

  afterEach(async () => {
    // Clean up
    await cleanTestDatabase()
  })

  it('should create and retrieve task', async () => {
    // Create task via API
    const createResponse = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'x-api-key': TEST_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Integration Test Task',
        description: 'Testing full flow'
      })
    })

    expect(createResponse.status).toBe(201)
    const created = await createResponse.json()

    // Retrieve task via API
    const getResponse = await fetch(`/api/v1/tasks/${created.data.id}`, {
      headers: { 'x-api-key': TEST_API_KEY }
    })

    expect(getResponse.status).toBe(200)
    const retrieved = await getResponse.json()
    expect(retrieved.data.title).toBe('Integration Test Task')

    // Verify in database
    const dbTask = await query(
      'SELECT * FROM tasks WHERE id = $1',
      [created.data.id]
    )
    expect(dbTask[0].title).toBe('Integration Test Task')
  })
})
```

---

## Frontend + Backend Integration

### Cypress Integration Tests

```typescript
describe('Task Management Integration', () => {
  beforeEach(() => {
    cy.login('user@example.com', 'password')
  })

  it('should create, update, and delete task', () => {
    // Create task
    cy.visit('/dashboard/tasks')
    cy.get('[data-cy="create-task"]').click()
    cy.get('[data-cy="title"]').type('Integration Test')
    cy.get('[data-cy="submit"]').click()
    
    // Verify created
    cy.contains('Integration Test')

    // Update task
    cy.contains('Integration Test').click()
    cy.get('[data-cy="edit"]').click()
    cy.get('[data-cy="title"]').clear().type('Updated Task')
    cy.get('[data-cy="submit"]').click()
    
    // Verify updated
    cy.contains('Updated Task')

    // Delete task
    cy.get('[data-cy="delete"]').click()
    cy.get('[data-cy="confirm"]').click()
    
    // Verify deleted
    cy.contains('Updated Task').should('not.exist')
  })
})
```

---

## Testing with Real Database

### Using Test Database

```typescript
// Setup test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

beforeAll(async () => {
  // Connect to test database
  await connectToDatabase(TEST_DATABASE_URL)
  
  // Run migrations
  await runMigrations()
})

afterAll(async () => {
  // Close connection
  await disconnectFromDatabase()
})
```

---

## Best Practices

### ✅ DO

```typescript
// Test real integrations
// Don't mock the layer you're testing

// Use test database
// Separate from production/development

// Clean state between tests
beforeEach(() => cleanDatabase())

// Test critical paths
// Auth + DB, API + DB, UI + API
```

### ❌ DON'T

```typescript
// Test too many layers at once
// Keep integration tests focused

// Share database between tests
// Use fresh state for each test

// Skip integration tests
// They catch real-world issues
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development
