# Test Data Management

## Introduction

Test data management involves creating, maintaining, and cleaning up data used in tests. Good test data practices ensure **reliable, repeatable, and isolated tests**.

---

## Fixtures

### Static Test Data

```typescript
// core/tests/cypress/fixtures/tasks.json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Test Task 1",
      "description": "Description for task 1",
      "status": "active"
    },
    {
      "id": "task-2",
      "title": "Test Task 2",
      "description": "Description for task 2",
      "status": "completed"
    }
  ]
}

// Usage in Cypress
cy.fixture('tasks').then((data) => {
  cy.intercept('GET', '/api/v1/tasks', data).as('getTasks')
})
```

---

## Factory Functions

### Generate Test Data Dynamically

```typescript
// core/tests/jest/__mocks__/factories.ts
export const createMockUser = (overrides = {}) => ({
  id: 'user-' + Math.random().toString(36).substr(2, 9),
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: new Date().toISOString(),
  ...overrides
})

export const createMockTask = (overrides = {}) => ({
  id: 'task-' + Math.random().toString(36).substr(2, 9),
  title: 'Test Task',
  description: 'Test description',
  status: 'active',
  userId: 'user-123',
  ...overrides
})

// Usage
const user = createMockUser({ role: 'admin' })
const task = createMockTask({ status: 'completed' })
```

---

## Test Data Cleanup

### Database Cleanup

```typescript
// Jest: Clean up after each test
afterEach(async () => {
  // Delete test data
  await query('DELETE FROM tasks WHERE title LIKE $1', ['Test%'])
  await query('DELETE FROM users WHERE email LIKE $1', ['test%'])
})

// Cypress: Clean up before each test
beforeEach(() => {
  cy.task('db:clean')  // Custom task to clean database
})
```

---

## Test Isolation

### Each Test is Independent

```typescript
describe('Task operations', () => {
  let testTask: any

  beforeEach(async () => {
    // Create fresh data for each test
    testTask = await createTask({
      title: 'Test Task',
      userId: 'test-user'
    })
  })

  afterEach(async () => {
    // Clean up
    await deleteTask(testTask.id)
  })

  it('should update task', async () => {
    // Test uses its own isolated data
    await updateTask(testTask.id, { title: 'Updated' })
    expect(testTask.title).toBe('Updated')
  })
})
```

---

## Best Practices

### ✅ DO

```typescript
// Use factories for dynamic data
const user = createMockUser()

// Clean up after tests
afterEach(() => cleanup())

// Use descriptive test data
const task = { title: 'Test: Should Complete Task' }

// Isolate test data
// Each test creates its own data
```

### ❌ DON'T

```typescript
// Share data between tests
// Tests become dependent on order

// Use production data
// Use dedicated test data

// Leave test data in database
// Always clean up

// Use random data without seed
// Makes tests non-reproducible
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development
