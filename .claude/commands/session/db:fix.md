# /session:db:fix

Test and fix database migrations iteratively until success.

---

## Syntax

```
/session:db:fix [--migration <name>]
```

---

## Behavior

Runs migrations, detects errors, fixes them, and retries until successful.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:db:fix                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Run pending migrations                                      │
│     ↓                                                           │
│  2. Check for errors                                            │
│     │                                                           │
│     ├─► No errors: Done                                         │
│     │                                                           │
│     └─► Errors found:                                           │
│         ↓                                                       │
│  3. Analyze error                                               │
│     - Syntax error?                                             │
│     - Missing reference?                                        │
│     - Type mismatch?                                            │
│     ↓                                                           │
│  4. Apply fix                                                   │
│     ↓                                                           │
│  5. Go to step 1                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🗃️ FIX DATABASE MIGRATIONS

─────────────────────────────────────────

📋 ITERATION 1

Running migrations...

❌ Migration failed: 008_products.sql

Error:
ERROR: relation "categories" does not exist
LINE 10: categoryId UUID REFERENCES categories(id),

─────────────────────────────────────────

🔍 ANALYZING ERROR

Type: Missing foreign key reference
Table: categories
Required by: products.categoryId

Analysis:
- categories table not created yet
- Need to create categories before products
- Or make categoryId nullable without FK constraint

Options:
[1] Create categories migration first
[2] Make categoryId nullable (no FK)
[3] Remove categoryId field

> 1

─────────────────────────────────────────

🔧 APPLYING FIX

Creating: 007_categories.sql

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    teamId UUID NOT NULL REFERENCES teams(id),
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_team_isolation ON categories
    USING (teamId = current_setting('app.current_team_id')::UUID);
```

✓ Migration created

Renumbering: 008_products.sql → 008_products.sql (unchanged)

─────────────────────────────────────────

📋 ITERATION 2

Running migrations...

✓ 007_categories.sql executed
✓ 008_products.sql executed

─────────────────────────────────────────

📊 SUMMARY

Iterations: 2
Migrations fixed: 1
Migrations created: 1

Database is now up to date.
```

---

## Common Error Fixes

| Error | Auto-Fix |
|-------|----------|
| Missing table reference | Create migration or reorder |
| Syntax error | Fix SQL syntax |
| Type mismatch | Cast or change type |
| Duplicate key | Update or skip |
| RLS policy error | Fix policy syntax |

---

## With Specific Migration

```
/session:db:fix --migration 008_products
```

Output:

```
🗃️ FIX MIGRATION: 008_products.sql

─────────────────────────────────────────

Running 008_products.sql...

⚠️ Warning: Migration partially applied

Issues:
1. Table created
2. Indexes created
3. ❌ RLS policy failed

Error:
ERROR: policy "products_team_isolation" already exists

─────────────────────────────────────────

🔧 FIX OPTIONS

[1] Drop and recreate policy
[2] Skip policy (already exists)
[3] Rename new policy

> 2

Skipping existing policy...
✓ Migration completed with skip

─────────────────────────────────────────

Verifying database state...
✓ Table: products exists
✓ Columns: 9 columns correct
✓ Indexes: 3 indexes present
✓ RLS: Enabled with policies

Database is consistent.
```

---

## Options

| Option | Description |
|--------|-------------|
| `--migration <name>` | Fix specific migration |
| `--max-iterations <n>` | Max fix attempts (default: 5) |
| `--dry-run` | Show fixes without applying |
| `--reset` | Drop and recreate tables |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:db:entity` | Create entity migration |
| `/session:db:sample` | Generate sample data |
