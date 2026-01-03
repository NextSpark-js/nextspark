---
title: Deduplication
description: Time-window deduplication to prevent duplicate scheduled actions
---

# Deduplication System

The deduplication system prevents duplicate scheduled actions within a configurable time window. This is essential for handling scenarios where the same event might trigger multiple times in quick succession.

## The Problem

Without deduplication, these scenarios create duplicate actions:

1. **Double Hook Fires:** A bug or race condition triggers the same hook twice
2. **Rapid Updates:** User updates an entity multiple times in quick succession
3. **Retry Logic:** External systems retry requests that already succeeded
4. **Network Issues:** Duplicate requests due to timeout retries

```
User clicks "Save" twice quickly
  ↓
Hook fires: task.updated (entityId: abc-123)
Hook fires: task.updated (entityId: abc-123)  ← Duplicate!
  ↓
Without deduplication: 2 webhook scheduled actions
With deduplication: 1 webhook scheduled action (with latest payload)
```

## How It Works

### Behavior

The deduplication system uses a **time-window** approach with **payload override**:

- When a duplicate is detected within the time window, the existing action's payload is **updated** with the new data
- This ensures the webhook always sends the **most recent** data when processed
- The action ID remains the same (the original one)

```
Timeline:
|──────────5 seconds──────────|

t=0: First action created     ← Created (id: uuid-123, payload: v1)
t=2: Second action attempted  ← Updated (id: uuid-123, payload: v2)
t=4: Third action attempted   ← Updated (id: uuid-123, payload: v3)
t=6: Fourth action attempted  ← Created (new action, outside window)
```

### Deduplication Key

The system uses a composite key to identify duplicates:

```
actionType + entityId + entityType
```

**Example:**
```typescript
// Both generate the same deduplication key → second updates the first
scheduleAction('webhook:send', {
  entityId: 'task-123',
  entityType: 'task',
  eventType: 'task:updated',
  data: { title: 'First Update' }
})

scheduleAction('webhook:send', {
  entityId: 'task-123',      // Same
  entityType: 'task',        // Same
  eventType: 'task:updated',
  data: { title: 'Second Update' }  // Updated payload!
})
// Result: 1 action with payload containing "Second Update"
```

### Race Condition Protection

The system uses **PostgreSQL advisory locks** to prevent race conditions when multiple concurrent requests try to schedule actions for the same entity:

```typescript
// Acquire transaction-level lock
await queryWithRLS(
  `SELECT pg_advisory_xact_lock(hashtext($1))`,
  [dedupKey],
  null
)

// Now safe to check and insert/update
```

**Benefits:**
- Lock is automatically released at transaction end
- No database schema changes required
- Works with the dynamic time window
- Prevents duplicate actions even under high concurrency

## Configuration

### Settings

```typescript
// app.config.ts
scheduledActions: {
  deduplication: {
    /** Time window in seconds. Set to 0 to disable. */
    windowSeconds: 5,
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `windowSeconds` | `5` | Seconds to look back for duplicates. Set to 0 to disable deduplication. |

### Disabling Deduplication

To track **all** changes without deduplication, set `windowSeconds: 0`:

```typescript
// Track every single change
deduplication: {
  windowSeconds: 0,  // Disabled - all actions created
}
```

Use this when:
- You need a complete audit trail of all changes
- Each change must trigger a separate webhook
- You're debugging and want to see all events

## Return Values

The `scheduleAction()` function returns:

```typescript
// New action created
const id = await scheduleAction('webhook:send', payload)
// id = 'uuid-123'

// Duplicate detected - existing action updated
const id = await scheduleAction('webhook:send', payload)
// id = 'uuid-123' (same as existing action)
```

**Note:** The function always returns a string (the action ID), whether it's a new action or an updated existing one.

## Implementation Details

### Database Query

The deduplication check uses this query:

```sql
SELECT id
FROM "scheduled_actions"
WHERE "actionType" = $1
  AND status = 'pending'
  AND payload->>'entityId' = $2
  AND payload->>'entityType' = $3
  AND "createdAt" > NOW() - INTERVAL '1 second' * $4
