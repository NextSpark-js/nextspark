# Jest Unit Tests - {{THEME_DISPLAY_NAME}} Theme

This folder contains unit tests for theme-specific code.

## Structure

```
jest/
├── setup.ts          # Jest setup file
├── __mocks__/        # Mock files
└── unit/             # Unit test files
    ├── services/     # Service tests
    ├── hooks/        # Hook tests
    └── utils/        # Utility tests
```

## Running Tests

```bash
# Run all unit tests
pnpm jest

# Run tests in watch mode
pnpm jest --watch

# Run specific test file
pnpm jest path/to/test.test.ts

# Run with coverage
pnpm jest --coverage
```

## Writing Tests

```typescript
// Example test file: jest/unit/services/example.test.ts
import { myFunction } from '@/contents/themes/{{THEME_SLUG}}/services/example'

describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })
})
```

## Configuration

Jest configuration is inherited from the root `jest.config.js`.
Theme-specific configuration can be added in `jest.config.theme.js`.
