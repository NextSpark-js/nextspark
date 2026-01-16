# Plugin Testing Reference

Testing patterns for plugins: unit tests, E2E tests, and Page Object Models.

## Unit Tests (Jest)

### Core Plugin Logic

```typescript
// contents/plugins/my-plugin/__tests__/my-plugin.test.ts
import { MyPluginCore } from '../lib/core'

describe('MyPluginCore', () => {
  let core: MyPluginCore

  beforeEach(() => {
    core = new MyPluginCore({
      apiKey: 'test-key',
      timeout: 5000,
      maxRetries: 3
    })
  })

  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      await expect(core.initialize()).resolves.not.toThrow()
    })

    it('should throw with invalid config', async () => {
      const invalid = new MyPluginCore({ apiKey: '' })
      await expect(invalid.initialize()).rejects.toThrow()
    })
  })

  describe('processing', () => {
    it('should process valid input', async () => {
      await core.initialize()
      const result = await core.process({ data: 'test' })
      expect(result.success).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      await core.initialize()
      const result = await core.process({ data: '' })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
```

### Hook Testing

```typescript
// contents/plugins/my-plugin/__tests__/hooks.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMyPlugin } from '../hooks/useMyPlugin'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useMyPlugin', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('should fetch data successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' })
    })

    const { result } = renderHook(() => useMyPlugin(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({ data: 'test' })
  })

  it('should handle fetch error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false
    })

    const { result } = renderHook(() => useMyPlugin(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
```

### Component Testing

```typescript
// contents/plugins/my-plugin/__tests__/MyWidget.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MyWidget } from '../components/MyWidget'

// Mock the hook
jest.mock('../hooks/useMyPlugin', () => ({
  useMyPlugin: () => ({
    data: { value: 'test data' },
    isLoading: false,
    error: null
  })
}))

describe('MyWidget', () => {
  it('should render widget with title', () => {
    render(<MyWidget title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('should display content when data is loaded', () => {
    render(<MyWidget title="Test" />)
    expect(screen.getByTestId('my-plugin-content')).toBeInTheDocument()
  })

  it('should call onAction when button is clicked', () => {
    const onAction = jest.fn()
    render(<MyWidget title="Test" onAction={onAction} />)

    fireEvent.click(screen.getByTestId('my-plugin-action-btn'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
```

---

## E2E Tests (Cypress)

### Basic E2E Test

```typescript
// contents/themes/default/tests/cypress/e2e/uat/my-plugin.cy.ts
import { MyPluginPOM } from '../../src/features/MyPluginPOM'

describe('My Plugin E2E', {
  tags: ['@uat', '@feat-my-plugin', '@smoke']
}, () => {
  let pom: MyPluginPOM

  beforeEach(() => {
    cy.session('plugin-test', () => {
      cy.login('testuser@example.com', 'password123')
    })
    cy.visit('/dashboard')
    pom = new MyPluginPOM()
  })

  it('should display plugin widget', () => {
    pom.shouldBeVisible()
    pom.shouldHaveTitle('My Plugin')
  })

  it('should complete full workflow', () => {
    pom.shouldBeVisible()
    pom.enterData('test data')
    pom.clickProcessButton()
    pom.shouldShowSuccess()
  })

  it('should handle errors gracefully', () => {
    pom.enterData('')  // Invalid input
    pom.clickProcessButton()
    pom.shouldShowError('Validation error')
  })
})
```

### Page Object Model

```typescript
// contents/themes/default/tests/cypress/src/features/MyPluginPOM.ts
import { BasePOM } from '../BasePOM'

export class MyPluginPOM extends BasePOM {
  private selectors = {
    widget: '[data-cy="my-plugin-widget"]',
    title: '[data-cy="my-plugin-title"]',
    input: '[data-cy="my-plugin-input"]',
    processBtn: '[data-cy="my-plugin-action-btn"]',
    loading: '[data-cy="my-plugin-loading"]',
    success: '[data-cy="my-plugin-success"]',
    error: '[data-cy="my-plugin-error"]',
    content: '[data-cy="my-plugin-content"]'
  }

  // Assertions
  shouldBeVisible() {
    cy.get(this.selectors.widget).should('be.visible')
    return this
  }

  shouldHaveTitle(title: string) {
    cy.get(this.selectors.title).should('contain', title)
    return this
  }

  shouldShowSuccess() {
    cy.get(this.selectors.success).should('be.visible')
    return this
  }

  shouldShowError(message: string) {
    cy.get(this.selectors.error)
      .should('be.visible')
      .and('contain', message)
    return this
  }

  shouldShowLoading() {
    cy.get(this.selectors.loading).should('be.visible')
    return this
  }

  // Actions
  enterData(data: string) {
    cy.get(this.selectors.input).clear().type(data)
    return this
  }

  clickProcessButton() {
    cy.get(this.selectors.processBtn).click()
    return this
  }

  // Waits
  waitForLoading() {
    cy.get(this.selectors.loading).should('not.exist')
    return this
  }

  waitForContent() {
    cy.get(this.selectors.content).should('be.visible')
    return this
  }
}
```

---

## API Tests (Cypress)

```typescript
// contents/themes/default/tests/cypress/e2e/api/my-plugin-api.cy.ts
import { BaseAPIController } from '../../src/controllers/BaseAPIController'

describe('My Plugin API', {
  tags: ['@api', '@feat-my-plugin']
}, () => {
  const BASE_URL = Cypress.env('API_URL')
  const API_KEY = Cypress.env('SUPERADMIN_API_KEY')
  let api: BaseAPIController

  before(() => {
    api = new BaseAPIController(BASE_URL, API_KEY)
  })

  describe('POST /api/plugin/my-plugin/process', () => {
    it('should process valid input', () => {
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/plugin/my-plugin/process`,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: {
          data: 'test input'
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
        expect(response.body.data).to.exist
      })
    })

    it('should reject invalid input', () => {
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/plugin/my-plugin/process`,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: {
          data: ''  // Invalid
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.success).to.be.false
      })
    })

    it('should require authentication', () => {
      cy.request({
        method: 'POST',
        url: `${BASE_URL}/api/plugin/my-plugin/process`,
        body: { data: 'test' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
      })
    })
  })
})
```

---

## Coverage Requirements

| Test Type | Minimum Coverage | Target |
|-----------|------------------|--------|
| Unit Tests (Jest) | 80% | 90% |
| E2E Tests (Cypress) | Critical paths | Happy + Error paths |
| API Tests | All endpoints | All methods + auth |

### Running Tests

```bash
# Unit tests
pnpm test --filter=@nextsparkjs/plugin-my-plugin

# E2E tests
pnpm cypress:run --spec "**/my-plugin.cy.ts"

# API tests
pnpm cypress:run --spec "**/my-plugin-api.cy.ts"

# All plugin tests
pnpm test:plugin my-plugin
```
