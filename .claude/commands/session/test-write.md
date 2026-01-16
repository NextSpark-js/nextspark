# /session:test:write

Write or update Cypress tests (API and UAT) for a feature.

---

## Required Skills

**[MANDATORY]** Read these skills before executing:
- `.claude/skills/cypress-api/SKILL.md` - API testing patterns
- `.claude/skills/cypress-e2e/SKILL.md` - E2E/UAT testing patterns
- `.claude/skills/cypress-selectors/SKILL.md` - data-cy selector conventions
- `.claude/skills/pom-patterns/SKILL.md` - Page Object Model patterns

---

## Syntax

```
/session:test:write [--type <api|uat|both>]
```

---

## Behavior

Generates Cypress tests based on session requirements and existing patterns.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:test:write                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load session context                                        │
│     - Read requirements.md (ACs)                                │
│     - Read plan.md (entities)                                   │
│     ↓                                                           │
│  2. Check for existing POMs                                     │
│     - Reuse if available                                        │
│     - Create if needed                                          │
│     ↓                                                           │
│  3. Generate API tests                                          │
│     - CRUD operations                                           │
│     - Auth scenarios                                            │
│     - Error cases                                               │
│     ↓                                                           │
│  4. Generate UAT tests                                          │
│     - User flows from ACs                                       │
│     - Visual verification                                       │
│     ↓                                                           │
│  5. Validate selectors exist                                    │
│     ↓                                                           │
│  6. Create test files                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🧪 WRITE TESTS

Session: stories/2026-01-11-new-products-entity
Type: both (API + UAT)

─────────────────────────────────────────

📋 ANALYZING REQUIREMENTS

ACs to cover:
├─ AC1: Admin can create a new product
├─ AC2: Admin can upload product images
├─ AC3: Admin can assign products to categories
├─ AC4: Products are listed with pagination
└─ AC5: Team members can view products

Entity: products
API Endpoints: 5 (CRUD + list)

─────────────────────────────────────────

🔍 CHECKING EXISTING POMs

├─ DashboardPOM: exists ✓
├─ EntityFormPOM: exists ✓
└─ ProductsPOM: not found

Creating ProductsPOM...
✓ Created: cypress/support/pom/ProductsPOM.ts

─────────────────────────────────────────

📝 GENERATING API TESTS

File: cypress/e2e/api/products.cy.ts

```typescript
import { BaseAPIController } from '@/cypress/support/api/BaseAPIController';

describe('@api @products Products API', () => {
  const api = new ProductsAPIController();

  describe('@crud CRUD Operations', () => {
    it('@create should create a product', () => {
      api.create({
        name: 'Test Product',
        price: 99.99,
        categoryId: fixtures.categoryId
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.name).to.eq('Test Product');
      });
    });

    it('@read should get product by ID', () => {
      api.getById(fixtures.productId).then((response) => {
        expect(response.status).to.eq(200);
      });
    });

    it('@update should update product', () => {
      api.update(fixtures.productId, { name: 'Updated' })
        .then((response) => {
          expect(response.status).to.eq(200);
        });
    });

    it('@delete should delete product', () => {
      api.delete(fixtures.productId).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  describe('@auth Authentication', () => {
    it('@apikey should work with API key', () => {
      // API key authentication test
    });

    it('@session should work with session', () => {
      // Session authentication test
    });

    it('@unauthorized should reject unauthenticated', () => {
      api.unauthorized().create({}).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });
});
```

─────────────────────────────────────────

📝 GENERATING UAT TESTS

File: cypress/e2e/uat/products.cy.ts

```typescript
import { ProductsPOM } from '@/cypress/support/pom/ProductsPOM';

describe('@uat @products Products Management', () => {
  const pom = new ProductsPOM();

  beforeEach(() => {
    cy.login('admin@test.com');
  });

  describe('@ac1 Create Product', () => {
    it('should create a new product', () => {
      pom.navigateToList();
      pom.clickNewProduct();
      pom.fillForm({
        name: 'New Product',
        price: '49.99',
        description: 'Test description'
      });
      pom.submitForm();
      pom.verifySuccessToast('Product created');
    });
  });

  describe('@ac4 List Products', () => {
    it('should display products with pagination', () => {
      pom.navigateToList();
      pom.verifyProductsDisplayed();
      pom.verifyPaginationControls();
      pom.goToNextPage();
      pom.verifyPageChanged();
    });
  });
});
```

─────────────────────────────────────────

✅ SELECTOR VALIDATION

- [x] data-cy="products-list" exists
- [x] data-cy="new-product-btn" exists
- [x] data-cy="product-form" exists
- [x] data-cy="submit-btn" exists

─────────────────────────────────────────

📊 SUMMARY

Files created:
├─ cypress/e2e/api/products.cy.ts (12 tests)
├─ cypress/e2e/uat/products.cy.ts (8 tests)
└─ cypress/support/pom/ProductsPOM.ts

Total tests: 20
ACs covered: 5/5

Next: /session:test:run to execute tests
```

---

## Options

| Option | Description |
|--------|-------------|
| `--type <type>` | api, uat, or both (default: both) |
| `--ac <number>` | Generate for specific AC |
| `--from-pom` | Use existing POM without changes |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:test:run` | Run the tests |
| `/session:test:fix` | Fix failing tests |
