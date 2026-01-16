# /session:db:entity

Generate migration for an entity with relations and metadata support.

---

## Required Skills

**[MANDATORY]** Read these skills before executing:
- `.claude/skills/database-migrations/SKILL.md` - PostgreSQL patterns with RLS
- `.claude/skills/entity-system/SKILL.md` - Entity configuration patterns

---

## Syntax

```
/session:db:entity <entity-name> [--fields <fields>]
```

---

## Behavior

Creates a complete database migration following project conventions including RLS policies.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:db:entity                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Analyze entity requirements                                 │
│     - Read session context                                      │
│     - Parse field definitions                                   │
│     ↓                                                           │
│  2. Determine relations                                         │
│     - Foreign keys                                              │
│     - Many-to-many tables                                       │
│     ↓                                                           │
│  3. Generate migration SQL                                      │
│     - Main table with camelCase fields                          │
│     - Meta table (if needed)                                    │
│     - RLS policies                                              │
│     ↓                                                           │
│  4. Validate SQL syntax                                         │
│     ↓                                                           │
│  5. Create migration file                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🗃️ CREATE ENTITY MIGRATION

Entity: products

─────────────────────────────────────────

📋 ENTITY ANALYSIS

From session requirements:
- name: string (required)
- description: text (optional)
- price: decimal (required)
- categoryId: UUID FK (optional)
- isActive: boolean (default: true)

Relations detected:
- products → categories (many-to-one)

─────────────────────────────────────────

📝 GENERATED MIGRATION

File: core/db/migrations/008_products.sql

```sql
-- ============================================
-- Migration: 008_products.sql
-- Entity: products
-- Generated: 2026-01-11
-- ============================================

-- Main table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Fields (camelCase)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    categoryId UUID REFERENCES categories(id),
    isActive BOOLEAN NOT NULL DEFAULT true,

    -- System fields
    teamId UUID NOT NULL REFERENCES teams(id),
    createdById UUID REFERENCES "user"(id),
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_teamId ON products(teamId);
CREATE INDEX idx_products_categoryId ON products(categoryId);
CREATE INDEX idx_products_isActive ON products(isActive);

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_team_isolation ON products
    USING (teamId = current_setting('app.current_team_id')::UUID);

CREATE POLICY products_select ON products
    FOR SELECT USING (true);

CREATE POLICY products_insert ON products
    FOR INSERT WITH CHECK (
        teamId = current_setting('app.current_team_id')::UUID
    );

CREATE POLICY products_update ON products
    FOR UPDATE USING (
        teamId = current_setting('app.current_team_id')::UUID
    );

CREATE POLICY products_delete ON products
    FOR DELETE USING (
        teamId = current_setting('app.current_team_id')::UUID
    );

-- Trigger for updatedAt
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

─────────────────────────────────────────

✅ VALIDATION

- [x] camelCase field names
- [x] UUID primary key
- [x] TIMESTAMPTZ for dates
- [x] RLS policies configured
- [x] teamId for multi-tenant

─────────────────────────────────────────

✓ Migration created: 008_products.sql

Next: /session:db:sample to generate sample data
```

---

## With Meta Table

```
/session:db:entity products --with-meta
```

Generates additional meta table:

```sql
-- Meta table for extensible fields
CREATE TABLE products_meta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    productId UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(productId, key)
);

CREATE INDEX idx_products_meta_productId ON products_meta(productId);
CREATE INDEX idx_products_meta_key ON products_meta(key);
```

---

## Options

| Option | Description |
|--------|-------------|
| `--fields <fields>` | Field definitions (name:type) |
| `--with-meta` | Include meta table |
| `--no-rls` | Skip RLS policies |
| `--dry-run` | Show SQL without creating |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:db:sample` | Generate sample data |
| `/session:db:fix` | Fix migration issues |
