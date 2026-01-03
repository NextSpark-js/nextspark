# Testing Translations

## Introduction

Testing internationalization is crucial for ensuring a consistent user experience across all supported languages. This document covers strategies and best practices for testing translation completeness, locale switching, missing translations, and overall i18n functionality in NextSpark.

The application uses a multi-layered testing approach with **Jest** for unit/integration tests and **Cypress** for end-to-end testing of i18n features.

---

## Testing Strategy

### Testing Pyramid for i18n

```text
        E2E Tests (Cypress)
       /  Locale switching
      /   Translation loading
     /    User preferences
    
    Integration Tests (Jest)
   /  Component translations
  /   Hook behavior
 /    Translation utilities
 
Unit Tests (Jest)
Translation key validation
Format functions
Locale detection
```

### What to Test

| Category | Focus | Tools |
|----------|-------|-------|
| **Translation Keys** | Key existence, structure | Jest |
| **Locale Switching** | UI updates, persistence | Cypress |
| **Missing Translations** | Fallbacks, errors | Jest + Cypress |
| **Formatting** | Dates, numbers, plurals | Jest |
| **Components** | Render with translations | Jest + RTL |
| **User Flow** | Complete scenarios | Cypress |

---

## Unit Testing Translations

### Testing Translation Key Existence

Validate that all translation keys exist across all locales:

```typescript
// test/i18n/translation-keys.test.ts
import { describe, it, expect } from '@jest/globals'
import enCommon from '@/core/messages/en/common.json'
import esCommon from '@/core/messages/es/common.json'
import enAuth from '@/core/messages/en/auth.json'
import esAuth from '@/core/messages/es/auth.json'

describe('Translation Keys', () => {
  describe('Common namespace', () => {
    it('should have matching keys in English and Spanish', () => {
      const enKeys = Object.keys(flatten(enCommon))
      const esKeys = Object.keys(flatten(esCommon))
      
      expect(enKeys.sort()).toEqual(esKeys.sort())
    })
    
    it('should not have empty values', () => {
      const allValues = Object.values(flatten(enCommon))
      
      allValues.forEach(value => {
        expect(value).toBeTruthy()
        expect(typeof value).toBe('string')
        expect(value.trim()).not.toBe('')
      })
    })
  })
  
  describe('Auth namespace', () => {
    it('should have matching keys in English and Spanish', () => {
      const enKeys = Object.keys(flatten(enAuth))
      const esKeys = Object.keys(flatten(esAuth))
      
      expect(enKeys.sort()).toEqual(esKeys.sort())
    })
  })
})

// Helper to flatten nested objects
function flatten(obj: any, prefix = ''): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
    const pre = prefix.length ? `${prefix}.` : ''
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(acc, flatten(obj[key], pre + key))
    } else {
      acc[pre + key] = obj[key]
    }
    return acc
  }, {})
}
```

### Testing Translation Completeness

Check that all namespaces have translations in all locales:

```typescript
// test/i18n/translation-completeness.test.ts
import { describe, it, expect } from '@jest/globals'
import { I18N_CONFIG } from '@/core/lib/config'
import fs from 'fs'
import path from 'path'

describe('Translation Completeness', () => {
  const namespaces = I18N_CONFIG.namespaces
  const locales = I18N_CONFIG.supportedLocales
  
  namespaces.forEach(namespace => {
    describe(`Namespace: ${namespace}`, () => {
      locales.forEach(locale => {
        it(`should have ${locale} translations for ${namespace}`, () => {
          const filePath = path.join(
            process.cwd(),
            'core/messages',
            locale,
            `${namespace}.json`
          )
          
          expect(fs.existsSync(filePath)).toBe(true)
          
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          expect(Object.keys(content).length).toBeGreaterThan(0)
        })
      })
    })
  })
})
```

### Testing Format Functions

Test date, number, and currency formatting:

