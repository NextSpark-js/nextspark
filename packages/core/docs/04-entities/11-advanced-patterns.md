# Advanced Patterns

This guide covers advanced patterns and complex use cases of the entity system, based on real project implementations.

## Multi-Tenancy with RLS

### User Isolation

The most common pattern is isolating data by user.

```typescript
// Entity Config
{
  access: {
    shared: false  // Each user sees only their data
  }
}
```

```sql
-- RLS Policy
CREATE POLICY "tasks_isolation" ON "tasks"
  FOR ALL
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());
```

**Use cases:** Personal tasks, user settings

### Shared Data by Workspace

Entities shared among all authenticated users.

```typescript
{
  access: {
    shared: true  // All users see all records
  }
}
```

```sql
-- RLS Policy
CREATE POLICY "categories_shared" ON "categories"
  FOR SELECT
  TO authenticated
  USING (true);
```

**Use cases:** Global categories, system settings

## Advanced Dynamic Metadata

### Metadata as Configuration

```typescript
// Store user preferences per entity
const task = {
  title: 'My Task',
  metas: {
    ui_color: '#FF5733',
    notification_enabled: 'true',
    custom_fields: JSON.stringify({
      department: 'Engineering',
      cost_center: 'CC-001'
    })
  }
}
```

### Metadata for Experimental Features

```typescript
// Feature flags per record
const product = {
  name: 'Product X',
  metas: {
    beta_feature_enabled: 'true',
    ai_suggestions: 'enabled',
    experiment_group: 'A'
  }
}
```

### Searching in Metadata

```sql
-- Search by specific metadata
SELECT t.* 
FROM "tasks" t
JOIN "tasks_metas" m ON t."id" = m."entityId"
WHERE m."metaKey" = 'department'
AND m."metaValue" = 'Engineering';

-- Search with multiple metas
SELECT t.*
FROM "tasks" t
WHERE EXISTS (
  SELECT 1 FROM "tasks_metas" m1
  WHERE m1."entityId" = t."id"
  AND m1."metaKey" = 'department'
  AND m1."metaValue" = 'Engineering'
)
AND EXISTS (
  SELECT 1 FROM "tasks_metas" m2
  WHERE m2."entityId" = t."id"
  AND m2."metaKey" = 'priority_score'
  AND (m2."metaValue")::integer > 80
);
```

## Hierarchies with Relations

### Parent-Child with Filtering

```typescript
// Client → Project → Task (3 levels)
{
  name: 'clientId',
  type: 'relation',
  relation: {
    entity: 'clients',
    titleField: 'name'
  }
},
{
  name: 'projectId',
  type: 'relation',
  relation: {
    entity: 'projects',
    titleField: 'name',
    parentId: 'clientId'  // Filter by selected client
  }
},
{
  name: 'taskId',
  type: 'relation',
  relation: {
    entity: 'tasks',
    titleField: 'title',
    parentId: 'projectId'  // Filter by selected project
  }
}
```

### Dynamic Prop Options

```typescript
// Dynamic client languages
{
  name: 'language',
  type: 'relation-prop',
  relation: {
    entity: 'clients',
    prop: 'contentLanguages',  // ['es', 'en', 'pt']
    parentId: 'clientId',
    options: [  // Fallback if client has no languages
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' }
    ]
  }
}
```

## Hooks for Complex Logic

### Auto-Calculations

```typescript
// Hook to calculate totals automatically
const calculateOrderTotal: HookFunction = async (context) => {
  const { data } = context
  
  if (!data.items) {
    return { continue: true }
  }
  
  // Calculate subtotal
  const subtotal = data.items.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  )
  
  // Apply discount
  const discount = data.discountPercent 
    ? subtotal * (data.discountPercent / 100)
    : 0
  
  // Calculate taxes
  const taxableAmount = subtotal - discount
  const tax = taxableAmount * 0.10  // 10% VAT
  
  // Final total
  const total = taxableAmount + tax
  
  return {
    continue: true,
    data: {
      ...data,
      subtotal,
      discount,
      tax,
      total
    }
  }
}

// In config
{
  hooks: {
    beforeCreate: [calculateOrderTotal],
    beforeUpdate: [calculateOrderTotal]
  }
}
```

