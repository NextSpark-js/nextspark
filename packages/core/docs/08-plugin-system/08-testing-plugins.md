# Testing Plugins

## Introduction

Comprehensive testing ensures plugin reliability and prevents regressions. This document covers unit testing with Jest, E2E testing with Cypress, and integration testing patterns for plugins.

**Testing Layers:**
1. **Unit Tests** (Jest) - Test plugin logic, utilities, and functions
2. **Integration Tests** (Jest) - Test API endpoints and data flows
3. **E2E Tests** (Cypress) - Test UI components and user workflows

**Coverage Requirements:**
- **90%+ coverage** for critical paths
- **80%+ coverage** for important features
- **All API endpoints** must have tests
- **All UI components** must have E2E tests

---

## Unit Testing with Jest

### Testing Plugin Functions

**Test File**: `contents/plugins/[plugin]/lib/__tests__/core-utils.test.ts`

**Example**:
```typescript
// contents/plugins/my-plugin/lib/__tests__/core-utils.test.ts
import { processData, validateInput } from '../core-utils'

describe('My Plugin Core Utils', () => {
  describe('processData', () => {
    it('processes valid input successfully', async () => {
      const result = await processData('test input')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('handles empty input', async () => {
      const result = await processData('')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Input is required')
    })

    it('handles processing errors', async () => {
      const result = await processData('invalid-input-that-causes-error')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('validateInput', () => {
    it('validates correct input', () => {
      expect(validateInput('valid input')).toBe(true)
    })

    it('rejects empty input', () => {
      expect(validateInput('')).toBe(false)
    })

    it('rejects null input', () => {
      expect(validateInput(null)).toBe(false)
    })
  })
})
```

---

### Mocking Plugin Dependencies

```typescript
import { processData } from '../core-utils'

// Mock external dependencies
jest.mock('@/core/lib/registries/plugin-registry', () => ({
  usePlugin: jest.fn(() => ({
    generateText: jest.fn().mockResolvedValue({ text: 'mocked response' }),
    calculateCost: jest.fn().mockReturnValue(0.05)
  }))
}))

describe('Plugin with Dependencies', () => {
  it('uses mocked dependencies', async () => {
    const result = await processData('test')

    expect(result.success).toBe(true)
    expect(result.data).toBe('mocked response')
  })
})
```

---

## Integration Testing API Routes

### Testing Plugin API Endpoints

**Test File**: `contents/plugins/[plugin]/api/__tests__/process.test.ts`

**Example**:
```typescript
// contents/plugins/my-plugin/api/__tests__/process.test.ts
import { POST, GET } from '../process/route'
import { NextRequest } from 'next/server'

// Mock authentication
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue({
    authenticated: true,
    session: {
      user: { id: 'test-user-id', email: 'test@example.com' }
    }
  })
}))

// Mock plugin registry
jest.mock('@/core/lib/registries/plugin-registry', () => ({
  usePlugin: jest.fn(() => ({
    processData: jest.fn().mockResolvedValue({ success: true, data: 'processed' })
  }))
}))

describe('POST /api/v1/plugin/my-plugin/process', () => {
  it('processes valid request', async () => {
    const request = new NextRequest('http://localhost/api/v1/plugin/my-plugin/process', {
      method: 'POST',
      body: JSON.stringify({ input: 'test' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toBe('processed')
  })

  it('rejects unauthenticated requests', async () => {
    // Override mock for this test
    jest.mocked(authenticateRequest).mockResolvedValueOnce({
      authenticated: false
    })

    const request = new NextRequest('http://localhost/api/v1/plugin/my-plugin/process', {
      method: 'POST',
      body: JSON.stringify({ input: 'test' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('validates request body', async () => {
    const request = new NextRequest('http://localhost/api/v1/plugin/my-plugin/process', {
      method: 'POST',
      body: JSON.stringify({}) // Missing 'input'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})

describe('GET /api/v1/plugin/my-plugin/process', () => {
  it('returns health check', async () => {
    const request = new NextRequest('http://localhost/api/v1/plugin/my-plugin/process', {
      method: 'GET'
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.plugin).toBe('my-plugin')
  })
})
```

