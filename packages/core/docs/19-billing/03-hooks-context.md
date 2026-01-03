---
title: Hooks & Context
description: React hooks and context for billing integration
---

# Hooks & Context

The billing system provides React hooks and context for seamless frontend integration.

## SubscriptionContext

The `SubscriptionContext` provides subscription data to all child components.

### Provider Setup

The provider should wrap your authenticated routes:

```tsx
// Already included in the default layout
import { SubscriptionProvider } from '@/core/contexts/SubscriptionContext'

function AuthenticatedLayout({ children }) {
  return (
    <TeamProvider>
      <SubscriptionProvider>
        {children}
      </SubscriptionProvider>
    </TeamProvider>
  )
}
```

> **Note:** `SubscriptionProvider` depends on `TeamProvider` - it fetches the subscription for the current team.

### Context Value

```typescript
interface SubscriptionContextValue {
  // Subscription data
  subscription: SubscriptionWithPlan | null
  plan: Plan | null
  planSlug: string | null
  status: SubscriptionStatus | null

  // Status helpers
  isTrialing: boolean
  isActive: boolean
  isPastDue: boolean
  isCanceled: boolean
  isLoading: boolean
  error: Error | null

  // Cached data (for sync access)
  features: string[]
  limits: Record<string, LimitInfo>

  // Actions
  refetch: () => void
}
```

## Hooks

### useSubscription

Access subscription data directly:

```tsx
import { useSubscription } from '@/core/hooks/useSubscription'

function SubscriptionStatus() {
  const {
    plan,
    status,
    isActive,
    isTrialing,
    isPastDue,
    isLoading
  } = useSubscription()

  if (isLoading) return <Spinner />

  return (
    <div>
      <p>Plan: {plan?.name}</p>
      <p>Status: {status}</p>
      {isTrialing && <Badge>Trial</Badge>}
      {isPastDue && <Badge variant="destructive">Past Due</Badge>}
    </div>
  )
}
```

### useFeature

Check if a feature is available (sync, uses cached data):

```tsx
import { useFeature } from '@/core/hooks/useFeature'

function AdvancedAnalytics() {
  const hasAdvanced = useFeature('advanced_analytics')

  if (!hasAdvanced) {
    return <UpgradePrompt feature="advanced_analytics" />
  }

  return <AdvancedAnalyticsChart />
}
```

### useQuota

Check quota usage for a specific limit (async, TanStack Query):

```tsx
import { useQuota } from '@/core/hooks/useQuota'

function ProjectsSection() {
  const { allowed, current, max, remaining, percentUsed, isLoading, refetch } = useQuota('projects')

  if (isLoading) return <Spinner />

  return (
    <div>
      <UsageBar current={current} max={max} label="Projects" />

      {!allowed && (
        <Alert variant="warning">
          Project limit reached ({current}/{max}). Upgrade to create more.
        </Alert>
      )}

      <Button
        onClick={() => createProject()}
        disabled={!allowed}
      >
        Create Project
      </Button>
    </div>
  )
}
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `allowed` | `boolean` | Can create more? |
| `current` | `number` | Current usage |
| `max` | `number` | Maximum (-1 = unlimited) |
| `remaining` | `number` | How many left |
| `percentUsed` | `number` | 0-100 |
| `isLoading` | `boolean` | Query loading state |
| `error` | `Error \| null` | Query error |
| `refetch` | `() => void` | Refresh quota |

**Note:** Unlike `useMembership.getQuota()` which returns cached plan limits, `useQuota` fetches **current usage** from the server.

### useMembership

Unified hook combining subscription, features, limits, and permission checks:

```tsx
import { useMembership } from '@/core/hooks/useMembership'