### Bidirectional Sync

```typescript
// Hook for sync with external system
const syncWithJira: HookFunction = async (context) => {
  const { data, operation } = context
  
  try {
    if (operation === 'create') {
      // Create in Jira
      const jiraIssue = await jiraClient.createIssue({
        summary: data.title,
        description: data.description,
        priority: mapPriorityToJira(data.priority)
      })
      
      // Save Jira ID in metadata
      return {
        continue: true,
        data: {
          ...data,
          metas: {
            ...data.metas,
            jira_id: jiraIssue.key
          }
        }
      }
    }
    
    if (operation === 'update' && data.metas?.jira_id) {
      // Update in Jira
      await jiraClient.updateIssue(data.metas.jira_id, {
        summary: data.title,
        description: data.description
      })
    }
  } catch (error) {
    console.error('Jira sync failed:', error)
    // Don't fail local operation
  }
  
  return { continue: true }
}
```

### Workflow States

```typescript
// Hook to validate state transitions
const validateStatusTransition: HookFunction = async (context) => {
  const { data, metadata } = context
  const oldStatus = metadata?.existingData?.status
  const newStatus = data.status
  
  // Define valid transitions
  const validTransitions: Record<string, string[]> = {
    'draft': ['in-review', 'cancelled'],
    'in-review': ['approved', 'rejected', 'draft'],
    'approved': ['published', 'in-review'],
    'published': ['archived'],
    'rejected': ['draft'],
    'cancelled': ['draft'],
    'archived': []  // Cannot change from archived
  }
  
  // Validate transition
  if (oldStatus && newStatus !== oldStatus) {
    const allowed = validTransitions[oldStatus] || []
    
    if (!allowed.includes(newStatus)) {
      return {
        continue: false,
        error: `Cannot transition from "${oldStatus}" to "${newStatus}"`
      }
    }
  }
  
  return { continue: true }
}
```

## Complex Child Entities

### Automatic Aggregations

```typescript
// Hook to update parent totals when children change
const updateProjectTotals: HookFunction = async (context) => {
  const { data, metadata } = context
  
  if (metadata?.childType === 'task') {
    const parentId = data.parentId
    
    // Get all project tasks
    const tasks = await listChildEntities('projects', parentId, 'tasks')
    
    // Calculate metrics
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'done').length
    const progress = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0
    
    // Update project
    await updateEntity('projects', parentId, {
      taskCount: totalTasks,
      completedCount: completedTasks,
      progress
    })
  }
  
  return { continue: true }
}

// In project config
{
  hooks: {
    afterChildCreate: [updateProjectTotals],
    afterChildUpdate: [updateProjectTotals],
    afterChildDelete: [updateProjectTotals]
  }
}
```

### Custom Cascades

```typescript
// Hook to delete custom related data
const cleanupRelatedData: HookFunction = async (context) => {
  const { data, operation } = context
  
  if (operation === 'delete') {
    const projectId = data.id
    
    // Delete data in other systems
    await Promise.all([
      deleteProjectFiles(projectId),
      deleteProjectNotifications(projectId),
      removeProjectFromCache(projectId),
      notifyTeamMembers(projectId, 'deleted')
    ])
  }
  
  return { continue: true }
}
```

## Performance Optimization

### Query Optimization

```sql
-- Composite indexes for common queries
CREATE INDEX "idx_tasks_user_status" 
  ON "tasks"("userId", "status");

CREATE INDEX "idx_tasks_user_date" 
  ON "tasks"("userId", "dueDate") 
  WHERE "dueDate" IS NOT NULL;

-- Partial indexes for specific states
CREATE INDEX "idx_tasks_active" 
  ON "tasks"("userId", "createdAt") 
  WHERE "status" IN ('todo', 'in-progress');
```

