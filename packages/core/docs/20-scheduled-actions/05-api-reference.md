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
  "success": true,
  "processed": 3,
  "results": [
    {
      "actionId": "uuid-1",
      "actionType": "webhook:send",
      "success": true,
      "duration": 245
    },
    {
      "actionId": "uuid-2",
      "actionType": "billing:check-renewals",
      "success": true,
      "duration": 1230
    },
    {
      "actionId": "uuid-3",
      "actionType": "webhook:send",
      "success": false,
      "error": "Timeout after 30000ms"
    }
  ],
  "duration": 1520
}
```

**No Actions (200 OK):**

```json
{
  "success": true,
  "processed": 0,
  "results": [],
  "duration": 12
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

1. Fetch up to `batchSize` pending actions where `scheduledAt <= NOW()`
2. Mark each as `processing` (prevents duplicate execution)
3. Execute handler for each action
4. Update status to `completed` or `failed`
5. For recurring actions, schedule next occurrence

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

```
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
curl "http://localhost:5173/api/v1/devtools/scheduled-actions" \
  -H "Authorization: Bearer YOUR_API_KEY"
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
curl "http://localhost:5173/api/v1/devtools/scheduled-actions?status=pending" \
  -H "x-api-key: YOUR_API_KEY"

# Get completed webhook actions
curl "http://localhost:5173/api/v1/devtools/scheduled-actions?status=completed&action_type=webhook:send" \
  -H "x-api-key: YOUR_API_KEY"

# Get page 2 with 10 results
curl "http://localhost:5173/api/v1/devtools/scheduled-actions?page=2&limit=10" \
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
        "scheduledAt": "2024-01-15T10:30:00Z",
        "startedAt": null,
        "completedAt": null,
        "errorMessage": null,
        "attempts": 0,
        "recurringInterval": null,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
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
        "billing:check-renewals"
      ]
    }
  }
}
```

---

### `GET /api/v1/devtools/scheduled-actions/:id`

Get details of a specific action.

```bash
curl "http://localhost:5173/api/v1/devtools/scheduled-actions/uuid-123" \
  -H "Authorization: Bearer API_KEY"
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "actionType": "webhook:send",
    "status": "completed",
    "payload": {
      "eventType": "task:created",
      "entityType": "task",
      "entityId": "task-uuid",
      "data": { "title": "New Task" }
    },
    "teamId": "team-uuid",
    "scheduledAt": "2024-01-15T10:30:00Z",
    "startedAt": "2024-01-15T10:31:00Z",
    "completedAt": "2024-01-15T10:31:01Z",
    "errorMessage": null,
    "retryCount": 0,
    "recurringInterval": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:31:01Z"
  }
}
```

---

### `POST /api/v1/devtools/scheduled-actions`

Manually create a scheduled action (for testing).

```bash
curl -X POST "http://localhost:5173/api/v1/devtools/scheduled-actions" \
  -H "Authorization: Bearer API_KEY" \
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
    "scheduledAt": "2024-01-15T12:00:00Z"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actionType` | `string` | Yes | Handler type (e.g., `webhook:send`) |
| `payload` | `object` | Yes | Action-specific data |
| `teamId` | `string` | No | Team scope |
| `scheduledAt` | `string` | No | ISO 8601 date (default: now) |
| `recurringInterval` | `string` | No | For recurring: `hourly`, `daily`, etc. |

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
curl -X POST "http://localhost:5173/api/v1/devtools/scheduled-actions/uuid-123/retry" \
  -H "Authorization: Bearer API_KEY"
```

#### Response

```json
{
  "success": true,
  "message": "Action queued for retry",
  "data": {
    "id": "uuid-123",
    "status": "pending",
    "retryCount": 1
  }
}
```

---

### `DELETE /api/v1/devtools/scheduled-actions/:id`

Cancel/delete a pending action.

```bash
curl -X DELETE "http://localhost:5173/api/v1/devtools/scheduled-actions/uuid-123" \
  -H "Authorization: Bearer API_KEY"
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
  scheduledAt: new Date(Date.now() + 3600000)
})

// Schedule recurring action
const recurringId = await scheduleRecurringAction(
  'billing:check-renewals',
  {},
  'daily',
  { scheduledAt: new Date('2024-01-01T00:00:00Z') }
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
  options?: {
    scheduledAt?: Date
    teamId?: string
    recurringInterval?: string
  }
): Promise<string | null>

// Recurring action (always returns ID)
function scheduleRecurringAction(
  actionType: string,
  payload: unknown,
  interval: string,
  options?: {
    scheduledAt?: Date
    teamId?: string
  }
): Promise<string>

// Cancel pending action
function cancelScheduledAction(actionId: string): Promise<boolean>
```

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

**Last Updated**: 2025-12-30
**Version**: 1.0.0
**Status**: Complete