---

## E2E Testing with Cypress

### Page Object Model for Plugin Components

**Page Object**: `cypress/support/page-objects/plugin-widget.page.ts`

```typescript
// cypress/support/page-objects/plugin-widget.page.ts
export class PluginWidgetPage {
  // Selectors
  private selectors = {
    widget: '[data-cy="my-widget"]',
    input: '[data-cy="my-widget-input"]',
    submitButton: '[data-cy="my-widget-submit"]',
    result: '[data-cy="my-widget-result"]'
  }

  // Actions
  visit() {
    cy.visit('/plugin-page')
    return this
  }

  typeInput(text: string) {
    cy.get(this.selectors.input).clear().type(text)
    return this
  }

  clickSubmit() {
    cy.get(this.selectors.submitButton).click()
    return this
  }

  // Assertions
  shouldBeVisible() {
    cy.get(this.selectors.widget).should('be.visible')
    return this
  }

  shouldShowResult(expectedText: string) {
    cy.get(this.selectors.result).should('contain', expectedText)
    return this
  }

  submitButtonShouldBeDisabled() {
    cy.get(this.selectors.submitButton).should('be.disabled')
    return this
  }
}
```

---

### E2E Test for Plugin Component

**Test File**: `cypress/e2e/plugins/my-plugin-widget.cy.ts`

```typescript
// cypress/e2e/plugins/my-plugin-widget.cy.ts
import { PluginWidgetPage } from '../../support/page-objects/plugin-widget.page'

describe('My Plugin Widget', () => {
  const widgetPage = new PluginWidgetPage()

  beforeEach(() => {
    // Login before each test
    cy.session('user-session', () => {
      cy.visit('/login')
      cy.get('[data-cy="email"]').type('test@example.com')
      cy.get('[data-cy="password"]').type('password123')
      cy.get('[data-cy="login-button"]').click()
      cy.url().should('include', '/dashboard')
    })

    widgetPage.visit()
  })

  it('displays widget correctly', () => {
    widgetPage.shouldBeVisible()
  })

  it('processes input successfully', () => {
    widgetPage
      .typeInput('test input')
      .clickSubmit()
      .shouldShowResult('processed: test input')
  })

  it('disables submit when input is empty', () => {
    widgetPage
      .typeInput('')
      .submitButtonShouldBeDisabled()
  })

  it('shows loading state during processing', () => {
    // Intercept API call to add delay
    cy.intercept('POST', '/api/v1/plugin/my-plugin/process', {
      delay: 1000,
      body: { success: true, data: 'processed' }
    })

    widgetPage.typeInput('test').clickSubmit()

    cy.get('[data-cy="my-widget-submit"]').should('contain', 'Processing...')
  })

  it('handles errors gracefully', () => {
    // Intercept API call to return error
    cy.intercept('POST', '/api/v1/plugin/my-plugin/process', {
      statusCode: 500,
      body: { error: 'Processing failed' }
    })

    widgetPage.typeInput('test').clickSubmit()

    cy.contains('Processing failed').should('be.visible')
  })
})
```

---

### Global Session for Faster Tests

**cypress/support/commands.ts**:
```typescript
// Use cy.session() for 3-5x faster test execution
Cypress.Commands.add('loginAsUser', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('[data-cy="email"]').type(email)
    cy.get('[data-cy="password"]').type(password)
    cy.get('[data-cy="login-button"]').click()
    cy.url().should('include', '/dashboard')
  })
})

// Usage in tests
describe('Plugin Tests', () => {
  beforeEach(() => {
    cy.loginAsUser('test@example.com', 'password123')
  })

  it('test 1', () => {
    // Test runs with authenticated session
  })

  it('test 2', () => {
    // Reuses same session (faster!)
  })
})
```

---

## Testing Plugin Lifecycle Hooks

