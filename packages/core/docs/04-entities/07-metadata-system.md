# Metadata System

The metadata system allows adding dynamic fields to entities without modifying the database schema. It's perfect for custom fields, user-specific configurations, or extensible data.

## What is Metadata?

Metadata are key-value pairs stored in a separate table (`{entity}_metas`) that links to the main table via `entityId`. It allows adding unlimited fields without database migrations.

## Enabling

### In EntityConfig

```typescript
{
  access: {
    metadata: true  // Enables the metadata system
  }
}
```

This automatically:
- Creates `{slug}_metas` table in migrations
- Enables metadata APIs
- Allows adding/editing metadata in UI

## Database Structure

### Automatic Table

```sql
CREATE TABLE "{entity}_metas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entityId" UUID NOT NULL REFERENCES "{entity}"("id") ON DELETE CASCADE,
  "metaKey" VARCHAR(255) NOT NULL,
  "metaValue" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("entityId", "metaKey")
);

CREATE INDEX "idx_{entity}_metas_entityId" ON "{entity}_metas"("entityId");
CREATE INDEX "idx_{entity}_metas_metaKey" ON "{entity}_metas"("metaKey");
```

**Example for `tasks`:**

```sql
CREATE TABLE "tasks_metas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entityId" UUID NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "metaKey" VARCHAR(255) NOT NULL,
  "metaValue" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("entityId", "metaKey")
);
```

## Usage in APIs

### GET with Metadata

```typescript
// GET /api/v1/tasks/123?include=metadata

{
  "success": true,
  "data": {
    "id": "123",
    "title": "My task",
    "status": "todo",
    // Main fields...
    
    "metas": {
      "custom_field_1": "value1",
      "custom_field_2": "value2",
      "priority_score": "85",
      "external_id": "EXT-123"
    }
  }
}
```

### POST/PATCH with Metadata

```typescript
// POST /api/v1/tasks
{
  "title": "New task",
  "status": "todo",
  "metas": {
    "custom_field_1": "value1",
    "priority_score": "90"
  }
}

// PATCH /api/v1/tasks/123
{
  "status": "in-progress",
  "metas": {
    "priority_score": "95"  // Updates only this meta
  }
}
```

## Use Cases

### 1. Custom Fields per User

```typescript
// User A adds "Department"
{
  "metas": {
    "department": "Marketing"
  }
}

// User B adds "Cost Center"
{
  "metas": {
    "cost_center": "CC-001"
  }
}
```

### 2. External Integrations

```typescript
// Store IDs from external systems
{
  "metas": {
    "jira_id": "PROJ-123",
    "salesforce_id": "SF-456",
    "slack_thread_id": "T123456"
  }
}
```

### 3. Specific Configurations

```typescript
// Instance-specific configurations
{
  "metas": {
    "notification_enabled": "true",
    "reminder_frequency": "daily",
    "assigned_color": "#FF5733"
  }
}
```

### 4. Temporary Data/Cache

```typescript
// Calculated data or cache
{
  "metas": {
    "last_calculated_score": "85.5",
    "cache_completion_percentage": "75",
    "cached_at": "2024-01-15T10:00:00Z"
  }
}
```

## Smart Merge

The system automatically merges in queries:

```typescript
// Optimized SQL query
SELECT 
  t.*,
  json_object_agg(m."metaKey", m."metaValue") as metas
FROM tasks t
LEFT JOIN tasks_metas m ON t.id = m."entityId"
WHERE t.id = $1
GROUP BY t.id
```

**Result:** A single object with main data + metadata.

## Performance

### Indexing

Metadata tables have automatic indexes:
- `entityId`: To find all metas of an entity
- `metaKey`: To find entities by specific meta

### Limits

- **metaKey**: 255 characters max
- **metaValue**: TEXT (virtually unlimited)
- Recommendation: Max 50-100 metas per entity

### Optimized Queries

