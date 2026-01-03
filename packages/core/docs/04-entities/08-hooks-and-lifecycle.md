# Hooks and Lifecycle

The hook system allows extending entity behavior without modifying core code. Inspired by WordPress, it provides extension points at each CRUD operation.

## What are Hooks?

Hooks are functions that execute automatically at specific moments in an entity's lifecycle:
- **before hooks**: Execute BEFORE the operation (can modify data or cancel it)
- **after hooks**: Execute AFTER the operation (for side effects)
- **event hooks**: Execute on specific events (limits, flags, etc.)

## Available Hook Types

### CRUD Hooks

```typescript
interface EntityHooks {
  // Create
  beforeCreate?: HookFunction[]    // Before creating
  afterCreate?: HookFunction[]     // After creating
  
  // Update
  beforeUpdate?: HookFunction[]    // Before updating
  afterUpdate?: HookFunction[]     // After updating
  
  // Delete
  beforeDelete?: HookFunction[]    // Before deleting
  afterDelete?: HookFunction[]     // After deleting
  
  // Query
  beforeQuery?: HookFunction[]     // Before querying
  afterQuery?: HookFunction[]      // After querying
}
```

### Plan & Flag Hooks

```typescript
interface EntityHooks {
  onPlanLimitReached?: HookFunction[]      // Plan limit reached
  onPlanUpgradeRequired?: HookFunction[]   // Upgrade required
  onFlagConflict?: HookFunction[]          // Flag conflict
  onFlagAccessGranted?: HookFunction[]     // Access granted
  onFlagAccessDenied?: HookFunction[]      // Access denied
}
```

### Child Entity Hooks

```typescript
interface EntityHooks {
  beforeChildCreate?: HookFunction[]       // Before creating child
  afterChildCreate?: HookFunction[]        // After creating child
  beforeChildUpdate?: HookFunction[]       // Before updating child
  afterChildUpdate?: HookFunction[]        // After updating child
  beforeChildDelete?: HookFunction[]       // Before deleting child
  afterChildDelete?: HookFunction[]        // After deleting child
  onChildValidation?: HookFunction[]       // Child validation
}
```

## HookFunction Structure

```typescript
type HookFunction = (context: HookContext) => Promise<HookResult>

interface HookContext {
  entityName: string                // Entity name
  operation: CRUDOperation         // 'create' | 'read' | 'update' | 'delete'
  data: unknown                    // Operation data
  userId?: string                  // User ID
  metadata?: Record<string, unknown> // Additional metadata
}

interface HookResult {
  continue: boolean                // Continue with operation?
  data?: unknown                   // Modified data
  error?: string                   // Error message
}
```

## Hook Configuration

### In EntityConfig

```typescript
export const taskEntityConfig: EntityConfig = {
  slug: 'tasks',
  // ... other configurations
  
  hooks: {
    beforeCreate: [validateTaskData, setDefaultValues],
    afterCreate: [sendNotification, updateStatistics],
    beforeUpdate: [checkPermissions, validateChanges],
    afterUpdate: [logChanges, syncToExternal],
    beforeDelete: [confirmDeletion],
    afterDelete: [cleanupRelated, notifyUsers]
  }
}
```

## Practical Examples

### 1. Custom Validation

```typescript
// hooks/validateTaskData.ts
import type { HookContext, HookResult } from '@/core/lib/entities/types'

export async function validateTaskData(context: HookContext): Promise<HookResult> {
  const { data } = context
  
  // Custom validation
  if (data.priority === 'urgent' && !data.assignedTo) {
    return {
      continue: false,
      error: 'Urgent tasks must have an assignee'
    }
  }
  
  if (data.dueDate && new Date(data.dueDate) < new Date()) {
    return {
      continue: false,
      error: 'Due date cannot be in the past'
    }
  }
  
  return { continue: true }
}
```

### 2. Default Values

```typescript
// hooks/setDefaultValues.ts
export async function setDefaultValues(context: HookContext): Promise<HookResult> {
  const { data, userId } = context
  
  // Add calculated values
  const modifiedData = {
    ...data,
    createdBy: userId,
    status: data.status || 'todo',
    priority: data.priority || 'medium',
    taskNumber: await generateTaskNumber()
  }
  
  return {
    continue: true,
    data: modifiedData
  }
}

async function generateTaskNumber(): Promise<string> {
  const count = await getTaskCount()
  return `TASK-${String(count + 1).padStart(6, '0')}`
}
```