### Eager Loading Relations

```typescript
// Load relations in a single query
const tasksWithRelations = await db.query(`
  SELECT 
    t.*,
    c.name as client_name,
    p.name as project_name,
    u.name as assigned_user_name,
    json_agg(tm.*) as metas
  FROM tasks t
  LEFT JOIN clients c ON t.clientId = c.id
  LEFT JOIN projects p ON t.projectId = p.id
  LEFT JOIN users u ON t.assignedTo = u.id
  LEFT JOIN tasks_metas tm ON t.id = tm.entityId
  WHERE t.userId = $1
  GROUP BY t.id, c.id, p.id, u.id
`, [userId])
```

### Caching Strategy

```typescript
// Cache entity configurations
const entityConfigCache = new Map<string, EntityConfig>()

function getEntityConfig(slug: string): EntityConfig {
  if (entityConfigCache.has(slug)) {
    return entityConfigCache.get(slug)!
  }
  
  const config = loadEntityConfig(slug)
  entityConfigCache.set(slug, config)
  return config
}

// Cache relation options per user
const relationOptionsCache = new Map<string, any[]>()

async function getRelationOptions(
  entityName: string,
  userId: string
): Promise<any[]> {
  const cacheKey = `${entityName}:${userId}`
  
  if (relationOptionsCache.has(cacheKey)) {
    return relationOptionsCache.get(cacheKey)!
  }
  
  const options = await loadRelationOptions(entityName, userId)
  relationOptionsCache.set(cacheKey, options)
  
  // Invalidate cache after 5 minutes
  setTimeout(() => {
    relationOptionsCache.delete(cacheKey)
  }, 5 * 60 * 1000)
  
  return options
}
```

## Audit Trail

### Change Tracking

```typescript
// Hook to log all changes
const auditChanges: HookFunction = async (context) => {
  const { entityName, operation, data, userId, metadata } = context
  
  const auditEntry = {
    entityName,
    entityId: data.id,
    operation,
    userId,
    changes: metadata?.changes || {},
    oldData: metadata?.existingData,
    newData: data,
    timestamp: new Date(),
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent
  }
  
  await createAuditLog(auditEntry)
  
  return { continue: true }
}

// On all critical entities
{
  hooks: {
    afterCreate: [auditChanges],
    afterUpdate: [auditChanges],
    afterDelete: [auditChanges]
  }
}
```

### Soft Delete

```typescript
// Instead of deleting, mark as deleted
const softDelete: HookFunction = async (context) => {
  const { data, operation } = context
  
  if (operation === 'delete') {
    // Instead of deleting, update
    await updateEntity(context.entityName, data.id, {
      deletedAt: new Date(),
      deletedBy: context.userId
    })
    
    // Cancel the real delete
    return {
      continue: false,
      data: { ...data, deletedAt: new Date() }
    }
  }
  
  return { continue: true }
}
```

## External Integrations

### Outgoing Webhooks

```typescript
// Hook to send webhooks
const sendWebhook: HookFunction = async (context) => {
  const { entityName, operation, data } = context
  
  // Get webhooks configured for this event
  const webhooks = await getWebhooksFor(entityName, operation)
  
  // Send to each webhook
  await Promise.allSettled(
    webhooks.map(webhook => 
      fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(data, webhook.secret)
        },
        body: JSON.stringify({
          event: `${entityName}.${operation}`,
          data,
          timestamp: new Date().toISOString()
        })
      })
    )
  )
  
  return { continue: true }
}
```

## Next Steps

1. **[Examples](./12-examples.md)** - Complete examples implementing these patterns
2. **[Testing](../12-testing/01-overview.md)** - Testing advanced patterns
3. **[Performance](../13-performance/01-optimization.md)** - Advanced optimization

---

> 💡 **Tip**: These patterns are used in production in the project. Check existing entities in `contents/themes/default/entities/` for real implementations.
