---
title: Configuration
description: Scheduled Actions configuration options in app.config.ts
---

# Scheduled Actions Configuration

All Scheduled Actions settings are configured in `app.config.ts` under the `scheduledActions` key.

## Full Configuration Example

```typescript
// contents/themes/default/config/app.config.ts
export const APP_CONFIG_OVERRIDES = {
  scheduledActions: {
    // Enable/disable the entire system
    enabled: true,

    // Retention period for completed/failed actions (days)
    retentionDays: 7,

    // Maximum actions to process per cron run
    batchSize: 10,

    // Default timeout per action (milliseconds)
    defaultTimeout: 30000,

    // Concurrent action execution limit
    // 1 = sequential (safe default), >1 = parallel processing
    concurrencyLimit: 1,

    // Time-window deduplication settings
    deduplication: {
      windowSeconds: 5,
    },

    // Multi-endpoint webhook configuration
    webhooks: {
      endpoints: {
        default: {
          envVar: 'WEBHOOK_URL_DEFAULT',
          description: 'Default webhook for general notifications',
          patterns: ['*:*'],
          enabled: false,
        },
        tasks: {
          envVar: 'WEBHOOK_URL_TASKS',
          description: 'Task lifecycle notifications',
          patterns: ['task:created', 'task:updated', 'task:deleted'],
          enabled: true,
        },
        subscriptions: {
          envVar: 'WEBHOOK_URL_SUBSCRIPTIONS',
          description: 'Subscription lifecycle notifications',
          patterns: ['subscription:*'],
          enabled: true,
        },
      },
      defaultEndpoint: 'default',
    },
  },
}
```

## Configuration Options

### Basic Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable scheduled actions system |
| `retentionDays` | `number` | `7` | Days to keep completed/failed actions before cleanup |
| `batchSize` | `number` | `10` | Maximum actions processed per cron invocation |
| `defaultTimeout` | `number` | `30000` | Timeout per action in milliseconds |
| `concurrencyLimit` | `number` | `1` | Max parallel action executions (1 = sequential) |

### Deduplication Settings

Time-window deduplication prevents duplicate scheduled actions within a configurable window. When a duplicate is detected, the existing action's payload is automatically updated with the new data.

```typescript
deduplication: {
  windowSeconds: 5,   // Time window in seconds (0 to disable)
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `windowSeconds` | `number` | `5` | Seconds to look back for duplicates. Set to 0 to disable deduplication. |

**Behavior:**
- `windowSeconds > 0`: Duplicates within window update the existing action's payload
- `windowSeconds = 0`: Deduplication disabled (all actions created)

**Deduplication key:** `actionType + entityId + entityType` (from payload)

See [Deduplication](./06-deduplication.md) for detailed usage.

### Webhook Configuration

Multi-endpoint webhook routing allows different event types to go to different destinations.

```typescript
webhooks: {
  endpoints: {
    [endpointKey]: {
      envVar: string,        // Environment variable with URL
      description?: string,  // Human-readable description
      patterns?: string[],   // Event patterns to match
      enabled?: boolean,     // Enable/disable this endpoint
    }
  },
  defaultEndpoint?: string,  // Fallback endpoint key
}
```

| Option | Type | Description |
|--------|------|-------------|
| `envVar` | `string` | Name of env var containing the webhook URL |
| `description` | `string` | Optional description for documentation |
| `patterns` | `string[]` | Event patterns this endpoint handles |
| `enabled` | `boolean` | Whether this endpoint is active |

**Pattern Syntax:**
- `task:created` - Exact match
- `task:*` - Wildcard matches any event for `task` entity
- `*:created` - Matches any entity `created` event
- `*:*` - Catch-all (use for default endpoint)

See [Webhooks](./04-webhooks.md) for detailed routing rules.

## Environment Variables

### Cron Authentication

```env
# Required for /api/v1/cron/process endpoint
CRON_SECRET=your-secure-random-string
```

### Webhook URLs

URLs are stored in environment variables for security (never in config files):

```env
# Task webhooks (Zapier, n8n, custom endpoint)
WEBHOOK_URL_TASKS=https://hooks.zapier.com/hooks/catch/123/abc

# Subscription webhooks (payment processor, analytics)
WEBHOOK_URL_SUBSCRIPTIONS=https://api.stripe.com/webhooks/subscriptions

# Default fallback (optional)
WEBHOOK_URL_DEFAULT=https://your-webhook-server.com/events
```

## Type Definitions

The configuration types are defined in `core/lib/config/types.ts`:

```typescript
export interface ScheduledActionsConfig {
  enabled: boolean
  retentionDays: number
  batchSize: number
  defaultTimeout: number
  concurrencyLimit: number
  webhookUrl?: string  // @deprecated - use webhooks.endpoints
  webhooks?: WebhooksConfig
  deduplication?: {
    windowSeconds: number
  }
}

export interface WebhooksConfig {
  endpoints: Record<string, WebhookEndpointConfig>
  defaultEndpoint?: string
}

export interface WebhookEndpointConfig {
  envVar: string
  description?: string
  patterns?: string[]
  enabled?: boolean
}
```

## Accessing Configuration

Configuration is accessed via `APP_CONFIG_MERGED`:

```typescript
import { APP_CONFIG_MERGED } from '@/core/lib/config/config-sync'

// Check if enabled
if (APP_CONFIG_MERGED.scheduledActions?.enabled) {
  // System is enabled
}

// Get batch size
const batchSize = APP_CONFIG_MERGED.scheduledActions?.batchSize ?? 10

// Get deduplication settings
const dedupeWindow = APP_CONFIG_MERGED.scheduledActions?.deduplication?.windowSeconds ?? 5
```

## Best Practices

### 1. Use Environment Variables for URLs

Never hardcode webhook URLs in configuration:

```typescript
// ❌ Wrong
webhooks: {
  endpoints: {
    tasks: {
      url: 'https://hooks.zapier.com/...'  // Security risk!
    }
  }
}

// ✅ Correct
webhooks: {
  endpoints: {
    tasks: {
      envVar: 'WEBHOOK_URL_TASKS'  // Read from env at runtime
    }
  }
}
```

### 2. Disable Unused Endpoints

```typescript
endpoints: {
  default: {
    envVar: 'WEBHOOK_URL_DEFAULT',
    enabled: false,  // Disable if not needed
  }
}
```

### 3. Set Appropriate Timeouts

```typescript
// For quick webhooks
defaultTimeout: 10000  // 10 seconds

// For slow external APIs
defaultTimeout: 60000  // 60 seconds (max recommended)
```

### 4. Configure Retention Based on Compliance

```typescript
// Standard retention
retentionDays: 7

// Compliance requirements
retentionDays: 30  // Keep for audit trail

// Minimal footprint
retentionDays: 1   // Clean up quickly
```

## Related Documentation

- [Overview](./01-overview.md) - System introduction
- [Webhooks](./04-webhooks.md) - Webhook routing details
- [Deduplication](./06-deduplication.md) - Deduplication system

---

**Last Updated**: 2026-02-06
**Version**: 2.0.0
**Status**: Complete