### 3. Notifications

```typescript
// hooks/sendNotification.ts
export async function sendNotification(context: HookContext): Promise<HookResult> {
  const { data, operation } = context
  
  if (operation === 'create' && data.assignedTo) {
    await sendEmail({
      to: data.assignedTo,
      subject: 'New Task Assigned',
      body: `You have been assigned: ${data.title}`
    })
  }
  
  return { continue: true }
}
```

### 4. Logging

```typescript
// hooks/logChanges.ts
export async function logChanges(context: HookContext): Promise<HookResult> {
  const { entityName, operation, data, userId } = context
  
  await createAuditLog({
    entity: entityName,
    operation,
    userId,
    data,
    timestamp: new Date()
  })
  
  return { continue: true }
}
```

### 5. External Sync

```typescript
// hooks/syncToExternal.ts
export async function syncToExternal(context: HookContext): Promise<HookResult> {
  const { data } = context
  
  try {
    // Sync with external system (e.g., Jira, Salesforce)
    await fetch('https://external-api.com/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EXTERNAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
  } catch (error) {
    console.error('External sync failed:', error)
    // Don't fail operation if sync fails
  }
  
  return { continue: true }
}
```

### 6. Automatic Calculations

```typescript
// hooks/calculateTotalPrice.ts
export async function calculateTotalPrice(context: HookContext): Promise<HookResult> {
  const { data } = context
  
  // Calculate item subtotals
  const items = data.items || []
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  
  // Add taxes
  const tax = subtotal * 0.10  // 10% tax
  const total = subtotal + tax
  
  const modifiedData = {
    ...data,
    subtotal,
    tax,
    total
  }
  
  return {
    continue: true,
    data: modifiedData
  }
}
```

## Hook Priorities

Hooks execute in priority order:

```typescript
enum HookPriority {
  CRITICAL = 1,    // Executes first
  HIGH = 5,
  NORMAL = 10,     // Default
  LOW = 15,
  CLEANUP = 20     // Executes last
}

// Use with EntityHookManager
hookManager.registerHook(
  'tasks',
  'beforeCreate',
  validateTaskData,
  HookPriority.CRITICAL  // Executes before others
)
```

## Error Handling

### Cancel Operation

```typescript
export async function checkBusinessRules(context: HookContext): Promise<HookResult> {
  const { data } = context
  
  if (!meetsBusinessRules(data)) {
    return {
      continue: false,  // CANCELS the operation
      error: 'Business rules not met'
    }
  }
  
  return { continue: true }
}
```

### Error in Optional Hook

```typescript
export async function optionalSync(context: HookContext): Promise<HookResult> {
  try {
    await syncData(context.data)
  } catch (error) {
    // Log error but continue
    console.error('Sync failed:', error)
  }
  
  return { continue: true }  // Continue even if it fails
}
```

## Hooks for Child Entities

```typescript
export const projectEntityConfig: EntityConfig = {
  slug: 'projects',
  // ...
  
  hooks: {
    afterChildCreate: [
      async (context) => {
        if (context.metadata?.childType === 'task') {
          // A task was created in the project
          await updateProjectProgress(context.data.parentId)
          await notifyProjectOwner(context.data.parentId)
        }
        return { continue: true }
      }
    ],
    
    afterChildDelete: [
      async (context) => {
        if (context.metadata?.childType === 'task') {
          // A task was deleted from the project
          await recalculateProjectMetrics(context.data.parentId)
        }
        return { continue: true }
      }
    ]
  }
}
```

## Global Hooks (Plugin System)

Besides entity-specific hooks, you can register global hooks for all entities:

```typescript
// In a plugin
import { getGlobalHooks } from '@/core/lib/plugins/hook-system'

const hooks = getGlobalHooks()

// Global hook for all entities
hooks.addFilter('entity.*.before_create', async (data) => {
  // Executes for ANY entity before creating
  console.log(`Creating ${data.entityName}`)
  return data
})

// Specific hook for tasks
hooks.addAction('entity.tasks.created', async (data) => {
  // Executes after creating a task
  await sendSlackNotification(`New task: ${data.data.title}`)
})
```

