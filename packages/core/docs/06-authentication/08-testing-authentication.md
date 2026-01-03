# Testing Authentication

This guide covers testing strategies for the authentication system, including login flows, protected routes, OAuth, API keys, and permissions.

## Testing Setup

### Cypress Configuration

```javascript
// cypress.config.js
module.exports = {
  e2e: {
    baseUrl: 'http://localhost:5173',
    env: {
      TEST_USER_EMAIL: 'test@example.com',
      TEST_USER_PASSWORD: 'Test1234!',
      API_KEY: 'your_test_api_key_here'
    }
  }
}
```

### Jest Configuration

```javascript
// jest.config.cjs
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/core/tests/setup.ts'],
}
```

### Test Database

```bash
# Create test database
createdb saas_test

# Run migrations
DATABASE_URL="postgresql://localhost/saas_test" pnpm migrate
```

## Testing Email/Password Authentication

### Sign Up Flow

```typescript
// core/tests/cypress/e2e/auth/signup.cy.ts
describe('Sign Up', () => {
  beforeEach(() => {
    cy.visit('/signup')
  })
  
  it('should sign up successfully', () => {
    const testEmail = `test-${Date.now()}@example.com`
    
    cy.get('input[name="firstName"]').type('Test')
    cy.get('input[name="lastName"]').type('User')
    cy.get('input[name="email"]').type(testEmail)
    cy.get('input[name="password"]').type('Test1234!')
    cy.get('input[name="confirmPassword"]').type('Test1234!')
    
    cy.get('button[type="submit"]').click()
    
    // Should show verification message
    cy.contains('Please check your email').should('be.visible')
  })
  
  it('should show error for existing email', () => {
    cy.get('input[name="email"]').type('existing@example.com')
    cy.get('input[name="password"]').type('Test1234!')
    
    cy.get('button[type="submit"]').click()
    
    cy.contains('Email already exists').should('be.visible')
  })
  
  it('should validate password strength', () => {
    cy.get('input[name="password"]').type('weak')
    
    cy.contains('Password must be at least 8 characters').should('be.visible')
  })
})
```

### Sign In Flow

```typescript
// core/tests/cypress/e2e/auth/signin.cy.ts
describe('Sign In', () => {
  beforeEach(() => {
    cy.visit('/login')
  })
  
  it('should sign in with valid credentials', () => {
    cy.get('input[name="email"]').type(Cypress.env('TEST_USER_EMAIL'))
    cy.get('input[name="password"]').type(Cypress.env('TEST_USER_PASSWORD'))
    
    cy.get('button[type="submit"]').click()
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard')
    cy.contains('Welcome').should('be.visible')
  })
  
  it('should show error for invalid credentials', () => {
    cy.get('input[name="email"]').type('wrong@example.com')
    cy.get('input[name="password"]').type('wrongpassword')
    
    cy.get('button[type="submit"]').click()
    
    cy.contains('Invalid email or password').should('be.visible')
  })
  
  it('should handle unverified email', () => {
    cy.get('input[name="email"]').type('unverified@example.com')
    cy.get('input[name="password"]').type('Test1234!')
    
    cy.get('button[type="submit"]').click()
    
    cy.contains('Please verify your email').should('be.visible')
  })
})
```

### Sign Out Flow

```typescript
describe('Sign Out', () => {
  beforeEach(() => {
    // Sign in first
    cy.login(Cypress.env('TEST_USER_EMAIL'), Cypress.env('TEST_USER_PASSWORD'))
    cy.visit('/dashboard')
  })
  
  it('should sign out successfully', () => {
    cy.get('[data-testid="user-menu"]').click()
    cy.get('[data-testid="sign-out"]').click()
    
    // Should redirect to login
    cy.url().should('include', '/login')
    
    // Session should be cleared
    cy.getCookie('better-auth.session_token').should('not.exist')
  })
})
```

## Testing Protected Routes

### Middleware Protection

```typescript
// core/tests/cypress/e2e/auth/protected-routes.cy.ts
describe('Protected Routes', () => {
  it('should redirect to login when not authenticated', () => {
    cy.visit('/dashboard')
    
    cy.url().should('include', '/login')
  })
  
  it('should allow access when authenticated', () => {
    cy.login(Cypress.env('TEST_USER_EMAIL'), Cypress.env('TEST_USER_PASSWORD'))
    
    cy.visit('/dashboard')
    cy.url().should('include', '/dashboard')
    cy.contains('Dashboard').should('be.visible')
  })
  
  it('should redirect admin routes for non-admin users', () => {
    cy.login('member@example.com', 'Test1234!')
    
    cy.visit('/admin')
    cy.url().should('include', '/403')
  })
})
```

