---
description: Test and fix database migrations iteratively until success
---

# Database Fix - Iterative Migration Repair

You are fixing database migration issues through iterative testing and correction.

**Migration File or Error Description:**
{{{ input }}}

---

## Your Mission

Fix database migration issues through an iterative loop:

1. **Run the migration** to identify errors
2. **Analyze the error** to understand the root cause
3. **Fix the migration** SQL or schema
4. **Retry until success** (max 5 attempts)
5. **Document the fix** for future reference

---

## Migration Fix Protocol

### Step 1: Identify Migration File

```typescript
// If input is a file path
const migrationPath = input

// If input is an error description, find related migration
await Glob('migrations/*.sql')

// Read the migration file
await Read(migrationPath)
```

### Step 2: Run Migration and Capture Error

```typescript
await Bash({
  command: 'pnpm db:migrate 2>&1',
  description: 'Run database migration'
})

// Or run specific migration
await Bash({
  command: `psql $DATABASE_URL -f ${migrationPath} 2>&1`,
  description: 'Run specific migration file'
})
```

### Step 3: Analyze Error Type

**Common PostgreSQL Errors:**

| Error Code | Description | Common Fix |
|------------|-------------|------------|
| `42P01` | Undefined table | Create table first or fix reference |
| `42P07` | Duplicate table | Add `IF NOT EXISTS` |
| `42703` | Undefined column | Check column name spelling |
| `42701` | Duplicate column | Remove duplicate or use `IF NOT EXISTS` |
| `23503` | Foreign key violation | Fix reference or add missing data |
| `23505` | Unique violation | Handle duplicates in sample data |
| `42883` | Undefined function | Create function or fix name |
| `42804` | Datatype mismatch | Fix column type casting |
| `22P02` | Invalid text representation | Fix UUID format or type |
| `42P16` | Invalid table definition | Fix table structure |

### Step 4: Apply Fix

```typescript
const MAX_ATTEMPTS = 5

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}`)

  // Run migration
  const result = await Bash({
    command: `psql $DATABASE_URL -f ${migrationPath} 2>&1`,
    description: `Migration attempt ${attempt}`
  })

  if (result.success) {
    console.log('Migration successful!')
    break
  }

  // Analyze error
  const error = parsePostgresError(result.stderr)

  // Apply appropriate fix
  switch (error.code) {
    case '42P01': // Undefined table
      await fixUndefinedTable(error, migrationPath)
      break

    case '42P07': // Duplicate table
      await fixDuplicateTable(error, migrationPath)
      break

    case '42703': // Undefined column
      await fixUndefinedColumn(error, migrationPath)
      break

    case '23503': // Foreign key violation
      await fixForeignKeyViolation(error, migrationPath)
      break

    case '23505': // Unique violation
      await fixUniqueViolation(error, migrationPath)
      break

    default:
      await analyzeAndFixGenericError(error, migrationPath)
  }
}
```

---

## Common Fix Patterns

### Fix: Undefined Table (42P01)

```typescript
// Error: relation "user" does not exist
// Problem: Referencing table that doesn't exist

await Edit({
  file_path: migrationPath,
  old_string: 'REFERENCES user(id)',
  new_string: 'REFERENCES "user"(id)'  // Quote reserved word
})

// Or if table truly missing, add dependency comment
await Edit({
  file_path: migrationPath,
  old_string: '-- Migration:',
  new_string: `-- Migration:
-- DEPENDS ON: 001_create_user.sql`
})
```

### Fix: Duplicate Table (42P07)

```typescript
// Error: relation "entity" already exists
// Fix: Add IF NOT EXISTS

await Edit({
  file_path: migrationPath,
  old_string: 'CREATE TABLE entity (',
  new_string: 'CREATE TABLE IF NOT EXISTS entity ('
})
```

### Fix: Undefined Column (42703)

```typescript
// Error: column "user_id" of relation "entity" does not exist
// Fix: Check spelling or add column

await Edit({
  file_path: migrationPath,
  old_string: 'userId UUID',
  new_string: 'user_id UUID'  // Fix snake_case
})
```

### Fix: Foreign Key Violation (23503)

```typescript
// Error: insert or update violates foreign key constraint
// Fix: Ensure referenced record exists

await Edit({
  file_path: migrationPath,
  old_string: "VALUES ('hardcoded-user-id',",
  new_string: `VALUES (
    (SELECT id FROM "user" WHERE email = 'superadmin@nextspark.dev' LIMIT 1),`
})
```

### Fix: Unique Violation (23505)

```typescript
// Error: duplicate key value violates unique constraint
// Fix: Use ON CONFLICT or unique IDs

