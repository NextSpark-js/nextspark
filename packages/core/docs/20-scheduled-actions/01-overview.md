---
title: Scheduled Actions Overview
description: Background task processing system for deferred, recurring, and lock-group-based operations
---

# Scheduled Actions System

The Scheduled Actions system provides a robust infrastructure for scheduling, processing, and managing background tasks. It supports one-time actions, recurring jobs with fixed or rolling recurrence, lock-group-based sequential execution, time-window deduplication with advisory locks, and configurable retries with linear backoff.

## Core Concepts

### What Are Scheduled Actions?

Scheduled Actions are database-backed tasks that execute asynchronously via an external cron trigger. They're ideal for:

- **Content Publishing:** Publish content to social media at scheduled times
- **Token Refresh:** Proactively refresh OAuth tokens before they expire
- **Webhook Delivery:** Send notifications to external systems on entity events
- **Billing Operations:** Process subscription renewals, trial expirations
- **Data Processing:** Batch operations, cleanup tasks

### Architecture Overview

```text
+-------------------+          +----------------------------+
|  Entity Hooks     |          |     Cron Endpoint          |
|  (content status  +--------->|  1. initializeHandlers()   |
|   changes)        | creates  |  2. processPendingActions() |
|                   | actions  |  3. cleanupOldActions()     |
+-------------------+          +-------------+--------------+
                                             |
                                    External Cron (1 min)
                                    x-cron-secret header
                                             |
                                             v
                               +----------------------------+
                               |      Processor             |
                               |  - Fetch pending actions   |
                               |  - SKIP LOCKED row locking |
                               |  - Lock group enforcement  |
                               |  - Execute with timeout    |
                               |  - Retry / mark failed     |
                               |  - Reschedule recurring    |
                               +----------------------------+
                                             |
                                             v
                               +----------------------------+
                               |    Handler Registry        |
                               |  (in-memory Map)           |
                               +----------------------------+
```

### Module Architecture (6 Modules)

| Module | File | Responsibility |
|--------|------|----------------|
| **Types** | `types.ts` | Type definitions (`ScheduledAction`, `ScheduleOptions`, `ProcessResult`, `RecurrenceType`) |
| **Registry** | `registry.ts` | In-memory Map of action handlers. Register/lookup by action type |
| **Scheduler** | `scheduler.ts` | Create actions in DB with deduplication via PostgreSQL advisory locks |
| **Processor** | `processor.ts` | Fetch pending actions, execute handlers, manage retries, lock groups, and recurring |
| **Cleanup** | `cleanup.ts` | Delete old completed/failed actions based on retention policy |
| **Initializer** | `initializer.ts` | Load theme handlers from auto-generated `SCHEDULED_ACTIONS_REGISTRY` on startup |

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
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId"            TEXT REFERENCES "teams"(id) ON DELETE CASCADE,
  "actionType"        TEXT NOT NULL,
  status              scheduled_action_status NOT NULL DEFAULT 'pending',
  payload             JSONB DEFAULT '{}'::jsonb,
  "scheduledAt"       TIMESTAMPTZ NOT NULL,
  "startedAt"         TIMESTAMPTZ,
  "completedAt"       TIMESTAMPTZ,
  "errorMessage"      TEXT,
  attempts            INTEGER NOT NULL DEFAULT 0,
  "maxRetries"        INTEGER NOT NULL DEFAULT 3,
  "recurringInterval" TEXT,
  "recurrenceType"    TEXT,
  "lockGroup"         TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Key columns:

| Column | Description |
|--------|-------------|
| `attempts` | Number of execution attempts so far |
| `maxRetries` | Total attempts allowed before marking as failed (default: 3) |
| `recurrenceType` | `'fixed'` (maintain schedule times) or `'rolling'` (interval from completion) |
| `lockGroup` | Actions with same lockGroup execute sequentially |

### Status Lifecycle

```text
  PENDING -----> RUNNING -----> COMPLETED
     ^              |                |
     |              v                v
     +--- RETRY  FAILED     (reschedule if
     (linear           |       recurring)
      backoff)         |
                       v
                [End of life]
```

Status values: `pending`, `running`, `completed`, `failed`

## Key Features

### 1. One-Time Actions

Schedule an action to execute once at a specific time:

```typescript
import { scheduleAction } from '@nextsparkjs/core/lib/scheduled-actions'

await scheduleAction('content:publish', {
  contentId: 'content-123',
  entityId: 'content-123',
  entityType: 'contents'
}, {
  scheduledAt: new Date('2026-03-01T10:00:00Z'),
  teamId: 'team-456',
  lockGroup: 'content:content-123',
  maxRetries: 1
})
```

### 2. Recurring Actions

Schedule actions that repeat on a pattern:

```typescript
import { scheduleRecurringAction } from '@nextsparkjs/core/lib/scheduled-actions'

await scheduleRecurringAction('social:refresh-tokens', {}, 'every-30-minutes', {
  recurrenceType: 'rolling'
})
```

Supported intervals:
- `every-30-minutes` - Every 30 minutes
- `hourly` - Every hour
- `daily` - Every day
- `weekly` - Every week

Recurrence types:
- `fixed` (default) - Next run calculated from `scheduledAt` to prevent drift
- `rolling` - Next run calculated from actual completion time

