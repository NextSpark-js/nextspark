---
name: scheduled-actions
description: |
  Scheduled Actions system for background task processing in this application.
  Covers action scheduling, handler creation, webhook configuration, and cron processing.
  Use this skill when creating, debugging, or configuring scheduled actions.
allowed-tools: Read, Glob, Grep, Bash, Write, Edit
version: 1.0.0
---

# Scheduled Actions Skill

Patterns for background task processing and webhook systems.

## Architecture Overview

```
SCHEDULED ACTIONS SYSTEM:

Core Layer (core/lib/scheduled-actions/):
├── scheduler.ts        # scheduleAction(), scheduleRecurringAction()
├── processor.ts        # Cron processing logic
├── registry.ts         # Handler registration
└── types.ts            # TypeScript interfaces

Theme Layer (contents/themes/{theme}/lib/scheduled-actions/):
├── index.ts            # Handler initialization + registerAllHandlers()
├── entity-hooks.ts     # Entity event → action mapping
└── handlers/           # Handler implementations
    ├── webhook.ts      # Webhook sender
    ├── email.ts        # Email sender (if configured)
    └── {custom}.ts     # Custom handlers

Configuration (contents/themes/{theme}/config/app.config.ts):
└── scheduledActions: {
      enabled: true,
      deduplication: { windowSeconds: 10 },
      webhooks: { endpoints: {...}, patterns: {...} }
    }

Flow:
Entity Event → Entity Hook → scheduleAction() → DB Table → Cron → Handler → Result
```

## When to Use This Skill

- Creating new action handlers
- Setting up webhooks for entity events
- Debugging pending/failed actions
- Configuring deduplication or batching
- Understanding the scheduled actions flow

## Key Files Reference

| File | Purpose |
|------|---------|
| `core/lib/scheduled-actions/scheduler.ts` | `scheduleAction()`, `scheduleRecurringAction()` |
| `core/lib/scheduled-actions/processor.ts` | Cron processing logic |
| `core/lib/scheduled-actions/registry.ts` | Handler registration |
| `contents/themes/{theme}/lib/scheduled-actions/index.ts` | Handler initialization |
| `contents/themes/{theme}/lib/scheduled-actions/handlers/` | Handler implementations |
| `contents/themes/{theme}/config/app.config.ts` | Configuration section |

## Creating Action Handlers

### Handler Template

```typescript
// contents/themes/{theme}/lib/scheduled-actions/handlers/{name}.ts
import { registerScheduledAction } from '@/core/lib/scheduled-actions'

interface MyPayload {
  entityId: string
  teamId: string
  data: Record<string, unknown>
}

export function registerMyHandler() {
  registerScheduledAction('my-action:type', async (payload, action) => {
    const data = payload as MyPayload

    try {
      // Implementation logic
      await processMyAction(data)

      return {
        success: true,
        message: 'Action completed successfully'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}
```

### Registering Handler

```typescript
// contents/themes/{theme}/lib/scheduled-actions/index.ts
import { registerMyHandler } from './handlers/my-handler'

let initialized = false

export function registerAllHandlers() {
  if (initialized) return
  initialized = true

  // Register all handlers
  registerWebhookHandler()
  registerMyHandler()  // Add new handler here
}
```

### Handler Types

| Type | Description | Use Case |
|------|-------------|----------|
| `webhook` | Send HTTP POST to external endpoint | Integrations, notifications |
| `email` | Send transactional emails | User notifications |
| `data-processor` | Process/transform data | ETL, aggregations |
| `cleanup` | Clean up old records | Maintenance tasks |

## Webhook Configuration

### Entity Hook Pattern

```typescript
// contents/themes/{theme}/lib/scheduled-actions/entity-hooks.ts
import { scheduleAction } from '@/core/lib/scheduled-actions'
import { hookSystem } from '@/core/lib/hooks'

export function registerEntityHooks() {
  // Hook for task creation
  hookSystem.register('entity.tasks.created', async ({ entity, teamId }) => {
    await scheduleAction({
      type: 'webhook:send',
      payload: {
        endpointKey: 'tasks',
        event: 'task.created',
        data: entity
      },
      scheduledFor: new Date(),
      teamId
    })
  })

  // Hook for task updates
  hookSystem.register('entity.tasks.updated', async ({ entity, teamId }) => {
    await scheduleAction({
      type: 'webhook:send',
      payload: {
        endpointKey: 'tasks',
        event: 'task.updated',
        data: entity
      },
      scheduledFor: new Date(),
      teamId
    })
  })
}
```

### Webhook Configuration in app.config.ts

```typescript
// contents/themes/{theme}/config/app.config.ts
export const appConfig = {
  // ... other config

  scheduledActions: {
    enabled: true,

    deduplication: {
      windowSeconds: 10  // 0 to disable
    },

    webhooks: {
      endpoints: {
        // Key -> Environment variable mapping
        tasks: 'WEBHOOK_URL_TASKS',
        subscriptions: 'WEBHOOK_URL_SUBSCRIPTIONS',
        default: 'WEBHOOK_URL_DEFAULT'
      },
      patterns: {
        // Event pattern -> Endpoint key
        'task.*': 'tasks',
        'subscription.*': 'subscriptions',
        '*': 'default'  // Fallback
      }
    }
  }
}
```

### Environment Variables

```env
# Required for cron processing
CRON_SECRET=your-secure-secret-min-32-chars

# Webhook URLs (one per endpoint key)
WEBHOOK_URL_TASKS=https://your-webhook-url/tasks
WEBHOOK_URL_SUBSCRIPTIONS=https://your-webhook-url/subs
WEBHOOK_URL_DEFAULT=https://fallback-url
```

## Scheduling Actions

### Immediate Action

