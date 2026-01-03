---
title: Scheduled Actions Overview
description: Background task processing system for deferred and recurring operations
---

# Scheduled Actions System

The Scheduled Actions system provides a robust infrastructure for scheduling, processing, and managing background tasks. It supports one-time actions, recurring jobs, webhook delivery, and time-window deduplication.

## Core Concepts

### What Are Scheduled Actions?

Scheduled Actions are database-backed tasks that execute asynchronously via an external cron trigger. They're ideal for:

- **Webhook Delivery:** Send notifications to external systems on entity events
- **Billing Operations:** Process subscription renewals, trial expirations
- **Data Processing:** Batch operations, cleanup tasks
- **Notifications:** Delayed emails, push notifications

### Architecture Overview

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│   Application   │────▶│  scheduled_actions │────▶│  Action Handler │
│  (Hooks/API)    │     │      (table)       │     │   (Registry)    │
└─────────────────┘     └───────────────────┘     └─────────────────┘
                               ▲
                               │
                        ┌──────┴──────┐
                        │ External    │
                        │ Cron (1min) │
                        └─────────────┘
```

| Component | Purpose |
|-----------|---------|
| **Scheduler** | Creates actions in the database |
| **Database Table** | Persists pending/completed actions |
| **Processor** | Executes due actions via cron |
| **Registry** | Maps action types to handlers |
| **Handlers** | Implement actual business logic |

### Why External Cron?

Unlike in-process job queues, Scheduled Actions use an external cron trigger because:

- **Serverless Compatible:** Works with Vercel, Cloudflare Workers
- **No Long-Running Process:** No worker dyno needed
- **Stateless:** Each invocation is independent
- **Scalable:** Can handle varying loads
- **Recoverable:** Pending actions survive restarts

## Database Schema

The `scheduled_actions` table stores all scheduled tasks:

```sql
CREATE TABLE "scheduled_actions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actionType" VARCHAR(255) NOT NULL,       -- e.g., 'webhook:send'
  "status" VARCHAR(50) DEFAULT 'pending',   -- pending, processing, completed, failed
  "payload" JSONB NOT NULL,                 -- Action-specific data
  "teamId" UUID REFERENCES "teams"("id"),   -- Optional team scope
  "scheduledAt" TIMESTAMP DEFAULT NOW(),    -- When to execute
  "startedAt" TIMESTAMP,                    -- Execution start
  "completedAt" TIMESTAMP,                  -- Execution end
  "errorMessage" TEXT,                      -- Error details if failed
  "retryCount" INT DEFAULT 0,               -- Number of retries
  "recurringInterval" VARCHAR(50),          -- For recurring: 'hourly', 'daily', cron
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Status Lifecycle

```
pending ─────▶ processing ─────▶ completed
                  │
                  └─────▶ failed (with errorMessage)
```

## Key Features

### 1. One-Time Actions

Schedule an action to execute once at a specific time:

```typescript
import { scheduleAction } from '@/core/lib/scheduled-actions'

await scheduleAction('email:send', {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome'
}, {
  scheduledAt: new Date(Date.now() + 3600000) // 1 hour from now
})
```

### 2. Recurring Actions

Schedule actions that repeat on a pattern:

```typescript
import { scheduleRecurringAction } from '@/core/lib/scheduled-actions'

await scheduleRecurringAction('billing:check-renewals', {}, 'daily', {
  scheduledAt: new Date('2024-01-01T00:00:00Z')
})
```

Supported intervals:
- `hourly` - Every hour
- `daily` - Every day
- `weekly` - Every week
- Custom cron expressions (future)

### 3. Time-Window Deduplication

Prevent duplicate actions within a configurable time window:

```typescript
// Config in app.config.ts
scheduledActions: {
  deduplication: {
    windowSeconds: 5,   // Duplicates within 5 seconds update existing action
  }
}
```

**Behavior:**
- `windowSeconds > 0`: Duplicates update existing action's payload with latest data
- `windowSeconds = 0`: Deduplication disabled (all actions created)

See [Deduplication](./06-deduplication.md) for details.

### 4. Multi-Endpoint Webhooks

