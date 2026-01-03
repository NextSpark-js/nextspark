---
description: "[DB Step 2] Generate coherent sample data for database entities"
---

# Database Sample - Generate Test Data

You are generating sample data for database testing.

**Entity or Table:**
{{{ input }}}

---

## Your Mission

Generate coherent, realistic sample data that:

1. **Respects constraints** (foreign keys, unique, check)
2. **Creates relationships** between related entities
3. **Includes edge cases** (empty strings, nulls, max values)
4. **Is reproducible** (uses deterministic values where possible)

---

## Sample Data Generation

### Step 1: Analyze Table Schema

```typescript
// Read the migration file or check existing schema
await Bash({
  command: 'pnpm db:verify',
  description: 'Check current database schema'
})

// Or read migration file
await Read(`migrations/*_create_${entityName}.sql`)
```

### Step 2: Generate SQL Insert Statements

```typescript
const samplePath = `migrations/sample_data_${entityName}.sql`

await Write({
  file_path: samplePath,
  content: `-- Sample Data: ${entityName}
-- Generated: ${new Date().toISOString()}
-- Purpose: Testing and development

-- ============================================
-- SAMPLE ${entityName.toUpperCase()} DATA
-- ============================================

-- Clear existing sample data (optional, for rerunning)
-- DELETE FROM ${entityName} WHERE id IN (
--     '00000000-0000-0000-0000-000000000001',
--     '00000000-0000-0000-0000-000000000002',
--     '00000000-0000-0000-0000-000000000003'
-- );

-- Sample 1: Basic record
INSERT INTO ${entityName} (
    id,
    user_id,
    name,
    description,
    status,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    (SELECT id FROM "user" WHERE email = 'superadmin@nextspark.dev' LIMIT 1),
    'Sample ${EntityName} 1',
    'This is a sample ${entityName} for testing purposes.',
    'active',
    NOW() - INTERVAL '7 days'
);

-- Sample 2: Record with different status
INSERT INTO ${entityName} (
    id,
    user_id,
    name,
    description,
    status,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    (SELECT id FROM "user" WHERE email = 'superadmin@nextspark.dev' LIMIT 1),
    'Sample ${EntityName} 2',
    'Another sample with inactive status.',
    'inactive',
    NOW() - INTERVAL '3 days'
);

-- Sample 3: Record with minimal data
INSERT INTO ${entityName} (
    id,
    user_id,
    name,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000003',
    (SELECT id FROM "user" WHERE email = 'superadmin@nextspark.dev' LIMIT 1),
    'Minimal ${EntityName}',
    'active'
);

-- Sample 4: Record with special characters
INSERT INTO ${entityName} (
    id,
    user_id,
    name,
    description,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000004',
    (SELECT id FROM "user" WHERE email = 'superadmin@nextspark.dev' LIMIT 1),
    'Test with "quotes" & <special> chars',
    'Description with unicode: \u00e1\u00e9\u00ed\u00f3\u00fa \u00f1 \u20ac',
    'active'
);

-- Sample 5: Record for edge case testing (long name)
INSERT INTO ${entityName} (
    id,
    user_id,
    name,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000005',
    (SELECT id FROM "user" WHERE email = 'superadmin@nextspark.dev' LIMIT 1),
    '${Array(50).fill('Long').join(' ')}',
    'active'
);

${hasMetadata ? `
-- ============================================
-- SAMPLE METADATA
-- ============================================

INSERT INTO ${entityName}_metadata (${entityName}_id, key, value) VALUES
    ('00000000-0000-0000-0000-000000000001', 'color', 'blue'),
    ('00000000-0000-0000-0000-000000000001', 'priority', 'high'),
    ('00000000-0000-0000-0000-000000000002', 'color', 'red'),
    ('00000000-0000-0000-0000-000000000002', 'tags', '["tag1", "tag2"]');
` : ''}

${hasChildEntity ? `
-- ============================================
-- SAMPLE CHILD DATA
-- ============================================

INSERT INTO ${entityName}_${childName} (${entityName}_id, name, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Child Item 1', 0),
    ('00000000-0000-0000-0000-000000000001', 'Child Item 2', 1),
    ('00000000-0000-0000-0000-000000000001', 'Child Item 3', 2),
    ('00000000-0000-0000-0000-000000000002', 'Other Child', 0);
` : ''}

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check data was inserted
SELECT 'Total ${entityName}:' as label, COUNT(*) as count FROM ${entityName};
${hasMetadata ? `SELECT 'Total metadata:' as label, COUNT(*) as count FROM ${entityName}_metadata;` : ''}
${hasChildEntity ? `SELECT 'Total children:' as label, COUNT(*) as count FROM ${entityName}_${childName};` : ''}
`
})
```

### Step 3: Run Sample Data Script

```typescript
// Execute the sample data SQL
await Bash({
  command: `psql $DATABASE_URL -f ${samplePath}`,
  description: 'Insert sample data'
})

// Or if using npm script
await Bash({
  command: 'pnpm db:sample',
  description: 'Run sample data script'
})
```

---

## Sample Data Patterns

### Consistent UUIDs for Testing
```sql
-- Use predictable UUIDs for testing
'00000000-0000-0000-0000-000000000001'
'00000000-0000-0000-0000-000000000002'
-- etc.
```

### User References
```sql
-- Reference existing test user
(SELECT id FROM "user" WHERE email = 'superadmin@nextspark.dev' LIMIT 1)
```

### Date Ranges
```sql
-- Records from different time periods
NOW() - INTERVAL '1 year'
NOW() - INTERVAL '30 days'
NOW() - INTERVAL '7 days'
NOW() - INTERVAL '1 day'
NOW()
```

### Status Distribution
```sql
-- Mix of statuses for testing filters
'active'    -- Most common
'inactive'  -- Some inactive
'pending'   -- Some pending
'archived'  -- A few archived
```

---

## Output Format

```markdown
## Sample Data Generated: ${entityName}

### File Created
- **Path:** `migrations/sample_data_${entityName}.sql`

### Records Created
- `${entityName}`: 5 sample records
${hasMetadata ? `- \`${entityName}_metadata\`: 4 metadata entries` : ''}
${hasChildEntity ? `- \`${entityName}_${childName}\`: 4 child records` : ''}

### Test Coverage
- Basic CRUD operations
- Status filtering
- Special characters in text
- Long values (edge case)
- Minimal required fields
- Full optional fields

### Predictable IDs
```
00000000-0000-0000-0000-000000000001 - Basic record
00000000-0000-0000-0000-000000000002 - Inactive status
00000000-0000-0000-0000-000000000003 - Minimal data
00000000-0000-0000-0000-000000000004 - Special characters
00000000-0000-0000-0000-000000000005 - Edge case (long)
```

### Next Steps
1. Run: `pnpm db:sample` or execute SQL directly
2. Verify with: `pnpm db:verify`
3. Use in Cypress tests with known IDs
```

---

**Now generate sample data for the entity described above.**
