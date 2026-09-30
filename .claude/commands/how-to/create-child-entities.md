# /how-to:create-child-entities

Interactive guide to implementing parent-child entity relationships in NextSpark.

**Aliases:** `/how-to:child-entities`, `/how-to:nested-entities`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/entity-system/SKILL.md` - Entity configuration and types
- `.claude/skills/database-migrations/SKILL.md` - Creating tables with foreign keys
- `.claude/skills/entity-api/SKILL.md` - Dynamic entity API endpoints

---

## Syntax

```
/how-to:create-child-entities
/how-to:create-child-entities --parent tasks
/how-to:create-child-entities --example
```

---

## Behavior

Guides the user through creating parent-child entity relationships with proper configuration, migrations, and API patterns.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding Parent-Child
        └── Conceptual model and use cases

Step 2: Configure Child Entities
        └── Entity config childEntities array

Step 3: Database Structure
        └── Foreign keys and migrations

Step 4: API Pattern
        └── GET/POST /entity/[id]/child/[type]

Step 5: UI Integration
        └── Displaying child entities
```

---

## Step 1: Understanding Parent-Child

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE CHILD ENTITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding Parent-Child

Child entities belong to a parent entity and
are managed through nested API endpoints.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 What are Child Entities?**

```
┌─────────────────────────────────────────────┐
│  PARENT-CHILD RELATIONSHIP                  │
│  ─────────────────────────────────────────  │
│                                             │
│  PARENT (e.g., Task)                        │
│  └── CHILDREN (e.g., Subtasks)              │
│      ├── Subtask 1                          │
│      ├── Subtask 2                          │
│      └── Subtask 3                          │
│                                             │
│  • Child belongs to ONE parent              │
│  • Deleting parent deletes children         │
│  • Children accessed via parent context     │
└─────────────────────────────────────────────┘
```

**📋 Common Use Cases:**

| Parent | Child | Use Case |
|--------|-------|----------|
| Task | Subtask | Breaking tasks into steps |
| Order | OrderItem | Line items in an order |
| Project | Milestone | Project milestones |
| Invoice | LineItem | Invoice line items |
| Post | Comment | Blog comments |
| Product | Variant | Product variations |

**📋 Parent vs Relation Field:**

```
CHILD ENTITY (parentId):
• Strong ownership
• Cascade delete
• Nested API endpoints
• Child can't exist without parent

RELATION FIELD (foreign key):
• Weak reference
• No cascade delete
• Separate API endpoints
• Related entity is independent
```

**📋 API Pattern:**

```
# Parent entity
GET  /api/v1/tasks
GET  /api/v1/tasks/:taskId

# Child entities (nested under parent)
GET  /api/v1/tasks/:taskId/child/subtasks
POST /api/v1/tasks/:taskId/child/subtasks
GET  /api/v1/tasks/:taskId/child/subtasks/:subtaskId
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Configure Child Entities)
[2] What's the difference from many-to-many?
[3] Can a child have its own children?
```

---

## Step 2: Configure Child Entities

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Configure Child Entities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define child entities in your parent entity's
configuration file.
```

**📋 Parent Entity Config:**

```typescript
// entities/tasks/tasks.config.ts
import type { EntityConfig } from '@nextsparkjs/core/types/entity'

export const tasksConfig: EntityConfig = {
  name: 'tasks',
  displayName: 'entities.tasks.name',
  slug: 'tasks',

  // ... other config ...

  // Define child entities
  childEntities: [
    {
      name: 'subtasks',
      displayName: 'entities.subtasks.name',
      foreignKey: 'parentId',  // Column in child table
    },
    {
      name: 'comments',
      displayName: 'entities.comments.name',
      foreignKey: 'taskId',
    }
  ]
}
```

**📋 Child Entity Config:**

```typescript
// entities/subtasks/subtasks.config.ts
import type { EntityConfig } from '@nextsparkjs/core/types/entity'

export const subtasksConfig: EntityConfig = {
  name: 'subtasks',
  displayName: 'entities.subtasks.name',
  slug: 'subtasks',

  // Mark as child entity
  isChildEntity: true,
  parentEntity: 'tasks',
  parentForeignKey: 'parentId',

  // ... fields, schema, etc ...
}
```

**📋 Child Entity Fields:**

```typescript
// entities/subtasks/subtasks.fields.ts
export const subtasksFields: EntityField[] = [
  {
    name: 'parentId',
    type: 'relation',
    required: true,
    display: {
      label: 'Parent Task',
      showInForm: false,  // Auto-set from URL
      showInList: false,
    },
    relation: {
      entity: 'tasks',
      field: 'id'
    }
  },
  {
    name: 'title',
    type: 'text',
    required: true,
    display: {
      label: 'Subtask Title',
      showInList: true,
      showInForm: true,
    }
  },
  {
    name: 'completed',
    type: 'boolean',
    required: false,
    display: {
      label: 'Completed',
      showInList: true,
      showInForm: true,
    }
  }
]
```

**📋 ChildEntityDefinition Type:**

```typescript
interface ChildEntityDefinition {
  name: string           // Entity slug (e.g., 'subtasks')
  displayName: string    // i18n key for display
  foreignKey: string     // Column name in child table
  orderBy?: string       // Default sort column
  orderDirection?: 'asc' | 'desc'
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Database Structure)
[2] Can I have multiple child types?
[3] How do I hide the parent field?
```

---

## Step 3: Database Structure

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Database Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create the child entity table with proper
foreign key references.
```

