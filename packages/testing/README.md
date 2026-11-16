# @nextsparkjs/testing

Cypress helpers for NextSpark projects: base classes for page objects, an API interceptor for deterministic waits, and small helpers for test attributes.

> **Stability: experimental.** `@nextsparkjs/testing` is not part of the stable 1.0 surface and may change in a minor release without a deprecation period. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

## Installation

```bash
pnpm add -D @nextsparkjs/testing
```

## Requirements

- Node.js 22.x (22.14.0 or later) or 24.x
- Cypress 13 or later (peer dependency)
- A NextSpark project: the selectors these helpers work with ship in `@nextsparkjs/core`. See the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md) for supported versions.

## What is in it

| Entry point | Exports |
| --- | --- |
| `@nextsparkjs/testing` | Everything below |
| `@nextsparkjs/testing/pom` | `BasePOMCore`, `DashboardEntityPOMCore`, `EntityConfig` |
| `@nextsparkjs/testing/helpers` | `ApiInterceptor`, `ApiInterceptorConfig` |
| `@nextsparkjs/testing/utils` | `createCyId`, `createTestId`, `sel`, `createStateAttr`, `createPriorityAttr`, `createTestingProps`, `createAriaLabel`, `keyboardHelpers` |

**Selectors are not in this package.** `sel`, `cySelector`, `CORE_SELECTORS` and `createSelectorHelpers` come from `@nextsparkjs/core/selectors`. The `sel` exported here only joins its parts with dots.

## Usage

### Page objects

`BasePOMCore` and `DashboardEntityPOMCore` are abstract: your project extends them and supplies `cySelector`, usually from its own selector helpers.

```typescript
import { DashboardEntityPOMCore } from '@nextsparkjs/testing/pom'
import { cySelector } from '@nextsparkjs/core/selectors'

export class ProductsPOM extends DashboardEntityPOMCore {
  protected cySelector(path: string, replacements?: Record<string, string | number>): string {
    return cySelector(path, replacements)
  }
}
```

### Waiting for the API

`ApiInterceptor` registers `cy.intercept()` aliases for an entity's `/api/v1/<slug>` routes, so a test waits for the response instead of using `cy.wait(ms)`.

```typescript
import { ApiInterceptor } from '@nextsparkjs/testing/helpers'

const api = new ApiInterceptor('customers')
api.setupCrudIntercepts()
cy.visit('/dashboard/customers')
api.waitForList()
```

## Documentation

- [Testing overview](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/12-testing/01-testing-overview.md)
- [End-to-end testing with Cypress](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/12-testing/03-e2e-testing-cypress.md)
- [NextSpark documentation](https://www.nextspark.dev/docs)

## License

MIT
