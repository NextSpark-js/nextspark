---
title: Usage Tracking
description: Quota management, usage tracking, and reporting
---

# Usage Tracking

The billing system uses a hybrid 2-table model for efficient usage tracking and detailed reporting.

## Architecture

### Two-Table Model

| Table | Purpose | Query Pattern |
|-------|---------|---------------|
| `usage` | Aggregate counters | O(1) for quota checks |
| `usageEvents` | Detailed audit trail | Historical queries |

```sql
-- usage: Fast lookups
SELECT * FROM usage
WHERE "subscriptionId" = $1 AND "limitSlug" = $2 AND "periodKey" = $3

-- usageEvents: Detailed history
SELECT * FROM "usageEvents"
WHERE "userId" = $1
ORDER BY "createdAt" DESC
```

### Period Keys

Usage is tracked per period based on reset configuration:

| Reset Period | Period Key Format | Example |
|--------------|-------------------|---------|
| `never` | `'all_time'` | `all_time` |
| `daily` | `'YYYY-MM-DD'` | `2024-01-15` |
| `monthly` | `'YYYY-MM'` | `2024-01` |
| `yearly` | `'YYYY'` | `2024` |

## Tracking Usage

### UsageService.track()

```typescript
import { UsageService } from '@/core/lib/services'

// When user creates a project
await UsageService.track({
  teamId: 'team_123',
  userId: 'user_456',
  limitSlug: 'projects',
  delta: 1,  // +1 for creation
  action: 'projects.create',
  resourceType: 'project',
  resourceId: 'proj_789',
  metadata: { name: 'My Project' }
})

// When user deletes a project (release quota)
await UsageService.track({
  teamId: 'team_123',
  userId: 'user_456',
  limitSlug: 'projects',
  delta: -1,  // -1 for deletion
  action: 'projects.delete',
  resourceType: 'project',
  resourceId: 'proj_789'
})
```

### Parameters

```typescript
interface TrackUsageParams {
  teamId: string           // Team context
  userId: string           // User who performed action
  limitSlug: string        // Which limit to track
  delta: number            // Amount (+/-)
  action?: string          // Action performed
  resourceType?: string    // Type of resource
  resourceId?: string      // ID of resource
  metadata?: Record<string, unknown>
}
```

### Transaction Safety

Both tables are updated atomically by `UsageService.track()`:

```typescript
// UsageService handles transaction internally
await UsageService.track({
  teamId: 'team_123',
  userId: 'user_456',
  limitSlug: 'projects',
  delta: 1
})
// Both usage aggregate and usage_events are updated atomically
```

## Checking Quotas

### SubscriptionService.checkQuota()

```typescript
import { SubscriptionService } from '@/core/lib/services'

const quota = await SubscriptionService.checkQuota(teamId, 'projects')

console.log(quota)
// {
//   allowed: true,
//   current: 12,
//   max: 50,
//   remaining: 38,
//   percentUsed: 24
// }

if (!quota.allowed) {
  throw new Error('Project limit exceeded')
}
```

### Using MembershipService (Recommended)

For most cases, use `MembershipService` which provides the quota along with role and subscription context:

```typescript
import { MembershipService } from '@/core/lib/services'

const membership = await MembershipService.get(userId, teamId)
const quota = membership.checkQuota('projects')

if (!quota.allowed) {
  throw new Error('Project limit exceeded')
}
```

### Quota Response

```typescript
interface QuotaInfo {
  allowed: boolean    // Can create more?
  current: number     // Current usage
  max: number         // Maximum (-1 = unlimited)
  remaining: number   // How many left
  percentUsed: number // 0-100
}
```

### Unlimited Quotas

When `max: -1`:

```typescript
{
  allowed: true,
  current: 0,
  max: -1,
  remaining: Infinity,
  percentUsed: 0
}
```

## Reporting

### Team Usage Summary

```typescript
import { UsageService } from '@/core/lib/services'

const summary = await UsageService.getTeamSummary(teamId, '2024-01')

console.log(summary)
// {
//   byLimit: {
//     projects: { current: 12, limit: 50, percentUsed: 24 },
//     api_calls: { current: 4500, limit: 100000, percentUsed: 4.5 }
//   },
//   byUser: [
//     { userId: 'u1', userName: 'Alice', totalUsage: 8, percentage: 67 },
//     { userId: 'u2', userName: 'Bob', totalUsage: 4, percentage: 33 }
//   ],
//   topConsumers: [
//     { userId: 'u1', userName: 'Alice', totalUsage: 8, percentage: 67 }
//   ]
// }
```

### Usage by User

```typescript
import { UsageService } from '@/core/lib/services'

const breakdown = await UsageService.getTeamUsageByUser(teamId, '2024-01')
// Returns UserUsageSummary[]
```

### Top Consumers

```typescript
import { UsageService } from '@/core/lib/services'

const top = await UsageService.getTopConsumers(teamId, 'api_calls', '2024-01', 5)
// Returns TopConsumer[]
```