```typescript
// test/i18n/formatters.test.ts
import { describe, it, expect } from '@jest/globals'
import { formatDate, formatNumber, formatCurrency } from '@/core/lib/formatters'

describe('Formatters', () => {
  describe('formatDate', () => {
    it('should format date in English', () => {
      const date = new Date('2025-11-19')
      const formatted = formatDate(date, 'en', 'PPP')
      
      expect(formatted).toContain('November')
      expect(formatted).toContain('19')
      expect(formatted).toContain('2025')
    })
    
    it('should format date in Spanish', () => {
      const date = new Date('2025-11-19')
      const formatted = formatDate(date, 'es', 'PPP')
      
      expect(formatted).toContain('noviembre')
      expect(formatted).toContain('19')
      expect(formatted).toContain('2025')
    })
  })
  
  describe('formatNumber', () => {
    it('should format number with English separators', () => {
      const formatted = formatNumber(1234567.89, 'en')
      expect(formatted).toBe('1,234,567.89')
    })
    
    it('should format number with Spanish separators', () => {
      const formatted = formatNumber(1234567.89, 'es')
      expect(formatted).toBe('1.234.567,89')
    })
  })
  
  describe('formatCurrency', () => {
    it('should format USD in English', () => {
      const formatted = formatCurrency(1234.56, 'en', 'USD')
      expect(formatted).toContain('$')
      expect(formatted).toContain('1,234.56')
    })
    
    it('should format USD in Spanish', () => {
      const formatted = formatCurrency(1234.56, 'es', 'USD')
      expect(formatted).toContain('US$')
      expect(formatted).toContain('1.234,56')
    })
  })
})
```

---

## Component Testing with Translations

### Setting Up Jest with next-intl

The test setup mocks next-intl for consistent behavior:

```typescript
// core/tests/setup.ts
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, options?: any) => {
    const translations: Record<string, string> = {
      // Auth translations
      'login.title': 'Sign In',
      'login.description': 'Sign in to access your account',
      'login.form.email': 'Email',
      'login.form.password': 'Password',
      'login.form.signInButton': 'Sign In',
      
      // Validation
      'validation.email.required': 'Email is required',
      'validation.email.invalid': 'Invalid email address',
      'validation.password.required': 'Password is required',
      
      // Common
      'common.buttons.save': 'Save',
      'common.buttons.cancel': 'Cancel',
    }
    
    let translation = translations[key]
    
    // Handle defaultValue
    if (!translation && options?.defaultValue) {
      translation = options.defaultValue
    }
    
    // Fallback to key
    if (!translation) {
      translation = key.split('.').pop() || key
    }
    
    // Handle interpolation
    if (options && typeof translation === 'string') {
      Object.keys(options).forEach(optionKey => {
        if (optionKey !== 'defaultValue') {
          translation = translation.replace(`{${optionKey}}`, options[optionKey])
        }
      })
    }
    
    return translation
  },
  
  useLocale: () => 'en',
  
  useFormatter: () => ({
    dateTime: jest.fn((date) => date.toLocaleDateString()),
    number: jest.fn((num) => num.toLocaleString()),
    relativeTime: jest.fn(() => '2 hours ago'),
  })
}))
```

### Testing Components with Translations

```typescript
// core/tests/jest/components/LanguageSwitcher.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageSwitcher } from '@/core/components/LanguageSwitcher'

describe('LanguageSwitcher', () => {
  it('should render language options', () => {
    render(<LanguageSwitcher />)
    
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Español')).toBeInTheDocument()
  })
  
  it('should call changeLanguage when option selected', async () => {
    const mockChangeLanguage = jest.fn()
    jest.mock('@/core/hooks/useLocale', () => ({
      useLocale: () => ({
        locale: 'en',
        changeLanguage: mockChangeLanguage,
        isChanging: false,
        supportedLocales: ['en', 'es']
      })
    }))
    
    render(<LanguageSwitcher />)
    
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'es' } })
    
    expect(mockChangeLanguage).toHaveBeenCalledWith('es')
  })
})
```

### Testing Translation Interpolation

```typescript
// core/tests/jest/components/UserGreeting.test.tsx
import { render, screen } from '@testing-library/react'
import { UserGreeting } from '@/core/components/UserGreeting'

describe('UserGreeting', () => {
  it('should interpolate username correctly', () => {
    render(<UserGreeting name="John" />)
    
    // Assumes translation: "Hello, {name}!"
    expect(screen.getByText(/Hello, John!/)).toBeInTheDocument()
  })
  
  it('should handle pluralization', () => {
    render(<UserGreeting notificationCount={5} />)
    
    // Assumes translation with plural: "{count} notifications"
    expect(screen.getByText(/5 notifications/)).toBeInTheDocument()
  })
})
```

---

## Integration Testing

### Testing useLocale Hook

```typescript
// core/tests/jest/hooks/useLocale.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLocale } from '@/core/hooks/useLocale'

describe('useLocale', () => {
  it('should return current locale', () => {
    const { result } = renderHook(() => useLocale())
    
    expect(result.current.locale).toBe('en')
    expect(result.current.supportedLocales).toContain('en')
    expect(result.current.supportedLocales).toContain('es')
  })
  
  it('should change language', async () => {
    const { result } = renderHook(() => useLocale())
    
    await act(async () => {
      await result.current.changeLanguage('es')
    })
    
    await waitFor(() => {
      expect(result.current.locale).toBe('es')
    })
  })
  
  it('should set isChanging during transition', async () => {
    const { result } = renderHook(() => useLocale())
    
    act(() => {
      result.current.changeLanguage('es')
    })
    
    expect(result.current.isChanging).toBe(true)
    
    await waitFor(() => {
      expect(result.current.isChanging).toBe(false)
    })
  })
})
```