function ProjectCreator() {
  const membership = useMembership()

  // Sync feature check (uses cached features)
  const canCreateProjects = membership.hasFeature('projects')

  // Sync quota info (plan limits)
  const projectLimit = membership.getQuota('projects')

  // Async full quota with current usage
  const checkQuota = async () => {
    const quota = await membership.getQuotaAsync('projects')
    console.log(`${quota.current}/${quota.max} projects`)
  }

  // Unified permission check (RBAC + Feature + Quota)
  const createProject = async () => {
    const result = await membership.canDo('projects.create')

    if (!result.allowed) {
      toast.error(`Cannot create project: ${result.reason}`)
      return
    }

    // Proceed with creation...
  }

  return (
    <div>
      <p>Max projects: {projectLimit?.max ?? 'Unlimited'}</p>
      <Button onClick={createProject} disabled={!canCreateProjects}>
        Create Project
      </Button>
    </div>
  )
}
```

## useMembership API Reference

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `plan` | `Plan \| null` | Current plan details |
| `subscription` | `Subscription \| null` | Subscription record |
| `status` | `SubscriptionStatus \| null` | Current status |
| `isTrialing` | `boolean` | In trial period |
| `isActive` | `boolean` | Active subscription |
| `isPastDue` | `boolean` | Payment failed |
| `isCanceled` | `boolean` | Canceled subscription |
| `isLoading` | `boolean` | Loading state |

### Methods

#### hasFeature(featureSlug: string): boolean

Check if the current plan includes a feature.

```typescript
// Synchronous - uses cached features array
const canUseSSO = membership.hasFeature('sso')
```

**Returns:** `true` if feature is included, `false` otherwise.

#### getQuota(limitSlug: string): LimitInfo | null

Get limit configuration for the current plan.

```typescript
// Synchronous - uses cached limits
const limit = membership.getQuota('projects')
// { max: 50, resetPeriod: 'never' }
```

**Returns:** Limit info or `null` if not configured.

#### getQuotaAsync(limitSlug: string): Promise<QuotaInfo | null>

Get full quota info including current usage.

```typescript
// Asynchronous - fetches current usage from server
const quota = await membership.getQuotaAsync('projects')
// {
//   allowed: true,
//   current: 12,
//   max: 50,
//   remaining: 38,
//   percentUsed: 24
// }
```

**Returns:** Complete quota info or `null` on error.

#### canDo(action: string): Promise<{ allowed: boolean; reason?: string }>

Check if an action is allowed (combines RBAC + Feature + Quota).

```typescript
const result = await membership.canDo('projects.create')

if (!result.allowed) {
  // Possible reasons:
  // - 'no_permission' (RBAC failed)
  // - 'feature_not_in_plan' (plan doesn't have feature)
  // - 'quota_exceeded' (limit reached)
  // - 'Failed to check action permission' (API error)
}
```

**Returns:** Object with `allowed` boolean and optional `reason`.

#### refetch(): void

Manually refresh subscription data.

```typescript
// After upgrade/downgrade
await processUpgrade()
membership.refetch()
```

## Components

### FeatureGate

Declarative feature gating component:

```tsx
import { FeatureGate } from '@/core/components/billing/FeatureGate'

function Settings() {
  return (
    <div>
      <FeatureGate feature="advanced_analytics">
        {/* Only shown if plan has advanced_analytics */}
        <AdvancedSettings />
      </FeatureGate>

      <FeatureGate
        feature="sso"
        fallback={<SSOUpgradeCard />}
        showUpgradePrompt={true}
        onUpgrade={() => openUpgradeModal()}
      >
        <SSOConfiguration />
      </FeatureGate>
    </div>
  )
}
```

### FeatureGate Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `feature` | `string` | required | Feature slug to check |
| `children` | `ReactNode` | required | Content to show if feature available |
| `fallback` | `ReactNode` | `null` | Alternative content |
| `showUpgradePrompt` | `boolean` | `true` | Show upgrade alert |
| `onUpgrade` | `() => void` | - | Upgrade button callback |

## Best Practices

### 1. Use Sync Methods When Possible

```typescript
// Good - sync, uses cached data
const hasFeature = membership.hasFeature('api_access')

// Use async only when you need current usage
const quota = await membership.getQuotaAsync('api_calls')
```

### 2. Check Before Actions

```typescript
async function handleAction() {
  const result = await membership.canDo('action.name')

  if (!result.allowed) {
    handleDenied(result.reason)
    return
  }

  await performAction()
}
```

### 3. Use FeatureGate for UI

```tsx
// Don't: Manual check in render
{hasFeature && <FeatureUI />}

// Do: Declarative component
<FeatureGate feature="advanced">
  <FeatureUI />
</FeatureGate>
```

### 4. Refetch After Changes

```typescript
// After upgrade/downgrade
await processPayment()
membership.refetch()
```

## Server-Side Usage

For server-side checks, use the `MembershipService` which provides unified access to role, subscription, features, and quotas:

```typescript
import { MembershipService } from '@/core/lib/services'

// In API route
export async function POST(request: NextRequest) {
  const { teamId, userId } = await getAuthContext(request)

  // Get unified membership context
  const membership = await MembershipService.get(userId, teamId)

  // Check feature (sync)
  const hasAPI = membership.hasFeature('api_access')

  // Check quota
  const quota = membership.checkQuota('api_calls')

  // Unified action check (RBAC + Feature + Quota)
  const result = membership.canPerformAction('api.call')

  if (!result.allowed) {
    return Response.json({
      error: result.message,
      reason: result.reason
    }, { status: 403 })
  }

  // Proceed...
}
```

## Related

- [API Reference](./04-api-reference.md) - Server endpoints
- [Usage Tracking](./06-usage-tracking.md) - Quota management
- [Configuration](./02-configuration.md) - Action mappings