Route webhook events to different endpoints based on patterns:

```typescript
webhooks: {
  endpoints: {
    tasks: {
      envVar: 'WEBHOOK_URL_TASKS',
      patterns: ['task:created', 'task:updated'],
      enabled: true
    },
    billing: {
      envVar: 'WEBHOOK_URL_BILLING',
      patterns: ['subscription:*'],
      enabled: true
    }
  }
}
```

See [Webhooks](./04-webhooks.md) for details.

## Core/Theme Separation

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Core** | `core/lib/scheduled-actions/` | Infrastructure (processor, scheduler, registry) |
| **Theme** | `contents/themes/*/lib/scheduled-actions/` | Handlers (webhook, billing, custom) |

**Core provides:**
- Database schema and queries
- Scheduler functions
- Processor logic
- Action registry
- Type definitions

**Theme provides:**
- Action handler implementations
- Webhook routing configuration
- Entity hook integrations
- Custom action types

## Registry System

The Scheduled Actions system uses an auto-generated registry to map action types to their handlers.

### Auto-Generated Registry

The `SCHEDULED_ACTIONS_REGISTRY` is generated during the build process:

```typescript
// core/lib/registries/scheduled-actions-registry.ts (AUTO-GENERATED)
export const SCHEDULED_ACTIONS_REGISTRY = {
  actionTypes: ['webhook:send', 'billing:check-renewals'],
  handlers: {
    'webhook:send': () => import('@/contents/themes/default/lib/scheduled-actions/handlers/webhook'),
    'billing:check-renewals': () => import('@/contents/themes/default/lib/scheduled-actions/handlers/billing'),
  }
}
```

### When to Rebuild

Run the registry generator after:

- Adding a new action handler
- Removing an existing handler
- Renaming an action type

```bash
node core/scripts/build/registry.mjs
```

### Initialization Flow

```
Server Start
    │
    ▼
initializeScheduledActions() (core/lib/scheduled-actions/initializer.ts)
    │
    ├── Guard: Skip if already initialized
    │
    ▼
registerAllHandlers() (theme/lib/scheduled-actions/index.ts)
    │
    ├── registerWebhookHandler()
    ├── registerBillingHandler()
    └── registerCustomHandlers()
    │
    ▼
Handlers registered in core registry
```

**Key Points:**
- Core initializer handles the guard to prevent double registration
- Theme only exports registration functions
- All handlers must be registered before processing starts

## Quick Start

### 1. Schedule an Action

```typescript
import { scheduleAction } from '@/core/lib/scheduled-actions'

// Schedule a webhook
await scheduleAction('webhook:send', {
  eventType: 'task:created',
  entityType: 'task',
  entityId: 'task-123',
  data: { title: 'New Task' }
}, { teamId: 'team-456' })
```

### 2. Create a Custom Handler

```typescript
// contents/themes/default/lib/scheduled-actions/handlers/my-handler.ts
import { registerScheduledAction } from '@/core/lib/scheduled-actions'

registerScheduledAction('my-action', async (payload) => {
  // Your logic here
  console.log('Processing:', payload)
  return { success: true }
})
```

### 3. Trigger Processing

```bash
# External cron calls this endpoint every minute
curl -X GET "https://yourapp.com/api/v1/cron/process" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Next Steps

- [Configuration](./02-configuration.md) - Full configuration options
- [Action Handlers](./03-action-handlers.md) - Creating custom handlers
- [Webhooks](./04-webhooks.md) - Multi-endpoint webhook system
- [API Reference](./05-api-reference.md) - Endpoint documentation
- [Deduplication](./06-deduplication.md) - Time-window deduplication

## Related Documentation

- [Background Jobs](../10-backend/07-background-jobs.md) - Alternative job processing patterns
- [API Authentication](../05-api/02-authentication.md) - Dual auth pattern
- [Entity Hooks](../04-entities/08-hooks-and-lifecycle.md) - Entity lifecycle events
- [Billing System](../19-billing/01-overview.md) - Subscription webhooks

---

**Last Updated**: 2025-12-30
**Version**: 1.0.0
**Status**: Complete
