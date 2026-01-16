# /how-to:add-metadata

Interactive guide to working with entity metadata in NextSpark.

**Aliases:** `/how-to:metadata`, `/how-to:entity-metadata`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/entity-system/SKILL.md` - Entity configuration and types
- `.claude/skills/database-migrations/SKILL.md` - Creating metadata tables

---

## Syntax

```
/how-to:add-metadata
/how-to:add-metadata --entity users
/how-to:add-metadata --api
```

---

## Behavior

Guides the user through understanding and implementing the metadata system for entities.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding Metadata
        └── Conceptual framework

Step 2: Metadata Tables
        └── users_metas, entity_metas structure

Step 3: Using MetaService
        └── getEntityMetas, getBulkEntityMetas

Step 4: Helper Functions
        └── withMeta, copyEntityMetas

Step 5: API Patterns
        └── Reading/writing metadata via API
```

---

## Step 1: Understanding Metadata

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: ADD METADATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding Metadata

Metadata allows you to extend entities with
flexible key-value data without schema changes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 What is Metadata?**

```
┌─────────────────────────────────────────────┐
│  METADATA = Flexible Extension Data         │
│  ─────────────────────────────────────────  │
│                                             │
│  • Key-value pairs attached to entities     │
│  • No schema changes required               │
│  • Stored in separate _metas tables         │
│  • Supports any data type (JSON)            │
│  • Can be public or private                 │
│  • Searchable/filterable                    │
└─────────────────────────────────────────────┘
```

**📋 When to Use Metadata:**

| Use Metadata | Use Schema Fields |
|--------------|-------------------|
| Optional/rare data | Required/common data |
| User-defined fields | Core business fields |
| Plugin extensions | Standard CRUD fields |
| A/B test data | Type-safe fields |
| Feature flags | Searchable fields |
| Temporary data | Indexed fields |

**📋 Metadata vs Schema Fields:**

```typescript
// Schema field (in entity table)
// ✓ Type-safe, indexed, required
interface Task {
  id: string
  title: string      // Schema field
  status: string     // Schema field
}

// Metadata (in _metas table)
// ✓ Flexible, optional, extensible
const taskMeta = {
  customPriority: 5,
  userNotes: 'Remember to review',
  featureFlag: true,
  pluginData: { ... }
}
```

**📋 Entity Meta Configuration:**

```typescript
// Core entity configs in types/meta.types.ts
const CORE_ENTITY_CONFIGS = {
  user: {
    entityType: 'user',
    tableName: 'users',
    metaTableName: 'users_metas',
    idColumn: 'userId',
    apiPath: 'users'
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Metadata Tables)
[2] What are good use cases for metadata?
[3] How is metadata different from JSONB columns?
```

---

## Step 2: Metadata Tables

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Metadata Tables
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Metadata is stored in separate _metas tables
following a standard structure.
```

**📋 Metadata Table Schema:**

```sql
-- Example: users_metas table
CREATE TABLE users_metas (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Meta key-value
  metaKey     TEXT NOT NULL,
  metaValue   JSONB NOT NULL,

  -- Type information
  dataType    TEXT NOT NULL DEFAULT 'string',
    -- 'string' | 'number' | 'boolean' | 'json' | 'array'

  -- Visibility & search
  isPublic    BOOLEAN DEFAULT false,
  isSearchable BOOLEAN DEFAULT false,

  -- Timestamps
  createdAt   TIMESTAMPTZ DEFAULT now(),
  updatedAt   TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(userId, metaKey)
);

-- Indexes for performance
CREATE INDEX idx_users_metas_user_id ON users_metas(userId);
CREATE INDEX idx_users_metas_key ON users_metas(metaKey);
CREATE INDEX idx_users_metas_searchable ON users_metas(isSearchable)
  WHERE isSearchable = true;
```

**📋 Creating Metadata Table for Custom Entity:**

```sql
-- For a 'tasks' entity
CREATE TABLE tasks_metas (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entityId    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  metaKey     TEXT NOT NULL,
  metaValue   JSONB NOT NULL,
  dataType    TEXT NOT NULL DEFAULT 'string',

  isPublic    BOOLEAN DEFAULT false,
  isSearchable BOOLEAN DEFAULT false,

  createdAt   TIMESTAMPTZ DEFAULT now(),
  updatedAt   TIMESTAMPTZ DEFAULT now(),

  UNIQUE(entityId, metaKey)
);
```

**📋 EntityMeta Interface:**

```typescript
// From types/meta.types.ts
interface EntityMeta {
  id: string
  metaKey: string
  metaValue: unknown        // Flexible value
  dataType: MetaDataType    // 'string' | 'number' | 'boolean' | 'json' | 'array'
  isPublic: boolean         // Visibility control
  isSearchable: boolean     // Can be searched
  createdAt: string
  updatedAt: string
}
```

**📋 Data Types:**

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `number` | Numeric value | `42` |
| `boolean` | True/false | `true` |
| `json` | Object | `{ "key": "value" }` |
| `array` | Array | `[1, 2, 3]` |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Using MetaService)
[2] How do I add RLS to metadata tables?
[3] Can I have metadata without a table?
```

