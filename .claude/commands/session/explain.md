# /session:explain

Provide an interactive walkthrough of the implemented code.

---

## Syntax

```
/session:explain [--file <path>] [--concept <name>]
```

---

## Behavior

Explains the implementation details of the current session, walking through key files and decisions.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:explain                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load session context                                        │
│     - Read scope.json (modified files)                          │
│     - Read plan.md (decisions)                                  │
│     ↓                                                           │
│  2. Organize explanation                                        │
│     - Group by layer (DB/API/UI)                                │
│     - Order by importance                                       │
│     ↓                                                           │
│  3. Walk through implementation                                 │
│     - Show key code sections                                    │
│     - Explain patterns used                                     │
│     - Highlight decisions                                       │
│     ↓                                                           │
│  4. Answer questions (interactive)                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
📚 CODE WALKTHROUGH

Session: stories/2026-01-11-new-products-entity
Files modified: 12

─────────────────────────────────────────

## 1. DATABASE LAYER

### Migration: 008_products.sql

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  -- Using camelCase per project conventions
  categoryId UUID REFERENCES categories(id),
  createdAt TIMESTAMPTZ DEFAULT NOW()
);
```

**Why these choices:**
- UUID for distributed ID generation
- DECIMAL for precise currency handling
- TIMESTAMPTZ for timezone awareness

─────────────────────────────────────────

## 2. BACKEND LAYER

### Entity Config: products.ts

```typescript
export const productsEntity: EntityConfig = {
  name: 'products',
  table: 'products',
  fields: {
    name: { type: 'string', required: true },
    price: { type: 'number', required: true },
    // ...
  }
};
```

**Pattern:** Using the entity config system for automatic:
- CRUD API generation
- Form schema generation
- Type inference

─────────────────────────────────────────

## 3. FRONTEND LAYER

### ProductForm.tsx

```typescript
export function ProductForm({ product }: Props) {
  const { mutate, isPending } = useEntityMutation('products');
  // Using TanStack Query pattern from project
}
```

**Pattern:** Standard form component following:
- Controlled inputs with react-hook-form
- Zod validation from entity schema
- Optimistic updates

─────────────────────────────────────────

Questions? Type your question or press Enter to continue.
> Why did you use DECIMAL instead of FLOAT for price?

DECIMAL provides exact precision for financial calculations.
FLOAT can have rounding errors (e.g., 0.1 + 0.2 = 0.30000000000000004).
For money, we need exact values, so DECIMAL(10,2) ensures
exactly 2 decimal places with no rounding issues.

More questions? [Type question or Enter to finish]
```

---

## Explain Specific File

```
/session:explain --file core/services/ProductsService.ts
```

Output:

```
📚 FILE EXPLANATION

File: core/services/ProductsService.ts
Lines: 45
Purpose: Custom business logic for products

─────────────────────────────────────────

## Overview

This service extends BaseEntityService to add
custom price calculation logic.

## Key Sections

### Lines 12-25: Price Calculation

```typescript
calculateFinalPrice(product: Product, discount: number): number {
  const basePrice = product.price;
  const discountAmount = basePrice * (discount / 100);
  return Math.round((basePrice - discountAmount) * 100) / 100;
}
```

**Why:** Centralizes pricing logic for consistency.
The rounding ensures no floating point issues.

### Lines 30-40: Validation

```typescript
async validateProduct(data: ProductInput): Promise<void> {
  if (data.price <= 0) {
    throw new ValidationError('Price must be positive');
  }
}
```

**Why:** Business rule enforcement at service layer,
not just form validation.
```

---

## Options

| Option | Description |
|--------|-------------|
| `--file <path>` | Explain specific file |
| `--concept <name>` | Explain specific concept/pattern |
| `--detailed` | Include all files, not just key ones |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:demo` | Visual demonstration |
| `/session:review` | Code review |