**📋 Migration Example:**

```sql
-- migrations/xxx_subtasks_table.sql

-- Create subtasks table
CREATE TABLE subtasks (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign key to parent
  parentId    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Team context (inherited from parent conceptually)
  teamId      TEXT NOT NULL REFERENCES teams(id),

  -- Child-specific fields
  title       TEXT NOT NULL,
  description TEXT,
  completed   BOOLEAN DEFAULT false,
  "order"     INTEGER DEFAULT 0,

  -- Timestamps
  createdAt   TIMESTAMPTZ DEFAULT now(),
  updatedAt   TIMESTAMPTZ DEFAULT now(),
  deletedAt   TIMESTAMPTZ  -- Soft delete
);

-- Enable RLS
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Team members can access subtasks of tasks in their team
CREATE POLICY subtasks_team_policy ON subtasks
  FOR ALL
  USING (
    teamId IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_subtasks_parent_id ON subtasks(parentId);
CREATE INDEX idx_subtasks_team_id ON subtasks(teamId);
CREATE INDEX idx_subtasks_order ON subtasks("order");
```

**📋 Cascade Delete:**

```sql
-- ON DELETE CASCADE ensures:
-- When parent task is deleted, all subtasks are deleted

-- Alternative: ON DELETE SET NULL (if child can exist independently)
parentId TEXT REFERENCES tasks(id) ON DELETE SET NULL
```

**📋 Ordering Children:**

```sql
-- Add order column for manual sorting
"order" INTEGER DEFAULT 0

-- Or use createdAt for automatic ordering
-- API returns ORDER BY createdAt DESC by default
```

**📋 Sample Data Migration:**

```sql
-- migrations/xxx_subtasks_sample.sql

INSERT INTO subtasks (id, parentId, teamId, title, completed, "order")
SELECT
  'subtask-' || generate_series,
  (SELECT id FROM tasks WHERE title LIKE '%Sample%' LIMIT 1),
  (SELECT id FROM teams LIMIT 1),
  'Sample Subtask ' || generate_series,
  generate_series % 2 = 0,
  generate_series
FROM generate_series(1, 5);
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (API Pattern)
[2] What about soft delete for children?
[3] How do I inherit team from parent?
```

---

## Step 4: API Pattern

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: API Pattern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Child entities are accessed through nested
API endpoints under the parent.
```

**📋 API Endpoint Structure:**

```
# List child entities
GET /api/v1/[entity]/[id]/child/[childType]

# Create child entity
POST /api/v1/[entity]/[id]/child/[childType]

# Get single child
GET /api/v1/[entity]/[id]/child/[childType]/[childId]

# Update child
PATCH /api/v1/[entity]/[id]/child/[childType]/[childId]

# Delete child
DELETE /api/v1/[entity]/[id]/child/[childType]/[childId]
```

**📋 Route Handler Location:**

```
packages/core/src/routes/api/v1/[entity]/[id]/child/[childType]/
├── route.ts          # List and Create (GET, POST)
└── [childId]/
    └── route.ts      # Single item (GET, PATCH, DELETE)
```

**📋 List Children Example:**

```typescript
// GET /api/v1/tasks/task-123/child/subtasks

// Request
fetch('/api/v1/tasks/task-123/child/subtasks', {
  headers: { 'Authorization': 'Bearer ...' }
})

