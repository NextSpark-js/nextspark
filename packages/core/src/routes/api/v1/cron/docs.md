# Cron API

Process scheduled actions via external cron service.

## Overview

The Cron API provides an endpoint for processing scheduled actions. This endpoint is designed to be called by an external cron service (e.g., cron-job.org, Vercel Cron, GitHub Actions) at regular intervals.

## Authentication

The endpoint is protected by `CRON_SECRET` header validation. This prevents unauthorized access while allowing external cron services to trigger processing.

**Required Header:**
```
x-cron-secret: your_cron_secret_value
```

## Endpoints

### Process Scheduled Actions
`GET /api/v1/cron/process`

Process pending scheduled actions and clean up old completed actions.

**Request Headers:**
```
x-cron-secret: {CRON_SECRET}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "processing": {
      "processed": 5,
      "succeeded": 4,
      "failed": 1,
      "details": [
        {
          "actionId": "action_123",
          "actionType": "send-email",
          "status": "completed",
          "duration": 150
        }
      ]
    },
    "cleanup": {
      "deletedCount": 12
    },
    "executionTime": 2345
  },
  "info": {
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CRON_SECRET` | Secret token for authentication | Yes |

### Recommended Setup

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

**External Cron Service:**
- URL: `https://your-domain.com/api/v1/cron/process`
- Method: GET
- Header: `x-cron-secret: {your_secret}`
- Frequency: Every 1 minute

## Processing Details

Each execution:
1. Validates `CRON_SECRET` header
2. Processes up to 10 pending actions
3. Cleans up actions older than 7 days
4. Returns processing results

## Scheduled Actions

Actions are registered in the `scheduled_actions` table and processed based on:
- `status = 'pending'`
- `scheduledAt <= now()`

Each action type has a registered handler that executes the business logic.

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | INVALID_CRON_SECRET | Missing or invalid cron secret |
| 500 | CRON_SECRET_NOT_CONFIGURED | CRON_SECRET env var not set |
| 500 | PROCESSING_ERROR | Error during action processing |

## Security Notes

- Never expose `CRON_SECRET` in client-side code
- Use HTTPS for the cron endpoint
- Consider IP allowlisting for additional security
- Monitor failed authentication attempts