```sql
-- Search by specific meta
SELECT t.* 
FROM tasks t
JOIN tasks_metas m ON t.id = m."entityId"
WHERE m."metaKey" = 'priority_score'
AND m."metaValue"::integer > 80
```

## Row Level Security

```sql
-- RLS for metadata (inherits from parent)
ALTER TABLE "tasks_metas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_metas_select" ON "tasks_metas"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "tasks"
      WHERE "tasks"."id" = "tasks_metas"."entityId"
      AND "tasks"."userId" = auth.uid()
    )
  );

-- Similar policies for INSERT, UPDATE, DELETE
```

## Validation

### Data Types

`metaValue` is always TEXT. You must cast in queries:

```sql
-- For numbers
WHERE ("metaValue")::integer > 50

-- For booleans
WHERE ("metaValue")::boolean = true

-- For dates
WHERE ("metaValue")::timestamp > NOW()

-- For JSON
WHERE ("metaValue")::jsonb @> '{"key": "value"}'
```

### In Code

```typescript
// Type-safe with schemas
const taskMetaSchema = z.object({
  priority_score: z.string().transform(Number),
  notification_enabled: z.string().transform(Boolean),
  tags: z.string().transform(JSON.parse)
})

// Validate
const validated = taskMetaSchema.parse(task.metas)
```

## Differences: Metadata vs Normal Fields

| Aspect | Normal Fields | Metadata |
|---------|---------------|----------|
| **Schema** | Fixed (requires migration) | Flexible (no migration) |
| **Validation** | Automatic (Zod) | Manual (TEXT) |
| **Indexing** | Direct | Via separate table |
| **Performance** | Faster | Slightly slower |
| **Queries** | Simple | JOIN required |
| **Usage** | Known fields | Dynamic fields |

## Best Practices

### ✅ Use Metadata For:

- Custom fields per user
- IDs from external systems
- Optional configurations
- Temporary data/cache
- Experimental features
- Data that changes frequently

### ❌ Avoid Metadata For:

- Critical business fields
- Frequently queried data
- Relationships between entities
- Fields with complex validation
- Data that needs specific indexes

## Migration to Normal Fields

If a metadata becomes critical, migrate it:

```sql
-- 1. Add normal column
ALTER TABLE "tasks" ADD COLUMN "priority_score" INTEGER;

-- 2. Migrate data
UPDATE "tasks" t
SET "priority_score" = (
  SELECT ("metaValue")::integer
  FROM "tasks_metas" m
  WHERE m."entityId" = t.id
  AND m."metaKey" = 'priority_score'
);

-- 3. (Optional) Remove metadata
DELETE FROM "tasks_metas" WHERE "metaKey" = 'priority_score';
```

## Complete Example

```typescript
// 1. Enable in config
{
  access: {
    metadata: true
  }
}

// 2. Create task with metadata
const task = await createEntity('tasks', {
  title: 'New task',
  status: 'todo',
  metas: {
    department: 'Engineering',
    priority_score: '90',
    external_id: 'JIRA-123',
    tags: JSON.stringify(['urgent', 'backend'])
  }
})

// 3. Read with metadata
const task = await getEntity('tasks', '123', {
  include: ['metadata']
})

console.log(task.metas.department)  // 'Engineering'
console.log(task.metas.priority_score)  // '90'

// 4. Update metadata
await updateEntity('tasks', '123', {
  metas: {
    priority_score: '95'  // Only updates this field
  }
})

// 5. Search by metadata
const tasks = await listEntities('tasks', {
  metaFilters: {
    department: 'Engineering',
    'priority_score>': '80'
  }
})
```

## Next Steps

1. **[Advanced Patterns](./11-advanced-patterns.md)** - Advanced patterns with metadata
2. **[Permissions](./09-permissions.md)** - Permissions in metadata
3. **[Examples](./12-examples.md)** - Complete examples

---

> 💡 **Tip**: Use metadata for fields that only some users need or for external integrations. For core business fields, use normal fields in EntityConfig.
