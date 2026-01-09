# @nextsparkjs/testing

Testing utilities for NextSpark applications. Provides selectors, Page Object Models, and Cypress helpers.

## Installation

```bash
npm install @nextsparkjs/testing
# or
pnpm add @nextsparkjs/testing
```

## Usage

### Basic Selectors

```typescript
import { sel, cySelector, CORE_SELECTORS } from '@nextsparkjs/testing'

// Get selector value
sel('dashboard.navigation.main') // 'nav-main'

// Get Cypress selector
cySelector('dashboard.navigation.main') // '[data-cy="nav-main"]'

// Access raw selectors
CORE_SELECTORS.dashboard.navigation.main // 'nav-main'
```

### Subpath Imports (Recommended)

For better tree-shaking:

```typescript
import { sel, cySelector } from '@nextsparkjs/testing/selectors'
import { createEntityTestingHelper } from '@nextsparkjs/testing/utils'
```

### Theme Extension

Themes can extend core selectors:

```typescript
import { createSelectorHelpers, CORE_SELECTORS } from '@nextsparkjs/testing/selectors'

const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  myFeature: {
    button: 'my-feature-btn',
    form: 'my-feature-form',
  },
}

export const { sel, cySelector } = createSelectorHelpers(THEME_SELECTORS)
```

### Entity Testing Helper

```typescript
import { createEntityTestingHelper } from '@nextsparkjs/testing/utils'

const testId = createEntityTestingHelper('products')

// Usage in components
<div data-cy={testId.page()}>           // products-page
  <form data-cy={testId.form()}>        // products-form
    <input data-cy={testId.field('name')} /> // products-field-name
    <button data-cy={testId.formSubmit()}>   // products-form-submit
      Submit
    </button>
  </form>
</div>
```

## Exports

### Main Entry (`@nextsparkjs/testing`)

- `sel()` - Get selector value by path
- `cySelector()` - Get Cypress selector string
- `CORE_SELECTORS` - All core selectors
- `createSelectorHelpers()` - Factory for custom selectors
- `createEntityTestingHelper()` - Entity-specific helper factory

### Selectors (`@nextsparkjs/testing/selectors`)

- All selector-related exports

### Utils (`@nextsparkjs/testing/utils`)

- `createTestId()` - Create test IDs
- `createCyId()` - Create Cypress IDs
- `createEntityTestingHelper()` - Entity helper factory
- `testingPatterns` - Common testing patterns
- `keyboardHelpers` - Keyboard navigation helpers

## License

MIT