---

## Step 3: Using MetaService

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Using MetaService
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MetaService provides methods for reading and
writing entity metadata.
```

**📋 MetaService Methods:**

```typescript
// From lib/services/meta.service.ts
import { MetaService } from '@/core/lib/services/meta.service'

// Get metadata for single entity
const metas = await MetaService.getEntityMetas(
  'user',           // entityType
  'user-123',       // entityId
  'current-user',   // userId (for RLS)
  false             // includePrivate
)
// Returns: { preference: 'dark', language: 'en' }

// Get metadata for multiple entities (bulk)
const bulkMetas = await MetaService.getBulkEntityMetas(
  'task',           // entityType
  ['task-1', 'task-2', 'task-3'],  // entityIds
  'current-user',   // userId
  false             // includePrivate
)
// Returns: {
//   'task-1': { priority: 5, notes: '...' },
//   'task-2': { priority: 3 },
//   'task-3': {}
// }
```

**📋 Why Bulk Queries?**

```
┌─────────────────────────────────────────────┐
│  N+1 PROBLEM SOLVED                         │
│  ─────────────────────────────────────────  │
│                                             │
│  WITHOUT bulk:                              │
│  1 query for entity list                    │
│  + N queries for N entity metas             │
│  = N+1 total queries (slow!)                │
│                                             │
│  WITH bulk:                                 │
│  1 query for entity list                    │
│  + 1 query for ALL metas                    │
│  = 2 total queries (fast!)                  │
└─────────────────────────────────────────────┘
```

**📋 Writing Metadata:**

```typescript
// Create/Update metadata payload
interface CreateMetaPayload {
  metaKey: string
  metaValue: unknown
  dataType?: MetaDataType
  isPublic?: boolean
  isSearchable?: boolean
}

// Example: Save user preferences
await MetaService.setEntityMeta(
  'user',
  'user-123',
  {
    metaKey: 'theme',
    metaValue: 'dark',
    dataType: 'string',
    isPublic: true
  }
)

// Delete metadata
await MetaService.deleteEntityMeta(
  'user',
  'user-123',
  'theme'  // metaKey
)
```

**📋 Visibility Control:**

```typescript
// isPublic controls who can see the metadata

// Public metadata (isPublic: true)
// - Visible to all users who can access the entity
// - Good for: preferences, display settings

// Private metadata (isPublic: false)
// - Only visible to entity owner or admin
// - Good for: internal notes, plugin data
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Helper Functions)
[2] How do I query searchable metadata?
[3] Can I use metadata in RLS policies?
```

---

## Step 4: Helper Functions

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Helper Functions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Helper functions make it easy to work with
metadata in common scenarios.
```

**📋 withMeta Helper:**

```typescript
// From lib/helpers/entity-meta.helpers.ts
import { withMeta } from '@/core/lib/helpers/entity-meta.helpers'

// Add metadata to single entity
const task = await getTask(taskId)
const taskWithMeta = await withMeta(
  task,
  'task',
  userId,
  false  // includePrivate
)
// Result: { id, title, status, meta: { priority: 5, notes: '...' } }

// Add metadata to array of entities
const tasks = await getTasks()
const tasksWithMeta = await withMeta(
  tasks,
  'task',
  userId,
  false
)
// Result: [
//   { id: '1', title: '...', meta: { ... } },
//   { id: '2', title: '...', meta: { ... } }
// ]
```

**📋 copyEntityMetas Helper:**

```typescript
import { copyEntityMetas } from '@/core/lib/helpers/entity-meta.helpers'

// Copy metadata from one entity to another
await copyEntityMetas(
  'task',           // entityType
  'source-task-id', // sourceEntityId
  'target-task-id', // targetEntityId
  userId,
  ['priority', 'notes']  // specific keys (optional)
)

// Use case: Duplicating a task with its metadata
const newTask = await duplicateTask(originalTaskId)
await copyEntityMetas('task', originalTaskId, newTask.id, userId)
```

**📋 validateBasicMetas Helper:**

```typescript
import { validateBasicMetas } from '@/core/lib/helpers/entity-meta.helpers'

// Validate metadata before saving
const metas = {
  preference: 'dark',
  count: 42,
  enabled: true
}

try {
  validateBasicMetas(metas)
  // Valid - proceed to save
} catch (error) {
  // Invalid metadata structure
}
```

