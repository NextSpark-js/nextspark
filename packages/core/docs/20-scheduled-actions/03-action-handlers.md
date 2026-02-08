---
title: Action Handlers
description: Creating and registering custom scheduled action handlers
---

# Action Handlers

Action handlers implement the business logic for scheduled actions. Each handler processes a specific action type when triggered by the processor.

## Handler Structure

### Basic Handler

```typescript
// contents/themes/default/lib/scheduled-actions/handlers/my-handler.ts
import { registerScheduledAction } from '@/core/lib/scheduled-actions'

export function registerMyAction() {
  registerScheduledAction('my-action:type', async (payload) => {
    // Your logic here
    console.log('Processing:', payload)
    // Return nothing on success. Throw to fail.
  }, {
    description: 'My custom action',
    timeout: 30000  // 30 seconds (optional)
  })
}
```

### Handler Function Signature

```typescript
type ScheduledActionHandler = (
  payload: unknown,
  action: ScheduledAction
) => Promise<void>
```

Handlers return `Promise<void>`. On success, simply return. On failure, **throw an error** — the processor will catch it and handle retries automatically.

### ScheduledAction Interface

The `action` parameter gives access to the full database record:

```typescript
interface ScheduledAction {
  id: string
  actionType: string
  status: ScheduledActionStatus  // 'pending' | 'running' | 'completed' | 'failed'
  payload: unknown
  teamId: string | null
  scheduledAt: Date
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  attempts: number              // Current attempt count
  maxRetries: number            // Max attempts before marking failed (default: 3)
  recurringInterval: string | null
  recurrenceType: 'fixed' | 'rolling' | null
  lockGroup: string | null
  createdAt: Date
  updatedAt: Date
}
```

### Registration Options

```typescript
registerScheduledAction(name, handler, {
  description?: string   // Human-readable description
  timeout?: number       // Timeout in ms (overrides config defaultTimeout)
})
```

**Timeout priority:** handler timeout > config `defaultTimeout` > 30000ms fallback.

## Built-in Handlers

### Webhook Handler

The webhook handler sends HTTP POST requests to configured endpoints:

```typescript
// core/lib/scheduled-actions/handlers/webhook.ts
registerScheduledAction('webhook:send', async (payload) => {
  const { eventType, entityType, entityId, data, webhookKey } = payload as WebhookPayload

  // Find matching endpoint from config
  const endpoint = findMatchingEndpoint(eventType, webhookKey)

  if (!endpoint) {
    throw new Error(`No webhook endpoint found for event: ${eventType}`)
  }

  const url = process.env[endpoint.envVar]
  if (!url) {
    throw new Error(`Webhook URL not configured: ${endpoint.envVar}`)
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: eventType,
      entity: entityType,
      entityId,
      data,
      timestamp: new Date().toISOString()
    })
  })

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
  }
}, { description: 'Send webhook notification' })
```

## Creating Custom Handlers

### Step 1: Create Handler File

```typescript
// contents/themes/default/lib/scheduled-actions/handlers/email.ts
import { registerScheduledAction } from '@/core/lib/scheduled-actions'

interface EmailPayload {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
}

export function registerEmailHandler() {
  registerScheduledAction('email:send', async (payload, action) => {
    const { to, subject, template, data } = payload as EmailPayload

    // Send email using your email service
    // Throw on failure — processor handles retries automatically
    await sendEmail({ to, subject, template, data })

    console.log(`[ScheduledActions] Email sent to ${to} (action: ${action.id})`)
  }, {
    description: 'Send email notification',
    timeout: 15000  // 15 seconds
  })
}
```

### Step 2: Register in Theme Index

```typescript
// contents/themes/default/lib/scheduled-actions/index.ts
import { registerEmailHandler } from './handlers/email'
import { registerWebhookAction } from './handlers/webhook'

/**
 * Register all handlers for this theme.
 * Called by core/lib/scheduled-actions/initializer.ts
 * The initialization guard is handled in the core.
 */
export function registerAllHandlers(): void {
  registerWebhookAction()
  registerEmailHandler()  // Add your handler
}
```