### Testing Locale Detection

```typescript
// core/tests/jest/lib/locale.test.ts
import { getUserLocale, setUserLocale } from '@/core/lib/locale'
import { cookies, headers } from 'next/headers'

jest.mock('next/headers')

describe('Locale Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  it('should detect locale from cookie', async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn(() => ({ value: 'es' }))
    })
    
    const locale = await getUserLocale()
    expect(locale).toBe('es')
  })
  
  it('should fallback to default locale', async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn(() => undefined)
    })
    (headers as jest.Mock).mockResolvedValue({
      get: jest.fn(() => null)
    })
    
    const locale = await getUserLocale()
    expect(locale).toBe('en') // Default
  })
  
  it('should set locale cookie', async () => {
    const mockSet = jest.fn()
    (cookies as jest.Mock).mockResolvedValue({
      set: mockSet
    })
    
    await setUserLocale('es')
    
    expect(mockSet).toHaveBeenCalledWith(
      'locale',
      'es',
      expect.objectContaining({
        path: '/',
        sameSite: 'lax'
      })
    )
  })
})
```

---

## End-to-End Testing with Cypress

### Setting Up Cypress for i18n

```javascript
// cypress/support/commands.js

/**
 * Switch language via UI
 */
Cypress.Commands.add('switchLanguage', (lang) => {
  cy.get('[data-cy="language-switch"]').select(lang)
  cy.wait(500) // Wait for reload
})

/**
 * Verify HTML lang attribute
 */
Cypress.Commands.add('verifyLanguage', (lang) => {
  cy.get('html').should('have.attr', 'lang', lang)
})

/**
 * Verify translation text
 */
Cypress.Commands.add('verifyTranslation', (selector, expectedText) => {
  cy.get(selector).should('contain', expectedText)
})

/**
 * Check locale cookie
 */
Cypress.Commands.add('verifyLocaleCookie', (expectedLocale) => {
  cy.getCookie('locale').should('have.property', 'value', expectedLocale)
})
```

### Testing Locale Switching

```javascript
// cypress/e2e/i18n/locale-switching.cy.js

describe('Locale Switching', () => {
  beforeEach(() => {
    cy.visit('/')
  })
  
  it('should switch to Spanish', () => {
    // Initial state: English
    cy.verifyLanguage('en')
    cy.verifyTranslation('[data-cy="welcome-heading"]', 'Welcome')
    
    // Switch to Spanish
    cy.switchLanguage('es')
    
    // Verify change
    cy.verifyLanguage('es')
    cy.verifyTranslation('[data-cy="welcome-heading"]', 'Bienvenido')
    cy.verifyLocaleCookie('es')
  })
  
  it('should persist locale after page reload', () => {
    // Switch to Spanish
    cy.switchLanguage('es')
    cy.verifyLanguage('es')
    
    // Reload page
    cy.reload()
    
    // Verify locale persisted
    cy.verifyLanguage('es')
    cy.verifyLocaleCookie('es')
  })
  
  it('should persist locale for authenticated users', () => {
    cy.login('test@example.com', 'password123')
    cy.visit('/dashboard')
    
    // Switch to Spanish
    cy.switchLanguage('es')
    
    // Sign out and sign in again
    cy.get('[data-cy="user-menu"]').click()
    cy.get('[data-cy="sign-out"]').click()
    
    cy.login('test@example.com', 'password123')
    
    // Verify locale persisted from database
    cy.verifyLanguage('es')
  })
})
```

### Testing Translation Loading

```javascript
// cypress/e2e/i18n/translation-loading.cy.js

describe('Translation Loading', () => {
  it('should load translations without errors', () => {
    cy.visit('/dashboard')
    
    // Check no missing translation errors
    cy.window().then((win) => {
      const errors = win.console.error.args
        .filter(args => args.some(arg => 
          typeof arg === 'string' && arg.includes('translation')
        ))
      
      expect(errors).to.have.length(0)
    })
  })
  
  it('should load entity translations dynamically', () => {
    cy.visit('/dashboard/tasks')
    
    // Verify entity-specific translations loaded
    cy.verifyTranslation('[data-cy="entity-title"]', 'Tasks')
    cy.verifyTranslation('[data-cy="create-button"]', 'Create Task')
  })
  
  it('should show fallback for missing translations', () => {
    // Force missing translation scenario
    cy.visit('/dashboard?debug=true')
    
    // Should show key or default value, not crash
    cy.get('[data-cy="test-missing-key"]').should('exist')
  })
})
```