await Edit({
  file_path: migrationPath,
  old_string: 'INSERT INTO entity',
  new_string: `INSERT INTO entity
ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`
})
```

### Fix: Function Not Found (42883)

```typescript
// Error: function uuid_generate_v4() does not exist
// Fix: Enable extension

await Edit({
  file_path: migrationPath,
  old_string: '-- Migration:',
  new_string: `-- Migration:

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
})
```

### Fix: Type Mismatch (42804)

```typescript
// Error: column "amount" is of type numeric but expression is of type text
// Fix: Add explicit cast

await Edit({
  file_path: migrationPath,
  old_string: "amount = 'value'",
  new_string: "amount = 'value'::numeric"
})
```

---

## Step 5: Verify Success

```typescript
// Verify tables were created
await Bash({
  command: 'pnpm db:verify',
  description: 'Verify database schema'
})

// Or check specific table
await Bash({
  command: `psql $DATABASE_URL -c "\\d ${tableName}"`,
  description: 'Describe table structure'
})

// Check row counts
await Bash({
  command: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM ${tableName}"`,
  description: 'Count table rows'
})
```

---

## Step 6: Document the Fix

```typescript
// Add comment to migration file explaining fix
await Edit({
  file_path: migrationPath,
  old_string: '-- Migration:',
  new_string: `-- Migration:
-- FIX APPLIED (${date}):
-- - Issue: ${errorDescription}
-- - Solution: ${fixApplied}
-- - Attempts: ${attemptCount}`
})
```

---

## Output Format

```markdown
## Migration Fix Complete

**File:** `${migrationPath}`
**Attempts:** ${attemptCount}/${MAX_ATTEMPTS}
**Status:** ✅ Success / ❌ Failed

### Error History
| Attempt | Error | Fix Applied |
|---------|-------|-------------|
| 1 | 42P01: relation "user" does not exist | Added quotes around reserved word |
| 2 | 42883: function uuid_generate_v4() not found | Added CREATE EXTENSION |
| 3 | ✅ Success | - |

### Changes Made
\`\`\`diff
- REFERENCES user(id)
+ REFERENCES "user"(id)

+ CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\`\`\`

### Verification
- Tables created: ✅
- Indexes created: ✅
- Triggers created: ✅
- Sample data inserted: ✅

### Lessons Learned
- Always quote reserved words in PostgreSQL
- Enable uuid-ossp extension before using uuid_generate_v4()
- Use IF NOT EXISTS for idempotent migrations
```

---

## Rollback on Failure

If max attempts exceeded:

```typescript
if (attempt > MAX_ATTEMPTS) {
  // Generate rollback script
  await Write({
    file_path: `migrations/rollback_${entityName}.sql`,
    content: `-- Rollback for failed migration
-- Generated: ${date}
-- Original file: ${migrationPath}

DROP TABLE IF EXISTS ${tableName} CASCADE;
DROP FUNCTION IF EXISTS update_${tableName}_updated_at();

-- Note: This rollback was generated due to migration failure
-- Review the original migration file for issues
`
  })

  console.log(`
Migration failed after ${MAX_ATTEMPTS} attempts.
Rollback script generated: migrations/rollback_${entityName}.sql

Manual intervention required. Check:
1. Database connection (DATABASE_URL)
2. User permissions
3. Dependent tables exist
4. Data type compatibility
`)
}
```

---

## Best Practices

### DO:
- Use `IF NOT EXISTS` for all CREATE statements
- Quote reserved words (`"user"`, `"order"`, etc.)
- Add explicit type casts where needed
- Enable extensions at the start of migration
- Use transactions for multi-statement migrations
- Test migrations on a copy of production data

### DON'T:
- Hardcode UUIDs that might conflict
- Reference tables before they're created
- Use reserved words without quotes
- Assume extensions are already enabled
- Ignore error messages - they're specific for a reason

---

## PostgreSQL Reserved Words (Common Pitfalls)

Always quote these as table/column names:
- `user`, `order`, `group`, `table`, `select`, `insert`
- `date`, `time`, `timestamp`, `interval`
- `key`, `value`, `index`, `type`, `status`
- `check`, `default`, `primary`, `foreign`

```sql
-- ❌ Wrong
SELECT * FROM user WHERE order = 1

-- ✅ Correct
SELECT * FROM "user" WHERE "order" = 1
```

---

**Now fix the migration issue described above.**
