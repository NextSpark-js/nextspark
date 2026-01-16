# /how-to:create-migrations

Interactive guide to create database migrations in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/database-migrations/SKILL.md` - PostgreSQL migration patterns

---

## Syntax

```
/how-to:create-migrations
```

---

## Behavior

Guides the user through creating database migrations with RLS, relations, and sample data.

---

## Tutorial Overview

```
STEPS OVERVIEW (4 steps)

Step 1: Understanding Migrations
        └── Migration structure and naming

Step 2: Create Entity Migration
        └── Tables with RLS policies

Step 3: Add Relations and Indexes
        └── Foreign keys and performance

Step 4: Create Sample Data Migration
        └── Seed data for testing
```

---

## Step 1: Understanding Migrations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE MIGRATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Understanding Migrations

NextSpark uses SQL migrations with automatic execution:

┌─────────────────────────────────────────────┐
│  MIGRATION TYPES                            │
│  ─────────────────────────────────────────  │
│                                             │
│  1. CORE MIGRATIONS                         │
│     core/migrations/                        │
│     → Auth tables, base schema              │
│                                             │
│  2. ENTITY MIGRATIONS                       │
│     themes/{theme}/entities/*/migrations/   │
│     → Entity tables with RLS                │
│                                             │
│  3. PLUGIN MIGRATIONS                       │
│     plugins/*/migrations/                   │
│     → Plugin-specific tables                │
│                                             │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Migration File Naming:

Format: YYYYMMDDHHMMSS_description.sql

Examples:
• 20240115100000_create_products.sql
• 20240115100001_add_products_indexes.sql
• 20240115100002_seed_products_data.sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

**📂 Migration Location:**

```
contents/themes/your-theme/entities/products/
└── migrations/
    ├── 20240115100000_create_products.sql
    ├── 20240115100001_add_products_meta.sql
    └── 20240115100002_seed_products.sql
```

**📋 Migration Commands:**

```bash
# Run all pending migrations
pnpm db:migrate

# Create new migration (generates timestamp)
pnpm db:migrate:create "create_products"

# Rollback last migration
pnpm db:migrate:rollback

# Reset entire database (WARNING)
pnpm db:reset

# Check migration status
pnpm db:migrate:status
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Entity Migration)
[2] Show me the migration tracking table
[3] How do I rollback safely?
```

---

## Step 2: Create Entity Migration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Create Entity Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create the main entity table with RLS:
```

**📋 Main Table Migration:**

```sql
-- 20240115100000_create_products.sql

-- ============================================
-- CREATE PRODUCTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS "products" (
  -- Primary key (UUID)
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Team ownership (required for RLS)
  "teamId" UUID NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,

  -- Entity fields (use camelCase!)
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "sku" VARCHAR(100),
  "stock" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
  "categoryId" UUID REFERENCES "categories"("id") ON DELETE SET NULL,

  -- Audit fields
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdBy" UUID REFERENCES "user"("id") ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES "user"("id") ON DELETE SET NULL
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

-- Policy: Team members can view their team's products
CREATE POLICY "products_select_policy" ON "products"
  FOR SELECT
  USING ("teamId" = current_setting('app.current_team_id', true)::UUID);

-- Policy: Team members can insert products
CREATE POLICY "products_insert_policy" ON "products"
  FOR INSERT
  WITH CHECK ("teamId" = current_setting('app.current_team_id', true)::UUID);

-- Policy: Team members can update their team's products
CREATE POLICY "products_update_policy" ON "products"
  FOR UPDATE
  USING ("teamId" = current_setting('app.current_team_id', true)::UUID);

-- Policy: Team members can delete their team's products
CREATE POLICY "products_delete_policy" ON "products"
  FOR DELETE
  USING ("teamId" = current_setting('app.current_team_id', true)::UUID);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX "idx_products_teamId" ON "products"("teamId");
CREATE INDEX "idx_products_status" ON "products"("status");
CREATE INDEX "idx_products_categoryId" ON "products"("categoryId");
CREATE UNIQUE INDEX "idx_products_sku_team" ON "products"("teamId", "sku")
  WHERE "sku" IS NOT NULL;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER "products_updated_at"
  BEFORE UPDATE ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**📋 CRITICAL RULES:**

1. **camelCase field names** - NOT snake_case
2. **teamId is required** - For RLS to work
3. **TIMESTAMPTZ for dates** - Always timezone-aware
4. **UUID for IDs** - Never use SERIAL/BIGSERIAL
5. **RLS policies are mandatory** - For multi-tenant security

**📋 Common Field Types:**

| Field Type | PostgreSQL | Example |
|------------|------------|---------|
| String | VARCHAR(n) | name VARCHAR(255) |
| Text | TEXT | description TEXT |
| Number | INTEGER | stock INTEGER |
| Decimal | DECIMAL(10,2) | price DECIMAL(10,2) |
| Boolean | BOOLEAN | isActive BOOLEAN |
| Date | TIMESTAMPTZ | createdAt TIMESTAMPTZ |
| UUID | UUID | id UUID |
| JSON | JSONB | metadata JSONB |
| Enum | VARCHAR(50) | status VARCHAR(50) |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Relations)
[2] Show me metadata table pattern
[3] How does RLS work?
```