```typescript
import { scheduleAction } from '@/core/lib/scheduled-actions'

await scheduleAction({
  type: 'my-action:type',
  payload: {
    entityId: 'abc123',
    data: { field: 'value' }
  },
  scheduledFor: new Date(),  // Now
  teamId: 'team_123'
})
```

### Delayed Action

```typescript
await scheduleAction({
  type: 'reminder:send',
  payload: { userId: 'user_123', message: 'Follow up' },
  scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),  // Tomorrow
  teamId: 'team_123'
})
```

### Recurring Action

```typescript
import { scheduleRecurringAction } from '@/core/lib/scheduled-actions'

await scheduleRecurringAction({
  type: 'report:generate',
  payload: { reportType: 'daily-summary' },
  cron: '0 9 * * *',  // Every day at 9 AM
  teamId: 'team_123'
})
```

## Debugging Actions

### Check Pending Actions

```bash
curl "http://localhost:5173/api/v1/devtools/scheduled-actions?status=pending" \
  -H "Authorization: Bearer API_KEY"
```

### Check Failed Actions

```bash
curl "http://localhost:5173/api/v1/devtools/scheduled-actions?status=failed" \
  -H "Authorization: Bearer API_KEY"
```

### Manually Trigger Processing

```bash
curl "http://localhost:5173/api/v1/cron/process" \
  -H "x-cron-secret: CRON_SECRET"
```

### Console Log Patterns

```
[ScheduledActions] Processing 5 pending actions
[ScheduledActions] Action abc123 completed successfully
[ScheduledActions] Action xyz789 failed: Connection timeout
[ScheduledActions] Handler not found for type: unknown:type
```

## Deduplication

### Purpose

Prevents duplicate actions when the same event fires multiple times in quick succession.

### Configuration

```typescript
scheduledActions: {
  deduplication: {
    windowSeconds: 10  // Actions with same type+payload within 10s are deduplicated
  }
}
```

### Behavior

1. When action is scheduled, system creates hash of `type + payload`
2. If action with same hash exists within window, new action is skipped
3. Window is reset when action is processed

### Disabling

Set `windowSeconds: 0` to disable deduplication entirely.

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/cron/process` | POST | x-cron-secret | Trigger action processing |
| `/api/v1/devtools/scheduled-actions` | GET | API Key | List actions (debug) |
| `/api/v1/devtools/scheduled-actions/:id` | DELETE | API Key | Delete action (debug) |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Handler not found | Not registered | Add to `index.ts` `registerAllHandlers()` |
| Webhook not sent | Pattern mismatch | Check patterns in `app.config.ts` |
| Duplicate actions | Dedup disabled | Set `windowSeconds > 0` |
| Actions stuck pending | Cron not running | Verify cron service and `CRON_SECRET` |
| 401 on cron endpoint | Wrong header | Use `x-cron-secret` (not `Authorization`) |
| Env variable undefined | Not set | Add to `.env` and restart server |

## Anti-Patterns

```typescript
// NEVER: Process actions synchronously in API routes
// This blocks the response
app.post('/api/entity', async (req, res) => {
  const entity = await createEntity(req.body)
  await sendWebhook(entity)  // WRONG - blocks response
  res.json(entity)
})

// CORRECT: Schedule action for async processing
app.post('/api/entity', async (req, res) => {
  const entity = await createEntity(req.body)
  await scheduleAction({
    type: 'webhook:send',
    payload: { entity },
    scheduledFor: new Date(),
    teamId: req.teamId
  })
  res.json(entity)
})

// NEVER: Store sensitive data in payload
await scheduleAction({
  type: 'email:send',
  payload: {
    password: 'secret123'  // WRONG - stored in DB
  }
})

// CORRECT: Store references only
await scheduleAction({
  type: 'email:send',
  payload: {
    userId: 'user_123',  // Lookup at processing time
    templateKey: 'password-reset'
  }
})

// NEVER: Forget to handle errors in handlers
registerScheduledAction('my:action', async (payload) => {
  await riskyOperation(payload)  // WRONG - unhandled rejection
})

// CORRECT: Always return success/failure
registerScheduledAction('my:action', async (payload) => {
  try {
    await riskyOperation(payload)
    return { success: true, message: 'Done' }
  } catch (error) {
    return { success: false, message: error.message }
  }
})
```

## Checklist

### Creating New Handler

- [ ] Handler file created in `handlers/` directory
- [ ] Handler registered in `index.ts` `registerAllHandlers()`
- [ ] Handler returns `{ success, message }` object
- [ ] Error handling with try/catch
- [ ] Registry rebuilt: `node core/scripts/build/registry.mjs`

### Adding Webhook

- [ ] Entity hook registered in `entity-hooks.ts`
- [ ] Endpoint key added to `webhooks.endpoints` config
- [ ] Pattern added to `webhooks.patterns` config
- [ ] Environment variable added to `.env`
- [ ] Environment variable documented in `.env.example`

### Debugging

- [ ] Check if `scheduledActions.enabled: true` in config
- [ ] Verify `CRON_SECRET` is set
- [ ] Check handler is registered (console log on startup)
- [ ] Query devtools endpoint for action status
- [ ] Check console for `[ScheduledActions]` logs

## Related Skills

- `entity-api` - API endpoints that trigger entity hooks
- `service-layer` - Service patterns for action processing
- `nextjs-api-development` - Cron endpoint patterns
- `database-migrations` - scheduled_actions table structure

## Documentation

Full documentation: `core/docs/20-scheduled-actions/`
- `01-overview.md` - System overview
- `02-scheduling.md` - Scheduling patterns
- `03-handlers.md` - Handler development
- `04-webhooks.md` - Webhook configuration
- `05-cron.md` - Cron processing
- `06-deduplication.md` - Deduplication system
