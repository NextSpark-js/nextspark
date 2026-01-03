---
title: Webhook System
description: Multi-endpoint webhook routing and delivery for entity events
---

# Webhook System

The Scheduled Actions webhook system provides automatic delivery of entity lifecycle events to external systems. It supports multiple endpoints with pattern-based routing.

## How It Works

```
Entity Event ──▶ Hook ──▶ Schedule Action ──▶ Processor ──▶ Webhook Delivery
   (CRUD)     (trigger)  (webhook:send)      (cron)         (HTTP POST)
```

1. **Entity Event:** CRUD operation triggers an entity hook
2. **Hook Trigger:** Hook schedules a `webhook:send` action
3. **Pattern Matching:** System finds matching webhook endpoint
4. **Delivery:** Processor sends HTTP POST to endpoint URL

## Configuration

### Multi-Endpoint Setup

```typescript
// app.config.ts
scheduledActions: {
  webhooks: {
    endpoints: {
      // Task events → Zapier
      tasks: {
        envVar: 'WEBHOOK_URL_TASKS',
        description: 'Task lifecycle notifications',
        patterns: ['task:created', 'task:updated', 'task:deleted'],
        enabled: true,
      },
      // Subscription events → Stripe/Analytics
      subscriptions: {
        envVar: 'WEBHOOK_URL_SUBSCRIPTIONS',
        description: 'Subscription lifecycle notifications',
        patterns: ['subscription:*'],
        enabled: true,
      },
      // Default catch-all (optional)
      default: {
        envVar: 'WEBHOOK_URL_DEFAULT',
        patterns: ['*:*'],
        enabled: false,
      },
    },
    defaultEndpoint: 'default',
  },
}
```

### Environment Variables

```env
# Task notifications (Zapier, n8n, custom)
WEBHOOK_URL_TASKS=https://hooks.zapier.com/hooks/catch/123456/abcdef

# Subscription events (payment processor)
WEBHOOK_URL_SUBSCRIPTIONS=https://your-server.com/webhooks/subscriptions

# Default fallback
WEBHOOK_URL_DEFAULT=https://your-server.com/webhooks/all
```

## Pattern Matching

### Pattern Syntax

| Pattern | Matches | Example Events |
|---------|---------|----------------|
| `task:created` | Exact match | `task:created` only |
| `task:*` | Any task event | `task:created`, `task:updated`, `task:deleted` |
| `*:created` | Any entity created | `task:created`, `client:created`, `project:created` |
| `*:*` | Everything | All events (catch-all) |

### Matching Priority

When multiple endpoints match an event:

1. **Exact match** wins over wildcards
2. **Entity wildcard** (`task:*`) wins over event wildcard (`*:created`)
3. **First configured** wins if same specificity

```typescript
// Event: 'task:created'
endpoints: {
  specific: { patterns: ['task:created'] },  // ✅ Matched (exact)
  tasks: { patterns: ['task:*'] },           // Not matched
  created: { patterns: ['*:created'] },      // Not matched
  default: { patterns: ['*:*'] },            // Not matched
}
```

### Explicit Routing

Override pattern matching with explicit `webhookKey`:

```typescript
await scheduleAction('webhook:send', {
  eventType: 'task:created',
  entityType: 'task',
  entityId: 'task-123',
  data: { title: 'New Task' },
  webhookKey: 'specific-endpoint'  // Force specific endpoint
})
```

## Webhook Payload

### Standard Format

```json
{
  "event": "task:created",
  "entity": "task",
  "entityId": "uuid-123",
  "teamId": "team-uuid",
  "data": {
    "id": "uuid-123",
    "title": "New Task",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:01Z"
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string` | Event type (e.g., `task:created`) |
| `entity` | `string` | Entity type (e.g., `task`) |
| `entityId` | `string` | Entity UUID |
| `teamId` | `string \| null` | Team UUID (if applicable) |
| `data` | `object` | Entity data or event-specific payload |
| `timestamp` | `string` | ISO 8601 timestamp |

## Entity Hook Integration

### Automatic Webhook Scheduling

```typescript
// contents/themes/default/lib/scheduled-actions/entity-hooks.ts
import { scheduleAction } from '@/core/lib/scheduled-actions'
import { hookSystem } from '@/core/lib/plugins/hook-system'

export function registerEntityWebhookHooks() {
  // Task created
  hookSystem.register('entity.tasks.created', async ({ entity, teamId }) => {
    await scheduleAction('webhook:send', {
      eventType: 'task:created',
      entityType: 'task',
      entityId: entity.id,
      data: entity
    }, { teamId })
  })

  // Task updated
  hookSystem.register('entity.tasks.updated', async ({ entity, changes, teamId }) => {
    await scheduleAction('webhook:send', {
      eventType: 'task:updated',
      entityType: 'task',
      entityId: entity.id,
      data: { ...entity, changes }
    }, { teamId })
  })

  // Task deleted
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

### Subscription Webhooks

```typescript
// contents/themes/default/lib/scheduled-actions/subscription-hooks.ts
import { scheduleAction } from '@/core/lib/scheduled-actions'
import { hookSystem } from '@/core/lib/plugins/hook-system'

export function registerSubscriptionWebhooks() {
  hookSystem.register('subscription.created', async ({ subscription, teamId }) => {
    await scheduleAction('webhook:send', {
      eventType: 'subscription:created',
      entityType: 'subscription',
      entityId: subscription.id,
      data: {
        planSlug: subscription.planSlug,
        status: subscription.status,
        periodStart: subscription.periodStart,
        periodEnd: subscription.periodEnd
      }
    }, { teamId })
  })

  hookSystem.register('subscription.renewed', async ({ subscription, teamId }) => {
    await scheduleAction('webhook:send', {
      eventType: 'subscription:renewed',
      entityType: 'subscription',
      entityId: subscription.id,
      data: {
        planSlug: subscription.planSlug,
        newPeriodEnd: subscription.periodEnd
      }
    }, { teamId })
  })
}
```

## Webhook Handler Implementation

### Core Handler

```typescript
// core/lib/scheduled-actions/handlers/webhook.ts
import { registerScheduledAction } from '../registry'
import { APP_CONFIG_MERGED } from '@/core/lib/config/config-sync'