> **Note:** The core initializer (`initializeScheduledActions()`) handles the guard
> to prevent double registration. Theme only exports registration functions.

### Step 3: Schedule Actions

```typescript
import { scheduleAction } from '@/core/lib/scheduled-actions'

// Immediate
await scheduleAction('email:send', {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
  data: { name: 'John' }
})

// Delayed with options
await scheduleAction('email:send', {
  to: 'user@example.com',
  subject: 'Reminder',
  template: 'reminder',
  data: { taskName: 'Complete profile' }
}, {
  scheduledAt: new Date(Date.now() + 86400000), // 24 hours
  maxRetries: 5,                                // 5 total attempts
  lockGroup: 'email:user@example.com'           // Sequential per recipient
})
```

## Action Registry

The registry maps action types to handler definitions:

```typescript
// core/lib/scheduled-actions/registry.ts
const actionRegistry = new Map<string, ScheduledActionDefinition>()

export function registerScheduledAction(
  name: string,
  handler: ScheduledActionHandler,
  options?: { description?: string; timeout?: number }
): void {
  if (actionRegistry.has(name)) {
    console.warn(`[ScheduledActions] Action '${name}' is already registered. Overwriting.`)
  }
  actionRegistry.set(name, { name, handler, ...options })
}

export function getActionHandler(name: string): ScheduledActionDefinition | undefined
export function getAllRegisteredActions(): string[]
export function isActionRegistered(name: string): boolean
export function clearActionRegistry(): void  // For testing
```

**Important:** Duplicate registrations **overwrite** the existing handler (with a warning). This is intentional — it allows the cron endpoint's safety net to re-register handlers after server restarts without issues.

## Integrating with Entity Hooks

Schedule actions from entity lifecycle hooks:

```typescript
// contents/themes/default/lib/scheduled-actions/entity-hooks.ts
import { scheduleAction } from '@/core/lib/scheduled-actions'
import { hookSystem } from '@/core/lib/plugins/hook-system'

export function registerEntityWebhookHooks() {
  // Task created webhook
  hookSystem.register('entity.tasks.created', async ({ entity, teamId }) => {
    await scheduleAction('webhook:send', {
      eventType: 'task:created',
      entityType: 'task',
      entityId: entity.id,
      data: entity
    }, { teamId })
  })

  // Task updated webhook
  hookSystem.register('entity.tasks.updated', async ({ entity, changes, teamId }) => {
    await scheduleAction('webhook:send', {
      eventType: 'task:updated',
      entityType: 'task',
      entityId: entity.id,
      data: { ...entity, changes }
    }, { teamId })
  })

  // Task deleted webhook
  hookSystem.register('entity.tasks.deleted', async ({ id, teamId }) => {
    await scheduleAction('webhook:send', {
      eventType: 'task:deleted',
      entityType: 'task',
      entityId: id,
      data: { deletedAt: new Date().toISOString() }
    }, { teamId })
  })
}
```

## Error Handling

### Throw to Fail

Handlers signal failure by **throwing an error**. The processor catches it and manages the retry lifecycle:

```typescript
registerScheduledAction('risky:action', async (payload) => {
  const result = await performRiskyOperation(payload)

  if (!result.ok) {
    // Throwing triggers retry logic (if attempts < maxRetries)
    throw new Error(`Operation failed: ${result.reason}`)
  }

  // Returning without throwing = success
}, { description: 'Risky operation with retries' })
```

### Automatic Retry with Linear Backoff

The processor automatically retries failed actions based on `maxRetries`:

```text
maxRetries = 3 (default):
  Attempt 1: immediate execution
  Attempt 2: +5 minutes (if attempt 1 failed)
  Attempt 3: +10 minutes (if attempt 2 failed)
  After 3rd failure: marked as 'failed' permanently

Backoff formula: attempts * 5 minutes
```