### Testing Locale-Aware Formatting

```javascript
// cypress/e2e/i18n/formatting.cy.js

describe('Locale-Aware Formatting', () => {
  it('should format dates according to locale', () => {
    // English format
    cy.switchLanguage('en')
    cy.visit('/dashboard')
    cy.get('[data-cy="last-login"]').should('contain', 'November')
    
    // Spanish format
    cy.switchLanguage('es')
    cy.visit('/dashboard')
    cy.get('[data-cy="last-login"]').should('contain', 'noviembre')
  })
  
  it('should format numbers according to locale', () => {
    cy.visit('/dashboard/stats')
    
    // English: 1,234.56
    cy.switchLanguage('en')
    cy.get('[data-cy="revenue"]').should('contain', '1,234')
    
    // Spanish: 1.234,56
    cy.switchLanguage('es')
    cy.get('[data-cy="revenue"]').should('contain', '1.234')
  })
  
  it('should format currency according to locale', () => {
    cy.visit('/pricing')
    
    // English: $99.00
    cy.switchLanguage('en')
    cy.get('[data-cy="price"]').should('contain', '$99')
    
    // Spanish: 99,00 US$
    cy.switchLanguage('es')
    cy.get('[data-cy="price"]').should('contain', '99,00')
  })
})
```

---

## Testing Missing Translations

### Detecting Missing Keys

```typescript
// test/i18n/missing-translations.test.ts
import { describe, it, expect } from '@jest/globals'
import { I18N_CONFIG } from '@/core/lib/config'
import fs from 'fs'
import path from 'path'

describe('Missing Translations', () => {
  const [primaryLocale, ...otherLocales] = I18N_CONFIG.supportedLocales
  
  I18N_CONFIG.namespaces.forEach(namespace => {
    it(`should have all keys translated in ${namespace}`, () => {
      // Load primary locale (reference)
      const primaryPath = path.join(
        process.cwd(),
        'core/messages',
        primaryLocale,
        `${namespace}.json`
      )
      const primaryKeys = Object.keys(
        flatten(JSON.parse(fs.readFileSync(primaryPath, 'utf-8')))
      )
      
      // Check all other locales
      otherLocales.forEach(locale => {
        const localePath = path.join(
          process.cwd(),
          'core/messages',
          locale,
          `${namespace}.json`
        )
        const localeKeys = Object.keys(
          flatten(JSON.parse(fs.readFileSync(localePath, 'utf-8')))
        )
        
        const missingKeys = primaryKeys.filter(k => !localeKeys.includes(k))
        
        if (missingKeys.length > 0) {
          console.warn(`Missing keys in ${locale}/${namespace}:`, missingKeys)
        }
        
        expect(missingKeys).toHaveLength(0)
      })
    })
  })
})

function flatten(obj: any, prefix = ''): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
    const pre = prefix.length ? `${prefix}.` : ''
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(acc, flatten(obj[key], pre + key))
    } else {
      acc[pre + key] = obj[key]
    }
    return acc
  }, {})
}
```

### Fallback Behavior Testing

```typescript
// core/tests/jest/components/TranslationFallback.test.tsx
import { render, screen } from '@testing-library/react'

describe('Translation Fallback', () => {
  it('should show fallback for missing key', () => {
    const Component = () => {
      const t = useTranslations('test')
      return <div>{t('nonexistent.key')}</div>
    }
    
    render(<Component />)
    
    // Should show key or configured fallback, not crash
    expect(screen.getByText(/key/i)).toBeInTheDocument()
  })
  
  it('should use defaultValue when provided', () => {
    const Component = () => {
      const t = useTranslations('test')
      return <div>{t('missing.key', { defaultValue: 'Fallback Text' })}</div>
    }
    
    render(<Component />)
    
    expect(screen.getByText('Fallback Text')).toBeInTheDocument()
  })
})
```

---

## Validation Scripts

### Translation Completeness Script