## Testing OAuth

### Google OAuth Flow (Mocked)

```typescript
// core/tests/cypress/e2e/auth/oauth.cy.ts
describe('Google OAuth', () => {
  it('should sign in with Google (mocked)', () => {
    cy.intercept('GET', '**/api/auth/callback/google*', {
      statusCode: 302,
      headers: {
        location: '/dashboard'
      }
    }).as('googleCallback')
    
    cy.visit('/login')
    cy.get('[data-testid="google-signin"]').click()
    
    // Mock would redirect to dashboard
    cy.wait('@googleCallback')
    cy.url().should('include', '/dashboard')
  })
})
```

### OAuth Profile Mapping

```typescript
// core/tests/jest/auth/oauth.test.ts
import { mapGoogleProfile } from '@/core/lib/auth'

describe('Google OAuth Profile Mapping', () => {
  it('should map Google profile correctly', () => {
    const googleProfile = {
      email: 'user@gmail.com',
      name: 'John Doe',
      given_name: 'John',
      family_name: 'Doe',
      picture: 'https://example.com/photo.jpg',
      email_verified: true
    }
    
    const mapped = mapGoogleProfile(googleProfile)
    
    expect(mapped).toEqual({
      email: 'user@gmail.com',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      image: 'https://example.com/photo.jpg',
      emailVerified: true,
      language: 'en',
      role: 'member'
    })
  })
  
  it('should handle missing given_name and family_name', () => {
    const googleProfile = {
      email: 'user@gmail.com',
      name: 'John Doe',
      email_verified: true
    }
    
    const mapped = mapGoogleProfile(googleProfile)
    
    expect(mapped.firstName).toBe('John')
    expect(mapped.lastName).toBe('Doe')
  })
})
```

## Testing API Key Authentication

### API Key Validation

```typescript
// core/tests/jest/auth/api-keys.test.ts
import { validateApiKey } from '@/core/lib/api/auth'
import { NextRequest } from 'next/server'

describe('API Key Validation', () => {
  it('should validate correct API key', async () => {
    const request = new NextRequest('http://localhost/api/tasks', {
      headers: {
        'Authorization': `Bearer ${process.env.TEST_API_KEY}`
      }
    })
    
    const auth = await validateApiKey(request)
    
    expect(auth).not.toBeNull()
    expect(auth?.userId).toBeDefined()
    expect(auth?.scopes).toContain('tasks:read')
  })
  
  it('should reject invalid API key', async () => {
    const request = new NextRequest('http://localhost/api/tasks', {
      headers: {
        'Authorization': 'Bearer sk_test_invalid'
      }
    })
    
    const auth = await validateApiKey(request)
    
    expect(auth).toBeNull()
  })
  
  it('should reject expired API key', async () => {
    const expiredKey = 'sk_test_expired'
    
    const request = new NextRequest('http://localhost/api/tasks', {
      headers: {
        'Authorization': `Bearer ${expiredKey}`
      }
    })
    
    const auth = await validateApiKey(request)
    
    expect(auth).toBeNull()
  })
})
```

### Scope Checking

```typescript
describe('API Key Scopes', () => {
  it('should check scope correctly', () => {
    const auth = {
      userId: 'user-123',
      keyId: 'key-456',
      scopes: ['tasks:read', 'tasks:write']
    }
    
    expect(hasScope(auth, 'tasks:read')).toBe(true)
    expect(hasScope(auth, 'tasks:delete')).toBe(false)
  })
  
  it('should handle wildcard scopes', () => {
    const auth = {
      userId: 'user-123',
      keyId: 'key-456',
      scopes: ['*']
    }
    
    expect(hasScope(auth, 'tasks:read')).toBe(true)
    expect(hasScope(auth, 'users:delete')).toBe(true)
  })
})
```

### API Endpoint with API Key

```typescript
// core/tests/cypress/e2e/api/tasks-api.cy.ts
describe('Tasks API with API Key', () => {
  it('should fetch tasks with valid API key', () => {
    cy.request({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: {
        'Authorization': `Bearer ${Cypress.env('API_KEY')}`
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.be.true
      expect(response.body.data).to.be.an('array')
    })
  })
  
  it('should reject request without API key', () => {
    cy.request({
      method: 'GET',
      url: '/api/v1/tasks',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(401)
    })
  })
})
```

## Testing Session Management

### Session Persistence

