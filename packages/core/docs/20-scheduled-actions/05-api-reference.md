---
title: API Reference
description: Scheduled Actions API endpoints for processing and management
---

# API Reference

The Scheduled Actions system provides two main API endpoints: one for cron processing and one for development/debugging.

## Cron Processing Endpoint

### `GET /api/v1/cron/process`

Processes pending scheduled actions. Called by an external cron service every minute.

#### Authentication

Uses a shared secret via `x-cron-secret` header:

```bash
curl -X GET "https://yourapp.com/api/v1/cron/process" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

#### Environment Variable

```env
CRON_SECRET=your-secure-random-string-min-32-chars
```

#### Response

**Success (200 OK):**

```json
{
  "processed": 3,
  "succeeded": 2,
  "failed": 1,
  "errors": [
    {
      "actionId": "uuid-3",
      "error": "Action webhook:send exceeded timeout of 30000ms"
    }
  ]
}
```

**No Actions (200 OK):**

```json
{
  "processed": 0,
  "succeeded": 0,
  "failed": 0,
  "errors": []
}
```

**Authentication Error (401 Unauthorized):**

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing cron secret"
}
```

#### Processing Logic

1. Call `initializeScheduledActions()` as safety net (re-registers handlers after server restarts)
2. Fetch up to `batchSize` pending actions where `scheduledAt <= NOW()`
3. Apply lock group enforcement: only one action per `lockGroup` in each batch
4. Mark each as `running` (with `attempts` counter incremented)
5. Execute handler with timeout protection
6. On success: mark `completed`, reschedule if recurring
7. On failure: if `attempts < maxRetries`, reschedule with linear backoff; otherwise mark `failed`
8. Run `cleanupOldActions()` based on `retentionDays` config

#### Handler Initialization Safety Net

The cron endpoint calls `initializeScheduledActions()` before processing. This re-registers all theme handlers from the `SCHEDULED_ACTIONS_REGISTRY` if they were lost due to a server restart (common in serverless environments). The initializer has a guard to prevent double registration.

#### Cron Service Setup

**Vercel Cron (vercel.json):**

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/process",
      "schedule": "* * * * *"
    }
  ]
}
```

**External Service (e.g., cron-job.org):**

```text
URL: https://yourapp.com/api/v1/cron/process
Method: GET
Headers: x-cron-secret: YOUR_SECRET
Schedule: Every minute
```

---

## DevTools Endpoints

Development and debugging endpoints for managing scheduled actions.

### `GET /api/v1/devtools/scheduled-actions`

List scheduled actions with filtering.

#### Authentication

Requires API key with developer/superadmin role:

```bash
curl "http://localhost:3000/api/v1/devtools/scheduled-actions" \
  -H "x-api-key: YOUR_API_KEY"
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `string` | - | Filter by status: `pending`, `running`, `completed`, `failed` |
| `action_type` | `string` | - | Filter by action type (e.g., `webhook:send`) |
| `page` | `number` | `1` | Page number for pagination |
| `limit` | `number` | `20` | Results per page (max 100) |

#### Examples

```bash
# Get all pending actions
curl "http://localhost:3000/api/v1/devtools/scheduled-actions?status=pending" \
  -H "x-api-key: YOUR_API_KEY"

# Get completed webhook actions
curl "http://localhost:3000/api/v1/devtools/scheduled-actions?status=completed&action_type=webhook:send" \
  -H "x-api-key: YOUR_API_KEY"

# Get page 2 with 10 results
curl "http://localhost:3000/api/v1/devtools/scheduled-actions?page=2&limit=10" \
  -H "x-api-key: YOUR_API_KEY"
```

#### Response

```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "id": "uuid-1",
        "actionType": "webhook:send",
        "status": "pending",
        "payload": {
          "eventType": "task:created",
          "entityType": "task",
          "entityId": "task-uuid",
          "data": { "title": "New Task" }
        },
        "teamId": "team-uuid",
        "scheduledAt": "2026-01-15T10:30:00Z",
        "startedAt": null,
        "completedAt": null,
        "errorMessage": null,
        "attempts": 0,
        "maxRetries": 3,
        "recurringInterval": null,
        "recurrenceType": null,
        "lockGroup": null,
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "meta": {
      "registeredActionTypes": [
        "webhook:send",
        "content:publish",
        "social:refresh-tokens"
      ]
    }
  }
}
```

---

### `GET /api/v1/devtools/scheduled-actions/:id`

Get details of a specific action.

```bash
curl "http://localhost:3000/api/v1/devtools/scheduled-actions/uuid-123" \
  -H "x-api-key: YOUR_API_KEY"
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "actionType": "content:publish",
    "status": "completed",
    "payload": {
      "contentId": "content-456",
      "entityId": "content-456",
      "entityType": "contents"
    },
    "teamId": "team-uuid",
    "scheduledAt": "2026-01-15T10:30:00Z",
    "startedAt": "2026-01-15T10:31:00Z",
    "completedAt": "2026-01-15T10:31:01Z",
    "errorMessage": null,
    "attempts": 1,
    "maxRetries": 3,
    "recurringInterval": null,
    "recurrenceType": null,
    "lockGroup": "content:content-456",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T10:31:01Z"
  }
}
```

