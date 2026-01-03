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

    // Return result
    return {
      success: true,
      message: 'Action completed'
    }
  })
}
```

### Handler Function Signature

```typescript
type ActionHandler = (
  payload: unknown,
  action: ScheduledAction
) => Promise<ActionResult>

interface ActionResult {
  success: boolean
  message?: string
  data?: unknown
}

interface ScheduledAction {
  id: string
  actionType: string
  status: string
  payload: unknown
  teamId: string | null
  scheduledAt: Date
  recurringInterval: string | null
}
```

## Built-in Handlers

### Webhook Handler

The webhook handler sends HTTP POST requests to configured endpoints:

```typescript
// core/lib/scheduled-actions/handlers/webhook.ts
registerScheduledAction('webhook:send', async (payload) => {
  const { eventType, entityType, entityId, data, webhookKey } = payload

  // Find matching endpoint
  const endpoint = findMatchingEndpoint(eventType, webhookKey)

  // Send webhook
  const response = await fetch(endpoint.url, {
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

  return {
    success: response.ok,
    message: `Webhook sent with status ${response.status}`
  }
})
```

### Billing Handler

Handles subscription lifecycle operations:

```typescript
// contents/themes/default/lib/scheduled-actions/handlers/billing.ts
registerScheduledAction('billing:check-renewals', async () => {
  const dueSubscriptions = await findDueRenewals()

  for (const sub of dueSubscriptions) {
    await processRenewal(sub)
  }

  return {
    success: true,
    data: { processed: dueSubscriptions.length }
  }
})
```

## Creating Custom Handlers

### Step 1: Create Handler File

```typescript
// contents/themes/default/lib/scheduled-actions/handlers/email.ts
import { registerScheduledAction } from '@/core/lib/scheduled-actions'

export function registerEmailHandler() {
  registerScheduledAction('email:send', async (payload, action) => {
    const { to, subject, template, data } = payload as {
      to: string
      subject: string
      template: string
      data: Record<string, unknown>
    }

    try {
      // Send email using your email service
      await sendEmail({
        to,
        subject,
        template,
        data
      })

      return {
        success: true,
        message: `Email sent to ${to}`
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to send email: ${error.message}`
      }
    }
  })
}
```

### Step 2: Register in Theme Index

```typescript
// contents/themes/default/lib/scheduled-actions/index.ts
import { registerEmailHandler } from './handlers/email'
import { registerWebhookAction } from './handlers/webhook'
import { registerBillingAction } from './handlers/billing'

/**
 * Register all handlers for this theme.
 * Called by core/lib/scheduled-actions/initializer.ts
 * The initialization guard is handled in the core.
 */
export function registerAllHandlers(): void {
  registerWebhookAction()
  registerBillingAction()
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

// Delayed
await scheduleAction('email:send', {
  to: 'user@example.com',
  subject: 'Reminder',
  template: 'reminder',
  data: { taskName: 'Complete profile' }
}, {
  scheduledAt: new Date(Date.now() + 86400000) // 24 hours
})
```

## Action Registry

The registry maps action types to handlers:

```typescript
// core/lib/scheduled-actions/registry.ts
const handlers = new Map<string, ActionHandler>()

export function registerScheduledAction(actionType: string, handler: ActionHandler) {
  if (handlers.has(actionType)) {
    console.warn(`Handler for '${actionType}' already registered`)
    return
  }
  handlers.set(actionType, handler)
}

export function getHandler(actionType: string): ActionHandler | undefined {
  return handlers.get(actionType)
}

export function listHandlers(): string[] {
  return Array.from(handlers.keys())
}
```

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

### Handler Errors

```typescript
registerScheduledAction('risky:action', async (payload) => {
  try {
    const result = await performRiskyOperation(payload)
    return { success: true, data: result }
  } catch (error) {
    // Log for debugging
    console.error('[ScheduledActions] risky:action failed:', error)

    // Return failure (action will be marked as 'failed')
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
```

### Retry Logic

Failed actions can be retried by the processor if configured:

```typescript
// The processor handles retries automatically
// Actions with retryCount < maxRetries will be re-queued

// Custom retry logic in handler
registerScheduledAction('retryable:action', async (payload, action) => {
  const maxAttempts = 3

  if (action.retryCount >= maxAttempts) {
    return {
      success: false,
      message: `Max retries (${maxAttempts}) exceeded`
    }
  }

  try {
    await performAction(payload)
    return { success: true }
  } catch (error) {
    // Let processor retry
    throw error
  }
})
```

## Testing Handlers

### Unit Testing

```typescript
// __tests__/handlers/email.test.ts
import { registerEmailHandler } from '../handlers/email'
import { getHandler } from '@/core/lib/scheduled-actions/registry'

describe('Email Handler', () => {
  beforeAll(() => {
    registerEmailHandler()
  })

  it('should send email successfully', async () => {
    const handler = getHandler('email:send')

    const result = await handler({
      to: 'test@example.com',
      subject: 'Test',
      template: 'test',
      data: {}
    }, mockAction)

    expect(result.success).toBe(true)
  })
})
```

### Integration Testing

```typescript
// Create action and process
await scheduleAction('email:send', payload)

// Trigger processor
const response = await fetch('/api/v1/cron/process', {
  headers: { 'x-cron-secret': CRON_SECRET }
})

// Verify action completed
const actions = await getScheduledActions({ status: 'completed' })
expect(actions).toHaveLength(1)
```

## Best Practices

### 1. Keep Handlers Idempotent

```typescript
// ✅ Idempotent - can safely retry
registerScheduledAction('order:process', async (payload) => {
  const order = await getOrder(payload.orderId)

  if (order.status === 'processed') {
    return { success: true, message: 'Already processed' }
  }

  await processOrder(order)
  return { success: true }
})
```

### 2. Use Structured Payloads

```typescript
// Define payload types
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
    scheduledAt: action.scheduledAt
  })

  const result = await process(payload)

  console.log(`[ScheduledActions] Completed ${action.id}`, {
    success: result.success
  })

  return result
})
```

### 4. Set Reasonable Timeouts

```typescript
registerScheduledAction('slow:action', async (payload) => {
  // Use AbortController for timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const result = await fetch(url, { signal: controller.signal })
    return { success: true, data: await result.json() }
  } finally {
    clearTimeout(timeout)
  }
})
```

## Related Documentation

- [Overview](./01-overview.md) - System introduction
- [Configuration](./02-configuration.md) - Config options
- [API Reference](./05-api-reference.md) - Endpoints
- [Entity Hooks](../04-entities/08-hooks-and-lifecycle.md) - Triggering actions from hooks

---

**Last Updated**: 2025-12-30
**Version**: 1.0.0
**Status**: Complete