LIMIT 1
```

Key points:
- Only checks `pending` status (completed/failed don't count)
- Uses JSONB operators to extract payload fields
- Parameterized interval for safety

### Code Flow

```typescript
export async function scheduleAction(
  actionType: string,
  payload: unknown,
  options?: ScheduleOptions
): Promise<string | null> {
  const windowSeconds = APP_CONFIG_MERGED.scheduledActions?.deduplication?.windowSeconds ?? 5
  const entityId = payload?.entityId
  const entityType = payload?.entityType

  // Skip deduplication if:
  // - windowSeconds is 0 (disabled)
  // - No entityId in payload
  // - This is a recurring action
  const shouldDeduplicate = windowSeconds > 0 && entityId && !options?.recurringInterval

  if (shouldDeduplicate) {
    // Acquire advisory lock to prevent race conditions
    const dedupKey = `${actionType}:${entityId}:${entityType || ''}`
    await queryWithRLS(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [dedupKey],
      null
    )

    // Check for existing pending action within window
    const existing = await queryWithRLS(...)

    if (existing.length > 0) {
      // Update existing action's payload
      await mutateWithRLS(
        `UPDATE "scheduled_actions"
         SET payload = $1, "updatedAt" = NOW()
         WHERE id = $2 AND status = 'pending'`,
        [JSON.stringify(payload), existing[0].id],
        null
      )
      console.log(`[ScheduledActions] Duplicate detected, updated payload: ${existing[0].id}`)
      return existing[0].id
    }
  }

  // No duplicate found: create new action
  const actionId = crypto.randomUUID()
  // ... insert into database
  return actionId
}
```

## Best Practices

### 1. Choose the Right Window Size

```typescript
// Quick webhooks (Zapier, Slack)
windowSeconds: 5  // Short window

// Slow external APIs
windowSeconds: 30  // Longer window

// Testing/debugging
windowSeconds: 60  // Very long for manual testing

// Track all changes (audit trail)
windowSeconds: 0   // Disabled
```

### 2. Include entityId in Payload

Deduplication requires `entityId` in the payload:

```typescript
// ✅ Deduplication works
await scheduleAction('webhook:send', {
  entityId: 'task-123',  // Required for deduplication
  entityType: 'task',
  data: { ... }
})

// ❌ Cannot deduplicate (no entityId)
await scheduleAction('webhook:send', {
  message: 'Hello',
  data: { ... }
})
```

### 3. Test with Extended Window

For development/testing, use a longer window:

```typescript
// Testing config
deduplication: {
  windowSeconds: 30,  // 30 seconds for testing
}

// Production config
deduplication: {
  windowSeconds: 5,   // 5 seconds for production
}
```

## Monitoring Deduplication

### Console Logs

```
[ScheduledActions] Scheduled action 'webhook:send' with ID: uuid-123
[ScheduledActions] Duplicate detected, updated payload: uuid-123
```

### Tracking Deduplications

To track deduplication stats, check for repeated action IDs:

```typescript
const actionId = await scheduleAction('webhook:send', payload)

// Compare with expected new ID pattern
// If the ID matches an existing action, it was deduplicated
```

## Edge Cases

### Recurring Actions

Recurring actions **skip deduplication** entirely:

```typescript
// This ALWAYS creates a new action
await scheduleRecurringAction('billing:check', {}, 'daily')
```

**Reason:** Recurring actions are expected to execute multiple times.

### No entityId

Actions without `entityId` in payload **cannot be deduplicated**:

```typescript
// This creates a new action every time (no entityId)
await scheduleAction('system:cleanup', {
  type: 'cache',
  maxAge: 3600
})
```

### High Concurrency

With advisory locks, even high-concurrency scenarios are handled correctly:

```typescript
// Multiple concurrent requests for same entity
Promise.all([
  scheduleAction('webhook:send', { entityId: 'task-1', data: 'v1' }),
  scheduleAction('webhook:send', { entityId: 'task-1', data: 'v2' }),
  scheduleAction('webhook:send', { entityId: 'task-1', data: 'v3' }),
])
// Result: 1 action with the last payload to acquire the lock
```

## Troubleshooting

### Duplicates Still Appearing

1. **Check entityId:** Ensure payload includes `entityId`
2. **Check window:** May be too short for your use case
3. **Check status:** Only `pending` actions are checked
4. **Check timing:** Actions outside window aren't duplicates

### Actions Not Being Created

1. **False duplicates:** Different logical events with same `entityId`
2. **Window too long:** Reduce `windowSeconds`
3. **Check logs:** Look for "updated payload" message

### Need Full Change History

If you need to track every change:

1. Set `windowSeconds: 0` to disable deduplication
2. Consider a separate audit log table for complete history
3. Use the scheduled action as a trigger, not as the history store

## Related Documentation

- [Overview](./01-overview.md) - System introduction
- [Configuration](./02-configuration.md) - Config options
- [Action Handlers](./03-action-handlers.md) - Handler implementation

---

**Last Updated**: 2025-12-30
**Version**: 2.0.0
**Status**: Complete