---

### `POST /api/v1/devtools/scheduled-actions`

Manually create a scheduled action (for testing).

```bash
curl -X POST "http://localhost:3000/api/v1/devtools/scheduled-actions" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "webhook:send",
    "payload": {
      "eventType": "test:event",
      "entityType": "test",
      "entityId": "test-123",
      "data": { "message": "Test webhook" }
    },
    "teamId": "team-uuid",
    "scheduledAt": "2026-01-15T12:00:00Z"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actionType` | `string` | Yes | Handler type (e.g., `webhook:send`) |
| `payload` | `object` | Yes | Action-specific data |
| `teamId` | `string` | No | Team scope |
| `scheduledAt` | `string` | No | ISO 8601 date (default: now) |
| `recurringInterval` | `string` | No | For recurring: `every-30-minutes`, `hourly`, `daily`, `weekly` |
| `maxRetries` | `number` | No | Max attempts (default: 3) |
| `lockGroup` | `string` | No | Lock group for sequential execution |
| `recurrenceType` | `string` | No | `fixed` or `rolling` (default: `fixed`) |

#### Response

```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "actionType": "webhook:send",
    "status": "pending"
  }
}
```

---

### `POST /api/v1/devtools/scheduled-actions/:id/retry`

Retry a failed action.

```bash
curl -X POST "http://localhost:3000/api/v1/devtools/scheduled-actions/uuid-123/retry" \
  -H "x-api-key: YOUR_API_KEY"
```

#### Response

```json
{
  "success": true,
  "message": "Action queued for retry",
  "data": {
    "id": "uuid-123",
    "status": "pending",
    "attempts": 1
  }
}
```

---

### `DELETE /api/v1/devtools/scheduled-actions/:id`

Cancel/delete a pending action.

```bash
curl -X DELETE "http://localhost:3000/api/v1/devtools/scheduled-actions/uuid-123" \
  -H "x-api-key: YOUR_API_KEY"
```

#### Response

```json
{
  "success": true,
  "message": "Action cancelled"
}
```

---

## Programmatic API

### Scheduler Functions

```typescript
import {
  scheduleAction,
  scheduleRecurringAction,
  cancelScheduledAction
} from '@/core/lib/scheduled-actions'

// Schedule one-time action
const actionId = await scheduleAction('webhook:send', {
  eventType: 'task:created',
  entityType: 'task',
  entityId: 'task-123',
  data: { title: 'New Task' }
}, {
  teamId: 'team-456',
  scheduledAt: new Date(Date.now() + 3600000),
  maxRetries: 5,
  lockGroup: 'task:task-123'
})

// Schedule recurring action
const recurringId = await scheduleRecurringAction(
  'social:refresh-tokens',
  {},
  'every-30-minutes',
  {
    recurrenceType: 'rolling',
    maxRetries: 3
  }
)

// Cancel action
await cancelScheduledAction(actionId)
```

### Function Signatures

```typescript
// One-time action (returns existing ID if deduplicated, or new ID)
function scheduleAction(
  actionType: string,
  payload: unknown,
  options?: ScheduleOptions
): Promise<string>

// Recurring action (always returns new ID, bypasses deduplication)
function scheduleRecurringAction(
  actionType: string,
  payload: unknown,
  interval: string,
  options?: Omit<ScheduleOptions, 'recurringInterval'>
): Promise<string>

// Cancel pending action (marks as 'failed' with cancellation message)
function cancelScheduledAction(actionId: string): Promise<boolean>
```

### ScheduleOptions

```typescript
interface ScheduleOptions {
  scheduledAt?: Date                    // Default: now
  teamId?: string                      // Optional team context
  recurringInterval?: string           // 'every-30-minutes' | 'hourly' | 'daily' | 'weekly'
  maxRetries?: number                  // Total attempts before failing (default: 3)
  lockGroup?: string                   // Sequential execution key
  recurrenceType?: 'fixed' | 'rolling' // How next run is calculated (default: 'fixed')
}
```

### Supported Recurring Intervals

| Interval | Duration |
|----------|----------|
| `every-30-minutes` | 30 minutes |
| `hourly` | 1 hour |
| `daily` | 24 hours |
| `weekly` | 7 days |

---

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized` | Missing or invalid authentication |
| 403 | `Forbidden` | Insufficient permissions (requires developer role) |
| 404 | `Not Found` | Action ID not found |
| 400 | `Bad Request` | Invalid request body or parameters |
| 500 | `Internal Error` | Server-side error |

## Rate Limiting

The cron endpoint has special rate limiting:

- **Cron Endpoint:** 1 request per minute (enforced by cron schedule)
- **DevTools Endpoints:** Standard API rate limits apply

## Related Documentation

- [Overview](./01-overview.md) - System introduction
- [Configuration](./02-configuration.md) - Config options
- [Action Handlers](./03-action-handlers.md) - Handler implementation
- [API Introduction](../05-api/01-introduction.md) - API architecture

---

**Last Updated**: 2026-02-06
**Version**: 2.0.0
**Status**: Complete