### 3. Lock Groups

Control parallel execution per resource:

```typescript
// These run sequentially (same lockGroup)
await scheduleAction('content:publish', payload1, { lockGroup: 'content:123' })
await scheduleAction('content:publish', payload2, { lockGroup: 'content:123' })

// This runs in parallel (different lockGroup)
await scheduleAction('content:publish', payload3, { lockGroup: 'content:456' })

// This runs in parallel with everything (no lockGroup)
await scheduleAction('email:send', payload4)
```

The processor uses `SELECT FOR UPDATE SKIP LOCKED` with `PARTITION BY lockGroup` to ensure only one action per lockGroup is fetched per batch.

### 4. Retry with Linear Backoff

Failed actions are automatically retried based on `maxRetries`:

```text
maxRetries = 3 (default):
  Attempt 1: immediate
  Attempt 2: +5 minutes
  Attempt 3: +10 minutes
  After 3rd failure: marked as 'failed'

Backoff formula: attempts * 5 minutes
```

### 5. Time-Window Deduplication

Prevent duplicate actions within a configurable time window using PostgreSQL advisory locks:

```typescript
scheduledActions: {
  deduplication: {
    windowSeconds: 5,   // Duplicates within 5 seconds update existing action
  }
}
```

See [Deduplication](./06-deduplication.md) for details.

### 6. Configurable Timeout

Each handler can define its own timeout:

```typescript
registerScheduledAction('content:publish', handler, {
  timeout: 60000  // 60 seconds
})
```

Priority: handler timeout > config `defaultTimeout` > 30000ms fallback.

## Core/Theme Separation

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Core** | `core/lib/scheduled-actions/` | Infrastructure (processor, scheduler, registry, initializer) |
| **Theme** | `contents/themes/*/lib/scheduled-actions/` | Handlers, entity hooks, recurring action registration |

**Core provides:** Database schema, scheduler functions, processor logic, action registry, type definitions, initializer.

**Theme provides:** Action handler implementations, entity hook integrations, recurring action definitions, custom action types.

## Registry System

The Scheduled Actions system uses an auto-generated registry (`SCHEDULED_ACTIONS_REGISTRY`) that maps themes to their handler registration modules:

```typescript
// .nextspark/registries/scheduled-actions-registry.ts (AUTO-GENERATED)
import * as myThemeScheduledActions from '@/contents/themes/my-theme/lib/scheduled-actions'

export const SCHEDULED_ACTIONS_REGISTRY: Record<string, ScheduledActionsModule> = {
  'my-theme': {
    registerAllHandlers: myThemeScheduledActions.registerAllHandlers,
    registerRecurringActions: myThemeScheduledActions.registerRecurringActions,
  }
}
```

### Initialization Flow

```text
Server Start
    |
    v
instrumentation.ts::register()
    |
    +-- initializeScheduledActions()
    |   |
    |   +-- Guard: Skip if already initialized
    |   |
    |   +-- SCHEDULED_ACTIONS_REGISTRY[themeName].registerAllHandlers()
    |       |
    |       +-- registerContentPublishHandler()
    |       +-- registerTokenRefreshHandler()
    |       +-- registerContentHooks()
    |
    +-- initializeRecurringActions()
        |
        +-- Guard: Skip if already initialized
        |
        +-- SCHEDULED_ACTIONS_REGISTRY[themeName].registerRecurringActions()
            |
            +-- Check DB for existing recurring actions
            +-- Create new ones if needed
```

The cron endpoint also calls `initializeScheduledActions()` as a safety net to re-register handlers after server restarts.

## Quick Start

### 1. Schedule an Action

```typescript
import { scheduleAction } from '@nextsparkjs/core/lib/scheduled-actions'

const actionId = await scheduleAction('my:action', {
  key: 'value'
}, {
  scheduledAt: new Date(Date.now() + 3600000),
  maxRetries: 3
})
```

### 2. Create a Handler

```typescript
import { registerScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions'

registerScheduledAction('my:action', async (payload, action) => {
  // Your logic here. Throw to fail, return to succeed.
  console.log('Processing:', payload)
}, {
  description: 'My custom action',
  timeout: 30000
})
```

### 3. Trigger Processing

```bash
curl -s "https://yourapp.com/api/v1/cron/process" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## DevTools Monitoring

Navigate to **DevTools > Acciones Programadas** (`/devtools/scheduled-actions`) to:

- View all actions with status, attempts, timing, lock group
- Filter by status and action type
- Expand rows to see payload data and error messages
- Manually execute pending actions or retry failed ones

## Next Steps

- [Configuration](./02-configuration.md) - Full configuration options
- [Action Handlers](./03-action-handlers.md) - Creating custom handlers
- [Webhooks](./04-webhooks.md) - Multi-endpoint webhook system
- [API Reference](./05-api-reference.md) - Endpoint documentation
- [Deduplication](./06-deduplication.md) - Time-window deduplication

## Related Documentation

- [API Authentication](../05-api/02-authentication.md) - Dual auth pattern
- [Entity Hooks](../04-entities/08-hooks-and-lifecycle.md) - Entity lifecycle events

---

**Last Updated**: 2026-02-06
**Version**: 2.0.0
**Status**: Complete