### User Timeline

```typescript
import { UsageService } from '@/core/lib/services'

const events = await UsageService.getUserTimeline(userId, {
  limitSlug: 'api_calls',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  limit: 100
})
// Returns UsageEvent[]
```

## UI Components

### UsageBar

Display usage progress:

```tsx
import { UsageBar } from '@/core/components/billing/UsageBar'

<UsageBar
  current={12}
  max={50}
  label="Projects"
  showPercentage
/>
```

### UsageDashboard

Full usage overview:

```tsx
import { UsageDashboard } from '@/core/components/billing/UsageDashboard'

<UsageDashboard teamId={teamId} />
```

## Lifecycle Jobs

### Monthly Reset

Usage with `resetPeriod: 'monthly'` is archived on the 1st:

```typescript
// core/lib/billing/jobs.ts

export async function resetMonthlyUsage(): Promise<JobResult> {
  const previousPeriodKey = getPreviousMonthKey()

  // Archive (mark, don't delete)
  await db.query(`
    UPDATE usage
    SET metadata = jsonb_set(metadata, '{archived}', 'true')
    WHERE "periodKey" = $1
  `, [previousPeriodKey])
}
```

### Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/billing/lifecycle",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## Downgrade Enforcement

### Soft Limit Policy

When a team downgrades and exceeds new limits:

1. **Downgrade allowed immediately**
2. **Existing resources remain accessible** (read-only for excess)
3. **New resources blocked** until under limit

```typescript
import { checkDowngrade, checkQuotaWithEnforcement } from '@/core/lib/billing/enforcement'

// Check before downgrade
const check = await checkDowngrade(teamId, 'free')
// {
//   canDowngrade: true,  // Soft limit: always allowed
//   overLimits: [
//     { limitSlug: 'projects', limitName: 'Projects', current: 50, newMax: 5, excess: 45 }
//   ],
//   warnings: ['Some resources exceed new plan limits...']
// }

// Enforcement after downgrade
const quota = await checkQuotaWithEnforcement(teamId, 'projects')
// {
//   allowed: false,
//   enforced: true,
//   enforcementReason: 'over_limit_after_downgrade'
// }
```

### DowngradeWarning Component

```tsx
import { DowngradeWarning } from '@/core/components/billing/DowngradeWarning'

<DowngradeWarning
  overLimitResources={[
    { limitSlug: 'projects', currentCount: 50, newLimit: 5 }
  ]}
  onConfirm={handleDowngrade}
  onCancel={closeModal}
/>
```

## Best Practices

### 1. Track on Success, Not Attempt

```typescript
// ❌ Wrong: Track before action
await trackUsage({ ... })
await createProject(data)  // Might fail!

// ✅ Correct: Track after success
const project = await createProject(data)
await trackUsage({
  delta: 1,
  resourceId: project.id
})
```

### 2. Handle Rollbacks

```typescript
// If project creation fails, release quota
try {
  const project = await createProject(data)
  await trackUsage({ delta: 1, ... })
} catch (error) {
  // Don't need to track negative if we tracked after success
  throw error
}
```

### 3. Use Negative Delta for Deletions

```typescript
// On resource deletion
await deleteProject(projectId)
await trackUsage({
  delta: -1,
  action: 'projects.delete',
  resourceId: projectId
})
```

### 4. Include Metadata

```typescript
// Rich metadata for reporting
await trackUsage({
  limitSlug: 'api_calls',
  delta: 1,
  metadata: {
    endpoint: '/api/v1/data',
    method: 'GET',
    responseTime: 45
  }
})
```

## Database Schema

### usage Table

```sql
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscriptionId" UUID REFERENCES subscriptions(id),
  "limitSlug" VARCHAR(50) NOT NULL,
  "periodKey" VARCHAR(20) NOT NULL,
  "currentValue" INTEGER NOT NULL DEFAULT 0,
  "lastIncrementAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  UNIQUE ("subscriptionId", "limitSlug", "periodKey")
);
```

### usageEvents Table

```sql
CREATE TABLE "usageEvents" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscriptionId" UUID REFERENCES subscriptions(id),
  "userId" UUID REFERENCES users(id),
  "teamId" UUID REFERENCES teams(id),
  "limitSlug" VARCHAR(50) NOT NULL,
  delta INTEGER NOT NULL,
  action VARCHAR(100),
  "resourceType" VARCHAR(50),
  "resourceId" UUID,
  "periodKey" VARCHAR(20) NOT NULL,
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_events_user ON "usageEvents" ("userId");
CREATE INDEX idx_usage_events_team ON "usageEvents" ("teamId");
CREATE INDEX idx_usage_events_period ON "usageEvents" ("periodKey");
```

## Related

- [Configuration](./02-configuration.md) - Limit definitions
- [API Reference](./04-api-reference.md) - Usage endpoints
- [Hooks & Context](./03-hooks-context.md) - Frontend access