interface WebhookPayload {
  eventType: string
  entityType: string
  entityId: string
  data: unknown
  webhookKey?: string
}

export function registerWebhookHandler() {
  registerScheduledAction('webhook:send', async (payload) => {
    const { eventType, entityType, entityId, data, webhookKey } = payload as WebhookPayload

    // Find matching endpoint
    const endpoint = findMatchingEndpoint(eventType, webhookKey)

    if (!endpoint) {
      return {
        success: false,
        message: `No webhook endpoint found for event: ${eventType}`
      }
    }

    // Get URL from environment
    const url = process.env[endpoint.envVar]

    if (!url) {
      return {
        success: false,
        message: `Webhook URL not configured: ${endpoint.envVar}`
      }
    }

    // Send webhook
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ScheduledActions-Webhook/1.0'
      },
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
      message: `Webhook sent: ${response.status} ${response.statusText}`,
      data: {
        endpoint: endpoint.envVar,
        status: response.status
      }
    }
  })
}

function findMatchingEndpoint(eventType: string, webhookKey?: string) {
  const webhooksConfig = APP_CONFIG_MERGED.scheduledActions?.webhooks

  if (!webhooksConfig?.endpoints) return null

  // Explicit key override
  if (webhookKey && webhooksConfig.endpoints[webhookKey]?.enabled) {
    return webhooksConfig.endpoints[webhookKey]
  }

  // Pattern matching
  for (const [key, endpoint] of Object.entries(webhooksConfig.endpoints)) {
    if (!endpoint.enabled) continue

    for (const pattern of endpoint.patterns || []) {
      if (matchPattern(pattern, eventType)) {
        return endpoint
      }
    }
  }

  // Fallback to default
  const defaultKey = webhooksConfig.defaultEndpoint
  if (defaultKey && webhooksConfig.endpoints[defaultKey]?.enabled) {
    return webhooksConfig.endpoints[defaultKey]
  }

  return null
}

function matchPattern(pattern: string, event: string): boolean {
  const [patternEntity, patternEvent] = pattern.split(':')
  const [eventEntity, eventType] = event.split(':')

  const entityMatch = patternEntity === '*' || patternEntity === eventEntity
  const eventMatch = patternEvent === '*' || patternEvent === eventType

  return entityMatch && eventMatch
}
```

## Debugging Webhooks

### DevTools UI

Access the Scheduled Actions DevTools at `/devtools/scheduled-actions`:

- View pending/completed/failed actions
- Inspect webhook payloads
- See error messages
- Manually retry failed actions

### API Debugging

```bash
# List pending webhook actions
curl "http://localhost:5173/api/v1/devtools/scheduled-actions?status=pending&type=webhook:send" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get specific action details
curl "http://localhost:5173/api/v1/devtools/scheduled-actions/ACTION_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Console Logs

```
[ScheduledActions] Scheduled action 'webhook:send' with ID: abc-123
[ScheduledActions] Processing action abc-123 (webhook:send)
[ScheduledActions] Webhook sent: 200 OK
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `No webhook endpoint found` | No pattern matches event | Add pattern to endpoint config |
| `Webhook URL not configured` | Missing env variable | Set `WEBHOOK_URL_*` in `.env` |
| `Timeout` | Endpoint too slow | Increase timeout or optimize endpoint |
| `4xx/5xx` | Endpoint error | Check endpoint logs |

### Retry Behavior

Failed webhooks are marked with status `failed` and `errorMessage`. To retry:

1. Fix the underlying issue (endpoint, URL, etc.)
2. Use DevTools to manually retry
3. Or create a new action programmatically

## Security Considerations

### Webhook Signatures

For production, add signature verification:

```typescript
// Generate signature
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex')

// Send with signature header
headers: {
  'X-Webhook-Signature': `sha256=${signature}`
}
```

### URL Validation

Only allow HTTPS URLs in production:

```typescript
if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
  throw new Error('Webhook URLs must use HTTPS in production')
}
```

## Best Practices

### 1. Use Descriptive Event Names

```typescript
// ✅ Good - clear and consistent
'task:created', 'task:updated', 'task:deleted'
'subscription:renewed', 'subscription:cancelled'

// ❌ Bad - inconsistent naming
'taskCreated', 'task_update', 'deleteTask'
```

### 2. Include Relevant Data Only

```typescript
// ✅ Include what receivers need
data: {
  id: task.id,
  title: task.title,
  status: task.status,
  dueDate: task.dueDate
}

// ❌ Don't dump entire objects
data: task  // May include sensitive fields
```

### 3. Handle Endpoint Failures Gracefully

```typescript
// Check if webhook is critical
if (endpoint.critical && !response.ok) {
  // Log alert, notify admin
  await notifyAdmin(`Critical webhook failed: ${endpoint.envVar}`)
}
```

## Related Documentation

- [Overview](./01-overview.md) - System introduction
- [Configuration](./02-configuration.md) - Config options
- [Deduplication](./06-deduplication.md) - Prevent duplicate webhooks
- [Entity Hooks](../04-entities/08-hooks-and-lifecycle.md) - Entity lifecycle

---

**Last Updated**: 2025-12-30
**Version**: 1.0.0
**Status**: Complete
