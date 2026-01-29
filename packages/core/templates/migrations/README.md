# Migration Presets

Standardized migration templates for creating database entities with proper conventions, RLS policies, and metadata support.

## Overview

This directory contains migration templates organized by **RLS (Row Level Security) mode**. Each mode provides a complete set of templates for:

- Entity tables (main table)
- Entity metas (key-value metadata)
- Child entities (parent-child relationships)
- Sample data (for development/testing)

## Directory Structure

```
migrations/
├── README.md                           # This file
├── team-mode/                          # Team-based isolation
│   ├── 001_entity_table.sql.template
│   ├── 002_entity_metas.sql.template
│   ├── 003_entity_child.sql.template
│   └── 100_entity_sample_data.sql.template
├── private-mode/                       # Owner-only access
│   ├── 001_entity_table.sql.template
│   ├── 002_entity_metas.sql.template
│   ├── 003_entity_child.sql.template
│   └── 100_entity_sample_data.sql.template
├── shared-mode/                        # Shared authenticated
│   ├── 001_entity_table.sql.template
│   ├── 002_entity_metas.sql.template
│   ├── 003_entity_child.sql.template
│   └── 100_entity_sample_data.sql.template
└── public-mode/                        # Public read + auth write
    ├── 001_entity_table.sql.template
    ├── 002_entity_metas.sql.template
    ├── 003_entity_child.sql.template
    └── 100_entity_sample_data.sql.template
```

---

## RLS Mode Decision Matrix

Choose the appropriate mode based on your entity's access requirements:

| Mode | Use Case | Example Entities | userId Required | teamId Required |
|------|----------|------------------|-----------------|-----------------|
| **team-mode** | Multi-tenant apps with team isolation | customers, products, orders | Yes | Yes |
| **private-mode** | Personal data, owner-only access | notes, personal_settings | Yes | No |
| **shared-mode** | Collaborative data, any auth user | shared_docs, company_wiki | Yes | Optional |
| **public-mode** | Public read + auth management | blog_posts, products_catalog | Yes | Optional |

### Mode Selection Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                  Is the entity multi-tenant?                │
│                    (Team-based app)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │ Yes                         │ No
          ▼                             ▼
   ┌──────────────┐         ┌─────────────────────────────┐
   │  TEAM-MODE   │         │  Should data be public?     │
   └──────────────┘         └──────────────┬──────────────┘
                                           │
                            ┌──────────────┴──────────────┐
                            │ Yes                         │ No
                            ▼                             ▼
                     ┌──────────────┐         ┌───────────────────────┐
                     │ PUBLIC-MODE  │         │ Is it collaborative?  │
                     └──────────────┘         └───────────┬───────────┘
                                                          │
                                           ┌──────────────┴──────────────┐
                                           │ Yes                         │ No
                                           ▼                             ▼
                                    ┌──────────────┐            ┌───────────────┐
                                    │ SHARED-MODE  │            │ PRIVATE-MODE  │
                                    └──────────────┘            └───────────────┘
```

---

## Template Variables

Replace these placeholders when using templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ENTITY_NAME}}` | Lowercase plural entity name | `products`, `customers` |
| `{{ENTITY_NAME_SINGULAR}}` | Lowercase singular | `product`, `customer` |
| `{{ENTITY_NAME_PASCAL}}` | PascalCase for policies | `Products`, `Customers` |
| `{{PARENT_ENTITY}}` | Parent entity for children | `orders` (for order_items) |
| `{{PARENT_ENTITY_SINGULAR}}` | Singular parent name | `order` |
| `{{DATE}}` | Migration date | `2025-01-15` |
| `{{DESCRIPTION}}` | Entity description | `Product catalog items` |

---

## Migration Standards (MANDATORY)

All migrations MUST follow `.rules/migrations.md` standards:

### 1. Field Naming (camelCase)

```sql
-- ✅ CORRECT
"userId"      TEXT NOT NULL
"teamId"      TEXT NOT NULL
"createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
"updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()

-- ❌ FORBIDDEN (snake_case)
user_id       -- WRONG
team_id       -- WRONG
created_at    -- WRONG
```

### 2. ID Type

```sql
-- ✅ CORRECT - TEXT with gen_random_uuid()
id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text

-- ❌ FORBIDDEN
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()  -- WRONG
```

### 3. Timestamps

```sql
-- ✅ CORRECT - TIMESTAMPTZ with now()
"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()

-- ❌ FORBIDDEN
"createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- WRONG
```

### 4. Field Ordering

```sql
CREATE TABLE IF NOT EXISTS public."entity" (
  -- 1. Primary Key (ALWAYS FIRST)
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- 2. Relational Fields (foreign keys)
  "userId"     TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"     TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- 3. Entity-Specific Fields
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT DEFAULT 'active',

  -- 4. System Fields (ALWAYS LAST)
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5. Meta Table Foreign Key

```sql
-- ✅ CORRECT - Always use "entityId"
"entityId" TEXT NOT NULL REFERENCES public."products"(id) ON DELETE CASCADE

-- ❌ FORBIDDEN - Entity-specific names
"productId"  -- WRONG
"customerId" -- WRONG
```

### 6. Child Table Foreign Key

```sql
-- ✅ CORRECT - Always use "parentId"
"parentId" TEXT NOT NULL REFERENCES public."orders"(id) ON DELETE CASCADE

-- ❌ FORBIDDEN - Entity-specific names
"orderId"    -- WRONG
"invoiceId"  -- WRONG
```

### 7. Trigger Function

```sql
-- ✅ CORRECT - Use Better Auth's function
EXECUTE FUNCTION public.set_updated_at()