---

## Step 3: Add Relations and Indexes

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Relations and Indexes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Parent-Child Relations:**

```sql
-- 20240115100001_create_product_variants.sql

-- Child table (variants belong to products)
CREATE TABLE IF NOT EXISTS "productVariants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent reference (NOT teamId for children)
  "productId" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,

  -- Variant fields
  "name" VARCHAR(255) NOT NULL,
  "sku" VARCHAR(100),
  "price" DECIMAL(10,2),
  "stock" INTEGER NOT NULL DEFAULT 0,
  "attributes" JSONB DEFAULT '{}',

  -- Audit
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for child tables (through parent)
ALTER TABLE "productVariants" ENABLE ROW LEVEL SECURITY;

-- Select via parent's team
CREATE POLICY "productVariants_select_policy" ON "productVariants"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "products" p
      WHERE p."id" = "productVariants"."productId"
      AND p."teamId" = current_setting('app.current_team_id', true)::UUID
    )
  );

-- Insert via parent's team
CREATE POLICY "productVariants_insert_policy" ON "productVariants"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "products" p
      WHERE p."id" = "productVariants"."productId"
      AND p."teamId" = current_setting('app.current_team_id', true)::UUID
    )
  );

-- Update via parent's team
CREATE POLICY "productVariants_update_policy" ON "productVariants"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "products" p
      WHERE p."id" = "productVariants"."productId"
      AND p."teamId" = current_setting('app.current_team_id', true)::UUID
    )
  );

-- Delete via parent's team
CREATE POLICY "productVariants_delete_policy" ON "productVariants"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "products" p
      WHERE p."id" = "productVariants"."productId"
      AND p."teamId" = current_setting('app.current_team_id', true)::UUID
    )
  );

-- Indexes
CREATE INDEX "idx_productVariants_productId" ON "productVariants"("productId");
```

**📋 Metadata Table Pattern:**

```sql
-- 20240115100002_create_products_meta.sql

CREATE TABLE IF NOT EXISTS "productsMeta" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "key" VARCHAR(255) NOT NULL,
  "value" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE("productId", "key")
);

ALTER TABLE "productsMeta" ENABLE ROW LEVEL SECURITY;

-- RLS through parent product
CREATE POLICY "productsMeta_select_policy" ON "productsMeta"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "products" p
      WHERE p."id" = "productsMeta"."productId"
      AND p."teamId" = current_setting('app.current_team_id', true)::UUID
    )
  );

-- Similar policies for INSERT, UPDATE, DELETE...

CREATE INDEX "idx_productsMeta_productId" ON "productsMeta"("productId");
CREATE INDEX "idx_productsMeta_key" ON "productsMeta"("key");
```

**📋 Many-to-Many Relations:**

```sql
-- 20240115100003_create_product_tags.sql

-- Junction table for products <-> tags
CREATE TABLE IF NOT EXISTS "productTags" (
  "productId" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "tagId" UUID NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY ("productId", "tagId")
);

ALTER TABLE "productTags" ENABLE ROW LEVEL SECURITY;

-- RLS through product's team
CREATE POLICY "productTags_all_policy" ON "productTags"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "products" p
      WHERE p."id" = "productTags"."productId"
      AND p."teamId" = current_setting('app.current_team_id', true)::UUID
    )
  );

CREATE INDEX "idx_productTags_tagId" ON "productTags"("tagId");
```

**📋 Performance Indexes:**

```sql
-- Composite index for common queries
CREATE INDEX "idx_products_team_status"
  ON "products"("teamId", "status");

-- Partial index for active products only
CREATE INDEX "idx_products_active"
  ON "products"("teamId", "createdAt")
  WHERE "status" = 'active';

-- Text search index
CREATE INDEX "idx_products_search"
  ON "products" USING gin(to_tsvector('english', "name" || ' ' || COALESCE("description", '')));
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Sample Data)
[2] Show me more index patterns
[3] How do I handle soft deletes?
```

---

## Step 4: Create Sample Data Migration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Sample Data Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create realistic sample data for development and testing:
```

**📋 Sample Data Migration:**

```sql
-- 20240115100010_seed_products.sql