```typescript
// contents/plugins/my-plugin/__tests__/plugin.config.test.ts
import { myPluginConfig } from '../plugin.config'

describe('Plugin Lifecycle Hooks', () => {
  describe('onLoad', () => {
    it('initializes successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log')

      await myPluginConfig.hooks.onLoad()

      expect(consoleSpy).toHaveBeenCalledWith('[My Plugin] Loading...')
    })

    it('throws error when environment is invalid', async () => {
      delete process.env.MY_PLUGIN_API_KEY

      await expect(myPluginConfig.hooks.onLoad()).rejects.toThrow(
        'API key is required'
      )
    })
  })

  describe('onActivate', () => {
    it('starts background jobs', async () => {
      const startJobsSpy = jest.spyOn(myPluginConfig, 'startBackgroundJobs')

      await myPluginConfig.hooks.onActivate()

      expect(startJobsSpy).toHaveBeenCalled()
    })
  })

  describe('onDeactivate', () => {
    it('stops background jobs', async () => {
      const stopJobsSpy = jest.spyOn(myPluginConfig, 'stopBackgroundJobs')

      await myPluginConfig.hooks.onDeactivate()

      expect(stopJobsSpy).toHaveBeenCalled()
    })
  })
})
```

---

## Test Coverage

### Running Coverage Reports

```bash
# Run unit tests with coverage
pnpm test:unit --coverage

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Run all tests
pnpm test
```

### Coverage Thresholds

**jest.config.js**:
```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Higher threshold for critical plugin files
    './contents/plugins/*/lib/core-utils.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
}
```

---

## Real-World Example: AI Plugin Tests

**Unit Test**:
```typescript
// contents/plugins/ai/lib/__tests__/core-utils.test.ts
import { selectModel, calculateCost } from '../core-utils'

describe('AI Plugin Core Utils', () => {
  describe('selectModel', () => {
    it('selects local model when USE_LOCAL_AI is true', () => {
      process.env.USE_LOCAL_AI = 'true'
      const model = selectModel('chat')
      expect(model).toBe('llama3')
    })

    it('selects cloud model when USE_LOCAL_AI is false', () => {
      process.env.USE_LOCAL_AI = 'false'
      const model = selectModel('chat')
      expect(model).toBe('claude-3-5-sonnet-20241022')
    })
  })

  describe('calculateCost', () => {
    it('calculates cost for Claude model', () => {
      const cost = calculateCost(1000, 'claude-3-5-sonnet-20241022')
      expect(cost).toBe(0.015) // $0.015 per 1K tokens
    })

    it('returns zero for local models', () => {
      const cost = calculateCost(1000, 'llama3')
      expect(cost).toBe(0)
    })
  })
})
```

**E2E Test**:
```typescript
// cypress/e2e/plugins/ai-chat.cy.ts
describe('AI Chat Plugin', () => {
  beforeEach(() => {
    cy.loginAsUser('test@example.com', 'password123')
    cy.visit('/ai/chat')
  })

  it('sends message and receives response', () => {
    cy.intercept('POST', '/api/v1/plugin/ai/generate', {
      body: {
        success: true,
        data: {
          text: 'This is a test AI response',
          usage: { totalTokens: 50 },
          cost: 0.001
        }
      }
    })

    cy.get('[data-cy="ai-chat-input"]').type('Hello AI')
    cy.get('[data-cy="ai-chat-send"]').click()

    cy.get('[data-cy="ai-chat-message-user"]').should('contain', 'Hello AI')
    cy.get('[data-cy="ai-chat-message-assistant"]').should('contain', 'This is a test AI response')
  })
})
```

---

## Summary

**Testing Best Practices:**
- ✅ 90%+ coverage for critical paths
- ✅ 80%+ coverage for important features
- ✅ Test all API endpoints
- ✅ Test all UI components with Cypress
- ✅ Use Page Object Model for E2E tests
- ✅ Use cy.session() for faster tests
- ✅ Mock external dependencies
- ✅ Test error cases
- ✅ Test lifecycle hooks

**Testing Tools:**
- **Jest** - Unit and integration tests
- **Cypress** - E2E tests
- **Testing Library** - Component testing
- **MSW** - API mocking

**Coverage Requirements:**
- Critical paths: 90%+
- Important features: 80%+
- All API endpoints: 100%
- All UI components: E2E tests

**Next:** [Creating Custom Plugins](./09-creating-custom-plugins.md) - Step-by-step plugin creation tutorial

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