-- ❌ FORBIDDEN - Custom function
EXECUTE FUNCTION update_entity_updated_at()  -- WRONG
```

---

## Usage Instructions

### Step 1: Select RLS Mode

Based on your entity requirements, choose the appropriate mode directory.

### Step 2: Copy Template Files

```bash
# Example: Creating a "products" entity with team isolation
cp core/templates/migrations/team-mode/001_entity_table.sql.template \
   contents/themes/{your-theme}/entities/products/migrations/001_products_table.sql

cp core/templates/migrations/team-mode/002_entity_metas.sql.template \
   contents/themes/{your-theme}/entities/products/migrations/002_products_metas.sql
```

### Step 3: Replace Variables

Replace all `{{VARIABLE}}` placeholders with actual values:

```bash
# Using sed (macOS/Linux)
sed -i '' 's/{{ENTITY_NAME}}/products/g' 001_products_table.sql
sed -i '' 's/{{ENTITY_NAME_SINGULAR}}/product/g' 001_products_table.sql
sed -i '' 's/{{ENTITY_NAME_PASCAL}}/Products/g' 001_products_table.sql
sed -i '' 's/{{DATE}}/2025-01-15/g' 001_products_table.sql
```

### Step 4: Customize Entity Fields

Add your entity-specific fields in the designated section:

```sql
  -- Entity-specific fields (ADD YOUR FIELDS HERE)
  name         TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock        INTEGER NOT NULL DEFAULT 0,
  category     TEXT,
```

### Step 5: Add Custom Indexes

Add indexes for frequently queried fields:

```sql
CREATE INDEX IF NOT EXISTS idx_products_category ON public."products"(category);
CREATE INDEX IF NOT EXISTS idx_products_price    ON public."products"(price);
```

### Step 6: Run Migration

```bash
pnpm db:migrate
```

---

## Template Types

### 001_entity_table.sql.template

Main entity table with:
- Primary key (TEXT with gen_random_uuid())
- Foreign keys (userId, teamId where applicable)
- Placeholder for entity-specific fields
- System fields (createdAt, updatedAt)
- UpdatedAt trigger
- Indexes (userId, teamId, createdAt)
- RLS policies (mode-specific)

### 002_entity_metas.sql.template

Metadata table with:
- Standard meta structure (entityId, metaKey, metaValue)
- JSONB value storage
- isPublic/isSearchable flags
- Unique constraint on (entityId, metaKey)
- GIN indexes for JSONB queries
- RLS policies inheriting from parent

### 003_entity_child.sql.template

Child entity table with:
- parentId foreign key (with CASCADE delete)
- Simplified structure (no direct userId)
- RLS inheriting from parent via EXISTS query
- UpdatedAt trigger

### 100_entity_sample_data.sql.template

Sample data template with:
- ON CONFLICT clause for idempotency
- Example data structure
- Coherent relationships
- Timestamp calculations

---

## Common Patterns

### Adding Constraints

```sql
-- Check constraint
CONSTRAINT products_price_positive CHECK (price >= 0),
CONSTRAINT products_stock_positive CHECK (stock >= 0),

-- Status enum constraint
CONSTRAINT products_status_check CHECK (status IN ('draft', 'active', 'archived'))
```

### Adding JSONB Fields

```sql
-- JSONB field
metadata     JSONB DEFAULT '{}'::jsonb,
tags         JSONB DEFAULT '[]'::jsonb,

-- GIN indexes
CREATE INDEX IF NOT EXISTS idx_products_metadata_gin ON public."products" USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_products_tags_gin     ON public."products" USING GIN (tags);
```

### Soft Delete Pattern

```sql
-- Add to entity fields
"deletedAt"  TIMESTAMPTZ,

-- Partial index for active records
CREATE INDEX IF NOT EXISTS idx_products_active
ON public."products"(id) WHERE "deletedAt" IS NULL;
```

---

## Anti-Patterns (AVOID)

### 1. snake_case Fields
```sql
-- ❌ WRONG
user_id, created_at, product_name

-- ✅ CORRECT
"userId", "createdAt", productName
```

### 2. Entity-Specific FK Names in Metas
```sql
-- ❌ WRONG
"productId" TEXT NOT NULL REFERENCES products(id)

-- ✅ CORRECT
"entityId" TEXT NOT NULL REFERENCES products(id)
```

### 3. Wrong Timestamp Type
```sql
-- ❌ WRONG
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- ✅ CORRECT
"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 4. Custom Trigger Functions
```sql
-- ❌ WRONG
CREATE FUNCTION update_products_updated_at()...

-- ✅ CORRECT
EXECUTE FUNCTION public.set_updated_at()
```

### 5. Missing CASCADE on Main Table DROP
```sql
-- ❌ WRONG
DROP TABLE IF EXISTS public."products";

-- ✅ CORRECT
DROP TABLE IF EXISTS public."products" CASCADE;
```

---

## Pre-Migration Checklist

Before running migrations, verify:

- [ ] Using TEXT for all ID fields (not UUID type)
- [ ] All field names use camelCase
- [ ] Timestamps use TIMESTAMPTZ with now()
- [ ] Foreign keys use ON DELETE CASCADE
- [ ] Meta tables use "entityId" (not entity-specific names)
- [ ] Child tables use "parentId" (not entity-specific names)
- [ ] Trigger uses public.set_updated_at()
- [ ] RLS policies match entity access requirements
- [ ] Indexes cover common query patterns
- [ ] Sample data uses ON CONFLICT clause

---

## Related Documentation

- `.rules/migrations.md` - Complete migration standards
- `core/docs/10-backend/01-database-overview.md` - Database architecture
- `.claude/agents/db-developer.md` - DB developer agent
- `.claude/agents/db-validator.md` - DB validator agent
- `.claude/commands/db:entity.md` - Entity creation command