```typescript
describe('Session Persistence', () => {
  it('should persist session across page loads', () => {
    cy.login(Cypress.env('TEST_USER_EMAIL'), Cypress.env('TEST_USER_PASSWORD'))
    
    cy.visit('/dashboard')
    cy.contains('Dashboard').should('be.visible')
    
    // Reload page
    cy.reload()
    
    // Should still be authenticated
    cy.url().should('include', '/dashboard')
    cy.contains('Dashboard').should('be.visible')
  })
  
  it('should clear session on sign out', () => {
    cy.login(Cypress.env('TEST_USER_EMAIL'), Cypress.env('TEST_USER_PASSWORD'))
    cy.visit('/dashboard')
    
    // Sign out
    cy.get('[data-testid="sign-out"]').click()
    
    // Try to access protected route
    cy.visit('/dashboard')
    cy.url().should('include', '/login')
  })
})
```

## Testing Permissions

### Role-Based Access

```typescript
describe('Role-Based Access Control', () => {
  it('should allow admin to access admin routes', () => {
    cy.login('admin@example.com', 'Admin1234!')
    
    cy.visit('/admin')
    cy.url().should('include', '/admin')
  })
  
  it('should block non-admin from admin routes', () => {
    cy.login('member@example.com', 'Member1234!')
    
    cy.visit('/admin')
    cy.url().should('include', '/403')
  })
})
```

### User Flags

```typescript
// core/tests/jest/auth/permissions.test.ts
describe('User Flags', () => {
  it('should check user flags correctly', () => {
    const user = {
      id: 'user-123',
      role: 'member',
      flags: ['beta_tester', 'vip']
    }
    
    expect(hasFlag(user, 'beta_tester')).toBe(true)
    expect(hasFlag(user, 'early_adopter')).toBe(false)
  })
})
```

## Test Fixtures

### User Fixtures

```typescript
// test/fixtures/users.ts
export const testUsers = {
  admin: {
    email: 'admin@example.com',
    password: 'Admin1234!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    flags: []
  },
  member: {
    email: 'member@example.com',
    password: 'Member1234!',
    firstName: 'Member',
    lastName: 'User',
    role: 'member',
    flags: ['beta_tester']
  }
}
```

### API Key Fixtures

```typescript
// test/fixtures/api-keys.ts
export const testApiKeys = {
  readOnly: {
    key: 'sk_test_readonly',
    scopes: ['tasks:read', 'users:read']
  },
  fullAccess: {
    key: 'sk_test_admin',
    scopes: ['*']
  }
}
```

## Custom Cypress Commands

### Login Command

```typescript
// core/tests/cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('input[name="email"]').type(email)
    cy.get('input[name="password"]').type(password)
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
  })
})

// Usage
cy.login('user@example.com', 'password')
```

### API Request Command

```typescript
Cypress.Commands.add('apiRequest', (method: string, url: string, body?: any) => {
  return cy.request({
    method,
    url: `/api/v1${url}`,
    headers: {
      'Authorization': `Bearer ${Cypress.env('API_KEY')}`
    },
    body
  })
})

// Usage
cy.apiRequest('GET', '/tasks')
cy.apiRequest('POST', '/tasks', { title: 'New Task' })
```

## Mocking Authentication

### Mock Session

```typescript
// core/tests/jest/__mocks__/auth.ts
export const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'member',
    flags: ['beta_tester']
  }
}

export const auth = {
  api: {
    getSession: jest.fn().mockResolvedValue(mockSession)
  }
}
```

### Mock API Key Validation

```typescript
jest.mock('@/core/lib/api/auth', () => ({
  validateApiKey: jest.fn().mockResolvedValue({
    userId: 'user-123',
    keyId: 'key-456',
    scopes: ['tasks:read']
  })
}))
```

## Testing Best Practices

### Isolation

```typescript
// Clean up after each test
afterEach(async () => {
  await cleanupTestData()
})
```

### Deterministic Tests

```typescript
// Use fixed timestamps
const fixedDate = new Date('2024-01-01T00:00:00Z')
jest.spyOn(global, 'Date').mockImplementation(() => fixedDate)
```

### Parallel Execution

```typescript
// Use unique test data per test
const uniqueEmail = `test-${Date.now()}@example.com`
```

## Next Steps

Congratulations! You've completed the authentication documentation. For more information:

1. **[Overview](./01-overview.md)** - Authentication system overview
2. **[Better Auth Integration](./02-better-auth-integration.md)** - Better Auth setup
3. **[API Documentation](/docs/api)** - External API reference

---

> 💡 **Tip**: Write tests for all authentication flows and run them in CI/CD to catch security issues early.