**📋 Common Pattern: Entity with Meta:**

```typescript
// In your service layer
class TaskService {
  static async getById(taskId: string, userId: string) {
    const task = await db.query(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    )

    // Add metadata
    return withMeta(task, 'task', userId)
  }

  static async list(userId: string) {
    const tasks = await db.query(
      'SELECT * FROM tasks WHERE team_id = $1',
      [teamId]
    )

    // Bulk add metadata (efficient!)
    return withMeta(tasks, 'task', userId)
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (API Patterns)
[2] Show me the full helper file
[3] How do I create a custom helper?
```

---

## Step 5: API Patterns

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: API Patterns
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Expose metadata through your API endpoints.
```

**📋 Including Meta in Entity Response:**

```typescript
// In your API route handler
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  const { searchParams } = new URL(request.url)
  const includeMeta = searchParams.get('include_meta') === 'true'

  const tasks = await TaskService.list(auth.teamId)

  if (includeMeta) {
    const tasksWithMeta = await withMeta(tasks, 'task', auth.userId)
    return createApiResponse({ data: tasksWithMeta })
  }

  return createApiResponse({ data: tasks })
}

// Client usage
// GET /api/v1/tasks?include_meta=true
```

**📋 Metadata CRUD Endpoints:**

```typescript
// GET /api/v1/tasks/:id/meta
export async function GET(request, { params }) {
  const { id } = params
  const auth = await authenticateRequest(request)

  const metas = await MetaService.getEntityMetas(
    'task', id, auth.userId
  )

  return createApiResponse({ data: metas })
}

// POST /api/v1/tasks/:id/meta
export async function POST(request, { params }) {
  const { id } = params
  const auth = await authenticateRequest(request)
  const body = await request.json()

  await MetaService.setEntityMeta('task', id, {
    metaKey: body.key,
    metaValue: body.value,
    dataType: body.type || 'string',
    isPublic: body.isPublic || false
  })

  return createApiResponse({ message: 'Metadata saved' })
}

// DELETE /api/v1/tasks/:id/meta/:key
export async function DELETE(request, { params }) {
  const { id, key } = params
  const auth = await authenticateRequest(request)

  await MetaService.deleteEntityMeta('task', id, key)

  return createApiResponse({ message: 'Metadata deleted' })
}
```

**📋 Query String Pattern:**

```
# Get entity with metadata
GET /api/v1/tasks?include_meta=true

# Get only public metadata
GET /api/v1/tasks?include_meta=public

# Get specific metadata keys
GET /api/v1/tasks?include_meta=true&meta_keys=priority,notes
```

**📋 Response Format:**

```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "My Task",
    "status": "pending",
    "meta": {
      "priority": 5,
      "notes": "Important task",
      "customField": { "nested": "value" }
    }
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Metadata conceptual framework
• Metadata table structure
• Using MetaService
• Helper functions (withMeta, copyEntityMetas)
• API patterns for metadata

📚 Related tutorials:
   • /how-to:create-entity - Create entities with metadata support
   • /how-to:create-migrations - Create metadata tables
   • /how-to:create-api - Create metadata API endpoints

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "What are good use cases for metadata?"

```
📋 Common Metadata Use Cases:

USER PREFERENCES:
• Theme preference (dark/light)
• Language preference
• Notification settings
• Dashboard layout

PLUGIN EXTENSIONS:
• Plugin-specific data
• Integration tokens
• Custom fields from plugins

FEATURE FLAGS:
• Beta feature access
• A/B test groups
• Feature enablement

TEMPORARY DATA:
• Onboarding progress
• Tutorial completion
• Wizard state

CUSTOM FIELDS:
• User-defined fields
• Dynamic form data
• Flexible attributes

ANALYTICS:
• Usage counters
• Last activity timestamps
• Engagement metrics
```

### "How is metadata different from JSONB columns?"

```
📋 Metadata vs JSONB Column:

JSONB COLUMN (on main table):
✓ Part of main entity table
✓ Single query with entity
✓ Can be indexed (specific paths)
✗ Schema changes to modify
✗ All-or-nothing visibility
✗ Hard to manage permissions

METADATA TABLE (separate):
✓ No schema changes needed
✓ Per-key visibility control
✓ Per-key searchability
✓ Easy to extend by plugins
✓ Independent lifecycle
✗ Extra query needed
✗ More complex joins

RECOMMENDATION:
• Use JSONB for structured, known data
• Use metadata for flexible, extensible data
• Use metadata for plugin/theme extensions
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:create-entity` | Create entities with metadata |
| `/how-to:create-migrations` | Create metadata tables |
| `/how-to:create-api` | Create metadata endpoints |
| `/how-to:create-child-entities` | Child entities with metadata |