Configure retries when scheduling:

```typescript
// Critical operation: allow more retries
await scheduleAction('payment:process', payload, {
  maxRetries: 5  // 5 total attempts
})

// Fire-and-forget: no retries
await scheduleAction('analytics:track', payload, {
  maxRetries: 1  // 1 attempt only, fail immediately
})
```

### Automatic Timeout Protection

The processor wraps every handler execution with a timeout. You do **not** need to implement timeout logic in your handler:

```typescript
// Handler timeout is set at registration time
registerScheduledAction('slow:api-call', async (payload) => {
  // If this takes longer than 60 seconds, the processor
  // will abort it and throw a timeout error automatically
  await callSlowExternalAPI(payload)
}, {
  timeout: 60000  // 60 seconds
})
```

## Testing Handlers

### Unit Testing

```typescript
// __tests__/handlers/email.test.ts
import { registerEmailHandler } from '../handlers/email'
import { getActionHandler } from '@/core/lib/scheduled-actions/registry'

describe('Email Handler', () => {
  beforeAll(() => {
    registerEmailHandler()
  })

  it('should send email successfully', async () => {
    const actionDef = getActionHandler('email:send')
    expect(actionDef).toBeDefined()

    // Handler returns void on success (no throw = success)
    await expect(
      actionDef!.handler(
        { to: 'test@example.com', subject: 'Test', template: 'test', data: {} },
        mockAction
      )
    ).resolves.toBeUndefined()
  })

  it('should throw on failure', async () => {
    const actionDef = getActionHandler('email:send')

    // Handler throws on failure
    await expect(
      actionDef!.handler(
        { to: 'invalid', subject: '', template: '', data: {} },
        mockAction
      )
    ).rejects.toThrow()
  })
})
```

### Integration Testing

```typescript
// Create action and process via cron endpoint
await scheduleAction('email:send', payload)

const response = await fetch('/api/v1/cron/process', {
  headers: { 'x-cron-secret': CRON_SECRET }
})

const result = await response.json()
expect(result.succeeded).toBeGreaterThan(0)
```

## Best Practices

### 1. Keep Handlers Idempotent

```typescript
// Idempotent - safe to retry
registerScheduledAction('order:process', async (payload) => {
  const order = await getOrder((payload as any).orderId)

  if (order.status === 'processed') {
    // Already done, return successfully
    return
  }

  await processOrder(order)
})
```

### 2. Use Structured Payloads

```typescript
interface EmailPayload {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
}

registerScheduledAction('email:send', async (payload) => {
  const { to, subject, template, data } = payload as EmailPayload
  // ...
})
```

### 3. Log Important Events

```typescript
registerScheduledAction('important:action', async (payload, action) => {
  console.log(`[ScheduledActions] Processing ${action.id}`, {
    type: action.actionType,
    attempt: action.attempts,
    lockGroup: action.lockGroup
  })

  await process(payload)

  console.log(`[ScheduledActions] Completed ${action.id}`)
})
```

### 4. Use Lock Groups for Resource Safety

```typescript
// Prevent concurrent operations on the same content
registerScheduledAction('content:publish', async (payload, action) => {
  await publishContent((payload as any).contentId)
})

// When scheduling, set the lockGroup
await scheduleAction('content:publish', { contentId: 'abc' }, {
  lockGroup: 'content:abc'  // Sequential per content item
})
```

## Related Documentation

- [Overview](./01-overview.md) - System introduction
- [Configuration](./02-configuration.md) - Config options
- [API Reference](./05-api-reference.md) - Endpoints
- [Entity Hooks](../04-entities/08-hooks-and-lifecycle.md) - Triggering actions from hooks

---

**Last Updated**: 2026-02-06
**Version**: 2.0.0
**Status**: Complete