-- ============================================
-- SAMPLE DATA FOR PRODUCTS
-- ============================================

-- First, get a valid team ID (from dev keyring user's team)
DO $$
DECLARE
  v_team_id UUID;
  v_user_id UUID;
  v_category_id UUID;
BEGIN
  -- Get the first team (created by dev keyring)
  SELECT "id" INTO v_team_id FROM "team" LIMIT 1;
  SELECT "id" INTO v_user_id FROM "user" LIMIT 1;

  -- Create sample category first
  INSERT INTO "categories" ("id", "teamId", "name", "slug", "createdBy")
  VALUES
    (gen_random_uuid(), v_team_id, 'Electronics', 'electronics', v_user_id),
    (gen_random_uuid(), v_team_id, 'Clothing', 'clothing', v_user_id),
    (gen_random_uuid(), v_team_id, 'Home & Garden', 'home-garden', v_user_id)
  ON CONFLICT DO NOTHING;

  -- Get electronics category
  SELECT "id" INTO v_category_id FROM "categories"
  WHERE "teamId" = v_team_id AND "slug" = 'electronics' LIMIT 1;

  -- Insert sample products
  INSERT INTO "products" (
    "teamId", "name", "description", "price", "sku", "stock",
    "status", "categoryId", "createdBy"
  ) VALUES
    -- Electronics
    (v_team_id, 'Wireless Bluetooth Headphones',
     'Premium noise-canceling headphones with 30-hour battery life',
     149.99, 'ELEC-001', 50, 'active', v_category_id, v_user_id),

    (v_team_id, 'Smart Watch Pro',
     'Advanced fitness tracking with heart rate monitor and GPS',
     299.99, 'ELEC-002', 30, 'active', v_category_id, v_user_id),

    (v_team_id, 'Portable Charger 20000mAh',
     'High-capacity power bank with fast charging support',
     49.99, 'ELEC-003', 100, 'active', v_category_id, v_user_id),

    (v_team_id, 'Wireless Earbuds',
     'True wireless earbuds with active noise cancellation',
     89.99, 'ELEC-004', 75, 'active', v_category_id, v_user_id),

    (v_team_id, '4K Webcam',
     'Professional webcam for streaming and video calls',
     129.99, 'ELEC-005', 25, 'active', v_category_id, v_user_id),

    -- Draft product
    (v_team_id, 'VR Headset (Coming Soon)',
     'Next-generation virtual reality headset',
     499.99, 'ELEC-006', 0, 'draft', v_category_id, v_user_id),

    -- Inactive product
    (v_team_id, 'MP3 Player (Discontinued)',
     'Classic portable music player',
     29.99, 'ELEC-007', 5, 'inactive', v_category_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- Add product variants
  INSERT INTO "productVariants" ("productId", "name", "sku", "price", "stock", "attributes")
  SELECT
    p."id",
    'Black',
    p."sku" || '-BLK',
    p."price",
    p."stock" / 2,
    '{"color": "black"}'::jsonb
  FROM "products" p
  WHERE p."teamId" = v_team_id AND p."status" = 'active'
  ON CONFLICT DO NOTHING;

  -- Add metadata
  INSERT INTO "productsMeta" ("productId", "key", "value")
  SELECT
    p."id",
    'warranty',
    '2 years'
  FROM "products" p
  WHERE p."teamId" = v_team_id AND p."status" = 'active'
  ON CONFLICT DO NOTHING;

END $$;
```

**📋 Sample Data Best Practices:**

1. **Use DO $$ blocks** for variables
2. **ON CONFLICT DO NOTHING** for idempotency
3. **Reference existing teams** from dev keyring
4. **Create related data** (categories before products)
5. **Include various states** (active, draft, inactive)
6. **Realistic quantities** (50+ records for pagination testing)

**📋 Run Migrations:**

```bash
# Run all migrations
pnpm db:migrate

# Verify data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM products"

# Check sample data
psql $DATABASE_URL -c "SELECT name, status, price FROM products LIMIT 10"
```

**📋 Migration Checklist:**

- [ ] Migration files use correct timestamp format
- [ ] Table uses camelCase field names
- [ ] teamId column exists with FK to team
- [ ] RLS is enabled with proper policies
- [ ] Indexes created for common queries
- [ ] updatedAt trigger is set up
- [ ] Sample data references existing team
- [ ] ON CONFLICT handles re-runs

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Migration file structure and naming
• Creating tables with RLS policies
• Parent-child relationships
• Sample data generation

📚 Related tutorials:
   • /how-to:setup-database - Database setup
   • /how-to:create-entity - Entity configuration

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:setup-database` | Database setup |
| `/how-to:create-entity` | Create entities |
| `/session:db:fix` | Fix migration issues |