## Testing Hooks

```typescript
// test/hooks/validateTaskData.test.ts
import { validateTaskData } from '@/hooks/validateTaskData'

describe('validateTaskData', () => {
  it('should reject urgent tasks without assignee', async () => {
    const context = {
      entityName: 'tasks',
      operation: 'create',
      data: {
        priority: 'urgent',
        assignedTo: null
      }
    }
    
    const result = await validateTaskData(context)
    
    expect(result.continue).toBe(false)
    expect(result.error).toContain('must have an assignee')
  })
  
  it('should allow valid tasks', async () => {
    const context = {
      entityName: 'tasks',
      operation: 'create',
      data: {
        priority: 'medium',
        title: 'Valid task'
      }
    }
    
    const result = await validateTaskData(context)
    
    expect(result.continue).toBe(true)
  })
})
```

## Performance

### Optimization Tips

1. **Async hooks**: Use `async/await` correctly
2. **Avoid heavy operations**: In critical hooks (`before*`)
3. **Use cache**: For frequent data
4. **Priorities**: Critical hooks first
5. **Error handling**: Don't fail operations due to optional hooks

```typescript
// ✅ Good: Fast and efficient
export async function fastHook(context: HookContext): Promise<HookResult> {
  const data = await cache.get(context.data.id)
  return { continue: true, data }
}

// ❌ Bad: Heavy operation in critical hook
export async function slowHook(context: HookContext): Promise<HookResult> {
  // Sending email blocks creation
  await sendEmail(context.data)  // SLOW!
  return { continue: true }
}

// ✅ Better: Heavy operation async (doesn't block)
export async function betterHook(context: HookContext): Promise<HookResult> {
  // Queue email for later
  await queueEmail(context.data)  // Fast
  return { continue: true }
}
```

## Common Use Cases

### E-commerce

```typescript
{
  hooks: {
    beforeCreate: [validateStock, checkCouponCode],
    afterCreate: [reserveStock, sendOrderConfirmation, notifyWarehouse],
    beforeUpdate: [validateStatusChange],
    afterUpdate: [updateInventory, sendStatusEmail]
  }
}
```

### CRM

```typescript
{
  hooks: {
    beforeCreate: [validateLeadData, checkDuplicates],
    afterCreate: [assignToSalesRep, syncToCRM, scheduleFollowUp],
    afterUpdate: [logActivity, updatePipeline, notifyTeam]
  }
}
```

### Project Management

```typescript
{
  hooks: {
    beforeCreate: [validateTaskDependencies],
    afterCreate: [notifyAssignee, updateProjectTimeline],
    beforeUpdate: [checkCompletion],
    afterUpdate: [recalculateProgress, updateGanttChart]
  }
}
```

## Scheduling Webhooks from Hooks

Use the **Scheduled Actions** system to defer webhook delivery and external notifications:

```typescript
import { scheduleAction } from '@/core/lib/scheduled-actions'
import { hookSystem } from '@/core/lib/plugins/hook-system'

// Schedule webhook when entity is created
hookSystem.register('entity.tasks.created', async ({ entity, teamId }) => {
  await scheduleAction('webhook:send', {
    eventType: 'task:created',
    entityType: 'task',
    entityId: entity.id,
    data: entity
  }, { teamId })
})
```

**Benefits:**
- Deferred execution (doesn't block the request)
- Automatic deduplication (prevents double-fire bugs)
- Multi-endpoint routing based on event patterns
- Automatic retry on failure

**See:** [Scheduled Actions - Webhooks](../20-scheduled-actions/04-webhooks.md)

## Next Steps

1. **[Validation](./10-validation.md)** - Validation system
2. **[Advanced Patterns](./11-advanced-patterns.md)** - Advanced patterns with hooks
3. **[Examples](./12-examples.md)** - Complete examples with hooks
4. **[Scheduled Actions](../20-scheduled-actions/01-overview.md)** - Background task processing with webhooks

---

> 💡 **Tip**: `before*` hooks can modify data and cancel operations. `after*` hooks are for side effects and shouldn't fail the main operation.