```bash
#!/bin/bash
# scripts/validate-translations.sh

set -e

echo "🔍 Validating translation completeness..."

PRIMARY_LOCALE="en"
LOCALES=("en" "es")
NAMESPACES=("common" "dashboard" "settings" "auth" "public" "validation")

for namespace in "${NAMESPACES[@]}"; do
  echo "Checking namespace: $namespace"
  
  # Get keys from primary locale
  primary_file="core/messages/$PRIMARY_LOCALE/$namespace.json"
  primary_keys=$(jq -r 'paths(scalars) | join(".")' "$primary_file" | sort)
  
  for locale in "${LOCALES[@]}"; do
    if [ "$locale" == "$PRIMARY_LOCALE" ]; then
      continue
    fi
    
    locale_file="core/messages/$locale/$namespace.json"
    locale_keys=$(jq -r 'paths(scalars) | join(".")' "$locale_file" | sort)
    
    # Find missing keys
    missing=$(comm -23 <(echo "$primary_keys") <(echo "$locale_keys"))
    
    if [ -n "$missing" ]; then
      echo "❌ Missing translations in $locale/$namespace:"
      echo "$missing"
      exit 1
    fi
  done
done

echo "✅ All translations complete!"
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run translation validation
./scripts/validate-translations.sh

if [ $? -ne 0 ]; then
  echo "❌ Translation validation failed. Please fix missing translations."
  exit 1
fi

echo "✅ Translation validation passed"
```

---

## Best Practices

### ✅ DO: Test All Supported Locales

```typescript
I18N_CONFIG.supportedLocales.forEach(locale => {
  it(`should render correctly in ${locale}`, () => {
    // Test logic
  })
})
```

### ✅ DO: Test Interpolation

```typescript
it('should interpolate variables', () => {
  const result = t('greeting', { name: 'John' })
  expect(result).toBe('Hello, John!')
})
```

### ✅ DO: Test Pluralization

```typescript
it('should handle plural forms', () => {
  expect(t('items.count', { count: 0 })).toContain('No items')
  expect(t('items.count', { count: 1 })).toContain('1 item')
  expect(t('items.count', { count: 5 })).toContain('5 items')
})
```

### ✅ DO: Test Persistence

```typescript
it('should persist locale across sessions', async () => {
  await changeLanguage('es')
  cy.reload()
  cy.verifyLanguage('es')
})
```

### ❌ DON'T: Hardcode Expected Translations

```typescript
// ❌ BAD: Brittle if translation changes
expect(screen.getByText('Welcome to Dashboard')).toBeInTheDocument()

// ✅ GOOD: Test structure, not exact text
expect(screen.getByRole('heading')).toBeInTheDocument()
```

### ❌ DON'T: Skip Edge Cases

```typescript
// ❌ BAD: Only testing happy path
it('should show translation', () => {
  expect(t('key')).toBeDefined()
})

// ✅ GOOD: Test edge cases
it('should handle missing keys gracefully', () => {
  expect(t('nonexistent')).toBeTruthy()
  expect(() => t('nonexistent')).not.toThrow()
})
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/i18n-tests.yml
name: i18n Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    paths:
      - 'core/messages/**'
      - 'contents/**/messages/**'

jobs:
  test-translations:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Validate translation completeness
        run: ./scripts/validate-translations.sh
      
      - name: Run i18n unit tests
        run: pnpm test:i18n
      
      - name: Run Cypress i18n tests
        run: pnpm cypress:run --spec "cypress/e2e/i18n/**"
```

---

## Troubleshooting

### Tests Failing After Translation Updates

**Problem**: Tests break when translation text changes

**Solution**: Test structure, not exact text

```typescript
// Instead of:
expect(screen.getByText('Welcome to Dashboard')).toBeInTheDocument()

// Use:
expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
expect(screen.getByLabelText('Email')).toBeInTheDocument()
```

### Mock Translations Not Working

**Problem**: Mocked translations return undefined

**Solution**: Ensure mock covers all accessed keys

```typescript
// Add all keys used in component
const translations = {
  'component.title': 'Title',
  'component.description': 'Description',
  'component.button': 'Click Me'
}
```

### Cypress Locale Tests Failing

**Problem**: Locale doesn't persist in Cypress

**Solution**: Wait for cookie to be set

```javascript
cy.switchLanguage('es')
cy.wait(500) // Wait for cookie
cy.getCookie('locale').should('have.property', 'value', 'es')
```

---

## Next Steps

1. **[Locale Switching](./06-locale-switching.md)** - Implement locale switching
2. **[Advanced Patterns](./07-advanced-patterns.md)** - Test advanced formatting
3. **[Translation Keys](./03-translation-keys.md)** - Organize translation keys

---

> 💡 **Pro Tip**: Use automated validation scripts in your CI/CD pipeline to catch missing translations before they reach production. Combine unit tests for logic with E2E tests for user flows.