// Response
{
  "success": true,
  "data": [
    {
      "id": "subtask-1",
      "parentId": "task-123",
      "title": "First subtask",
      "completed": false,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "subtask-2",
      "parentId": "task-123",
      "title": "Second subtask",
      "completed": true,
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

**📋 Create Child Example:**

```typescript
// POST /api/v1/tasks/task-123/child/subtasks

// Request
fetch('/api/v1/tasks/task-123/child/subtasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'New subtask',
    completed: false
  })
  // Note: parentId is automatically set from URL
})

// Response
{
  "success": true,
  "data": {
    "id": "subtask-new",
    "parentId": "task-123",
    "title": "New subtask",
    "completed": false,
    "createdAt": "2024-01-15T12:00:00Z"
  }
}
```

**📋 API Handler Implementation:**

```typescript
// From packages/core/src/routes/api/v1/[entity]/[id]/child/[childType]/route.ts

export async function GET(request, { params }) {
  const { entity, id, childType } = params

  // 1. Resolve entity from URL
  const resolution = await resolveEntityFromUrl(pathname)

  // 2. Check if child entity exists
  const childEntities = getChildEntities(entity)
  const childEntity = childEntities.find(c => c.name === childType)

  if (!childEntity) {
    return createApiError('Child entity not found', 404)
  }

  // 3. Query child entities
  const children = await db.query(
    `SELECT * FROM "${childEntity.tableName}"
     WHERE "${childEntity.foreignKey}" = $1
     ORDER BY "createdAt" DESC`,
    [id]
  )

  return createApiResponse({ data: children })
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (UI Integration)
[2] How do I paginate children?
[3] Can I filter children?
```

---

## Step 5: UI Integration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: UI Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Display child entities in your parent entity's
detail view.
```

**📋 TanStack Query Pattern:**

```typescript
// hooks/useChildEntities.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useChildEntities(
  parentEntity: string,
  parentId: string,
  childType: string
) {
  return useQuery({
    queryKey: ['child', parentEntity, parentId, childType],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/${parentEntity}/${parentId}/child/${childType}`
      )
      const data = await response.json()
      return data.data
    },
    enabled: !!parentId
  })
}

export function useCreateChildEntity(
  parentEntity: string,
  parentId: string,
  childType: string
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(
        `/api/v1/${parentEntity}/${parentId}/child/${childType}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      )
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['child', parentEntity, parentId, childType]
      })
    }
  })
}
```

**📋 Child Entities Component:**

```typescript
// components/ChildEntitiesList.tsx
'use client'

import { useChildEntities, useCreateChildEntity } from '@/hooks/useChildEntities'

interface Props {
  parentEntity: string
  parentId: string
  childType: string
}

export function ChildEntitiesList({ parentEntity, parentId, childType }: Props) {
  const { data: children, isLoading } = useChildEntities(
    parentEntity, parentId, childType
  )
  const createMutation = useCreateChildEntity(
    parentEntity, parentId, childType
  )

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">
          {childType}
        </h3>
        <Button onClick={() => setShowForm(true)}>
          Add {childType}
        </Button>
      </div>

      <ul className="divide-y">
        {children?.map((child) => (
          <li key={child.id} className="py-2">
            {child.title}
          </li>
        ))}
      </ul>

      {children?.length === 0 && (
        <p className="text-muted-foreground">
          No {childType} yet
        </p>
      )}
    </div>
  )
}
```

**📋 In Parent Detail View:**

```typescript
// In task detail page
export default function TaskDetailPage({ params }) {
  const { id } = params

  return (
    <div className="space-y-8">
      {/* Parent task details */}
      <TaskDetails id={id} />

      {/* Child entities */}
      <ChildEntitiesList
        parentEntity="tasks"
        parentId={id}
        childType="subtasks"
      />

      <ChildEntitiesList
        parentEntity="tasks"
        parentId={id}
        childType="comments"
      />
    </div>
  )
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Parent-child entity relationships
• Entity configuration for children
• Database structure with foreign keys
• Nested API endpoints
• UI integration with TanStack Query

📚 Related tutorials:
   • /how-to:create-entity - Create the parent entity
   • /how-to:create-migrations - Database migrations
   • /how-to:add-metadata - Metadata for child entities

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "Can a child have its own children?"

```
📋 Multi-Level Nesting:

Yes, children can have their own children!

Example: Project → Task → Subtask → Checklist Item

However, keep in mind:

CONSIDERATIONS:
• API endpoints become longer
  /api/v1/projects/1/child/tasks/2/child/subtasks/3/child/items

• Query complexity increases
• Performance considerations

RECOMMENDATION:
• Limit to 2-3 levels of nesting
• For deeper hierarchies, consider:
  - Self-referential entities (parentId on same table)
  - Materialized path pattern
  - Nested set pattern

EXAMPLE: Self-referential
// comments table
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  parentCommentId TEXT REFERENCES comments(id),
  postId TEXT REFERENCES posts(id),
  content TEXT
);
```

### "How do I paginate children?"

```
📋 Child Entity Pagination:

Add query parameters to the child endpoint:

# Paginated request
GET /api/v1/tasks/task-123/child/subtasks?page=1&limit=10

# Implementation in route handler
const page = parseInt(searchParams.get('page') || '1')
const limit = parseInt(searchParams.get('limit') || '20')
const offset = (page - 1) * limit

const children = await db.query(`
  SELECT * FROM subtasks
  WHERE "parentId" = $1
  ORDER BY "createdAt" DESC
  LIMIT $2 OFFSET $3
`, [parentId, limit, offset])

const total = await db.query(`
  SELECT COUNT(*) FROM subtasks
  WHERE "parentId" = $1
`, [parentId])

return createApiResponse({
  data: children,
  meta: {
    page,
    limit,
    total: total[0].count,
    totalPages: Math.ceil(total[0].count / limit)
  }
})
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:create-entity` | Create parent entities |
| `/how-to:create-migrations` | Database migrations |
| `/how-to:add-metadata` | Add metadata to children |
| `/how-to:add-taxonomies` | Add tags to children |
