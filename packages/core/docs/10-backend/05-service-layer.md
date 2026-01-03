# Service Layer

## Introduction

The service layer provides a clean abstraction between API routes and database operations. Services encapsulate business logic, handle data validation, manage RLS context, and provide reusable methods for common operations.

## Architecture

### Service Layer Pattern

```text
┌─────────────────────────────────────────┐
│ API Routes                              │
│ ├─ Request validation                  │
│ ├─ Authentication check                │
│ └─ Call Service methods                │
├─────────────────────────────────────────┤
│ Service Layer                           │
│ ├─ Business logic                      │
│ ├─ Data validation                     │
│ ├─ RLS context management              │
│ ├─ Error handling                      │
│ └─ Return typed data                   │
├─────────────────────────────────────────┤
│ Database Layer (core/lib/db)           │
│ ├─ queryWithRLS                        │
│ ├─ mutateWithRLS                       │
│ └─ Connection pooling                  │
└─────────────────────────────────────────┘
```

**Benefits:**
- **Reusability**: Share logic across routes and components
- **Testability**: Easy to unit test business logic
- **Type Safety**: TypeScript interfaces for data consistency
- **Separation of Concerns**: Clear boundaries between layers
- **Centralized Validation**: Consistent error handling

---

## Core Services

### User Service

Location: `core/lib/services/user.service.ts`

**Purpose:** User management, profile updates, metadata operations

**Key Methods:**

```typescript
// Get user by ID or email
const user = await UserService.getUser(identifier, currentUserId);

// Get multiple users (avoids N+1)
const users = await UserService.getUsersByIds(userIds, currentUserId);

// Update user profile
const updated = await UserService.updateUser(
  userId,
  { firstName: 'John', lastName: 'Doe' },
  currentUserId
);

// User metadata operations
const metas = await UserService.getUserMetas(userId, currentUserId);
await UserService.updateUserMeta(userId, 'theme', 'dark', currentUserId);
```

### Meta Service

Location: `core/lib/services/meta.service.ts`

**Purpose:** Flexible metadata storage for any entity

**Key Methods:**

```typescript
// Get all metadata for an entity
const metas = await MetaService.getEntityMetas(
  'user',
  entityId,
  currentUserId
);

// Set single metadata value
await MetaService.setEntityMeta(
  'tasks',
  taskId,
  'priority',
  'high',
  currentUserId
);

// Bulk operations (prevents N+1)
const bulkMetas = await MetaService.getBulkEntityMetas(
  'user',
  userIds,
  currentUserId
);

// Search by metadata
const results = await MetaService.searchByMeta(
  'tasks',
  'status',
  'completed',
  currentUserId
);
```

### User Flags Service

Location: `core/lib/services/user-flags.service.ts`

**Purpose:** Feature flags and user permissions

**Key Methods:**

```typescript
// Check if user has flag
const canAccess = await UserFlagsService.hasFlag(
  userId,
  'beta_features',
  currentUserId
);

// Get all user flags
const flags = await UserFlagsService.getUserFlags(userId, currentUserId);

// Set flag value
await UserFlagsService.setFlag(
  userId,
  'notifications_enabled',
  true,
  currentUserId
);
```

---

## Billing & Team Services

Location: `core/lib/services/`

These services encapsulate all billing and team management logic, providing a clean API for subscriptions, usage tracking, invoices, and team operations.

### Service Overview

| Service | File | Purpose |
|---------|------|---------|
| **PlanService** | `plan.service.ts` | Plan queries, registry helpers, validations |
| **SubscriptionService** | `subscription.service.ts` | Subscriptions, features, quotas, lifecycle |
| **UsageService** | `usage.service.ts` | Usage tracking, quotas, trends |
| **InvoiceService** | `invoice.service.ts` | Invoice management, revenue reports |
| **TeamService** | `team.service.ts` | Team CRUD, slug management |
| **TeamMemberService** | `team-member.service.ts` | Membership, roles, permissions |

---

### PlanService

**Purpose:** Plan management and registry integration

```typescript
import { PlanService } from '@/core/lib/services'

// Get all public plans
const plans = await PlanService.list()

// Get plan by slug
const proPlan = await PlanService.getBySlug('pro')

// Get default (free) plan
const freePlan = await PlanService.getDefault()

// Registry helpers (synchronous, from config)
const features = PlanService.getFeatures('pro')
// => ['analytics', 'api_access', 'custom_domain']

const limits = PlanService.getLimits('pro')
// => { projects: 10, members: 5, storage_mb: 5000 }

// Check if upgrade
const isUpgrade = PlanService.isUpgrade('free', 'pro') // true
```

---

### SubscriptionService

**Purpose:** Subscription lifecycle, feature checks, quota management

```typescript
import { SubscriptionService } from '@/core/lib/services'

// Get subscription for team
const sub = await SubscriptionService.getByTeamId(teamId)
// Returns SubscriptionWithPlan (includes plan details)

// Check feature access
const hasAnalytics = await SubscriptionService.hasFeature(teamId, 'analytics')
if (!hasAnalytics) {
  throw new Error('Upgrade required')
}

// Check quota
const quota = await SubscriptionService.checkQuota(teamId, 'projects')
// => { allowed: true, current: 3, limit: 10, remaining: 7 }

// Unified permission check (features + quota + role)
const canCreate = await SubscriptionService.canPerformAction(
  userId,
  teamId,
  'create_project'
)
// => { allowed: true, reason: null } or { allowed: false, reason: 'quota_exceeded' }

// Change plan
const result = await SubscriptionService.changePlan(
  teamId,
  'enterprise',
  'yearly'
)
// => { subscription, previousPlan, newPlan, action: 'upgrade' }

// Lifecycle management
await SubscriptionService.pause(subscriptionId)
await SubscriptionService.resume(subscriptionId)
await SubscriptionService.cancel(subscriptionId)

// Query helpers
const expiringSoon = await SubscriptionService.listExpiringSoon(7) // Next 7 days
const byStatus = await SubscriptionService.listByStatus('active')
const byPlan = await SubscriptionService.listByPlan('enterprise')
```

---

### UsageService

**Purpose:** Usage tracking and quota enforcement

```typescript
import { UsageService } from '@/core/lib/services'

// Increment usage (e.g., when creating a project)
await UsageService.increment(subscriptionId, 'projects')
await UsageService.increment(subscriptionId, 'api_calls', 100)

// Decrement usage (e.g., when deleting)
await UsageService.decrement(subscriptionId, 'projects')

// Get current usage
const current = await UsageService.getCurrent(subscriptionId, 'projects')
// => 7

// Get all usage for subscription
const allUsage = await UsageService.getAll(subscriptionId)
// => [{ limitSlug: 'projects', currentUsage: 7 }, ...]

// Get usage by team (without needing subscriptionId)
const teamUsage = await UsageService.getByTeam(teamId, 'projects')

// Find subscriptions near quota (for alerts)
const nearLimit = await UsageService.listNearQuota(80) // 80% threshold
// => [{ subscriptionId, teamId, planSlug, limitSlug, current, limit, percentage }]

// Usage trend (for graphs)
const trend = await UsageService.getTrend(subscriptionId, 'api_calls', 6)
// => [{ period: '2024-01', usage: 1200 }, { period: '2024-02', usage: 1500 }, ...]

// Reset usage (for monthly limits)
await UsageService.reset(subscriptionId, 'api_calls')
```

---

### InvoiceService

**Purpose:** Invoice management and revenue tracking

```typescript
import { InvoiceService } from '@/core/lib/services'

// List invoices for team
const invoices = await InvoiceService.listByTeam(teamId, {
  limit: 10,
  offset: 0,
  status: 'paid'
})

// Get single invoice
const invoice = await InvoiceService.getByNumber('INV-2024-0001')

// Create invoice
const newInvoice = await InvoiceService.create({
  teamId,
  subscriptionId,
  amount: 99.00,
  currency: 'usd',
  description: 'Pro Plan - Monthly',
  status: 'pending'
})

// Update status
await InvoiceService.updateStatus(invoiceId, 'paid')

// Mark as paid with details
await InvoiceService.markAsPaid(invoiceId, {
  paymentMethod: 'card',
  transactionId: 'txn_123',
  paidAt: new Date()
})

// Query helpers
const overdue = await InvoiceService.listOverdue()
const inRange = await InvoiceService.listByDateRange('2024-01-01', '2024-12-31')
const lastInvoice = await InvoiceService.getLastForTeam(teamId)

// Revenue summary (for dashboards)
const revenue = await InvoiceService.getRevenueSummary(2024, 6)
// => { paid: 15000.00, pending: 2500.00, overdue: 500.00, total: 18000.00 }
```

---

### TeamService

**Purpose:** Team management and multi-tenancy

```typescript
import { TeamService } from '@/core/lib/services'

// Get team by ID or slug
const team = await TeamService.getById(teamId, userId)
const teamBySlug = await TeamService.getBySlug('acme-corp')

// Get team with member count
const teamWithCount = await TeamService.getWithMemberCount(teamId, userId)
// => { ...team, memberCount: 5 }

// Get user's teams
const myTeams = await TeamService.getUserTeams(userId)
// => [{ ...team, userRole: 'owner', memberCount: 5, joinedAt: '...' }]

// Create team (with default subscription)
const newTeam = await TeamService.create(userId, 'My Company')
// Automatically creates:
// - Team record
// - Owner membership
// - Free subscription

// Update team
await TeamService.update(teamId, {
  name: 'New Name',
  description: 'Updated description',
  settings: { timezone: 'UTC' }
}, userId)

// Slug management
const isAvailable = await TeamService.isSlugAvailable('acme-corp')
const slug = await TeamService.generateSlug('Acme Corporation')
// => 'acme-corporation' or 'acme-corporation-1' if taken

// Single-tenant mode
const globalTeam = await TeamService.getGlobal()
const hasGlobal = await TeamService.hasGlobal()

// Get team owner
const owner = await TeamService.getOwner(teamId)
// => { id, name, email, image }
```

---

### TeamMemberService

**Purpose:** Team membership and role management

```typescript
import { TeamMemberService } from '@/core/lib/services'

// List team members
const members = await TeamMemberService.listByTeam(teamId, requestingUserId)
// => [{ ...member, userName, userEmail, userImage }]

// Add member
await TeamMemberService.add(teamId, newUserId, 'member', {
  invitedBy: adminUserId
})

// Update role
await TeamMemberService.updateRole(teamId, userId, 'admin')

// Remove member
await TeamMemberService.remove(teamId, userId)

// Transfer ownership
await TeamMemberService.transferOwnership(
  teamId,
  newOwnerId,
  currentOwnerId
)

// Permission checks
const isMember = await TeamMemberService.isMember(teamId, userId)
const isOwner = await TeamMemberService.isOwner(teamId, userId)
const isAdmin = await TeamMemberService.isAdminOrOwner(teamId, userId)
const hasPermission = await TeamMemberService.hasPermission(
  userId,
  teamId,
  ['owner', 'admin']
)

// Filtering queries
const byRole = await TeamMemberService.listByRole(teamId, 'admin', requestingUserId)
const byUser = await TeamMemberService.listByUser(userId) // All teams for user
const search = await TeamMemberService.search(teamId, 'john', requestingUserId)
const recent = await TeamMemberService.getRecentlyJoined(teamId, 5, requestingUserId)
const invited = await TeamMemberService.listInvitedBy(teamId, inviterId, requestingUserId)

// Counts
const count = await TeamMemberService.count(teamId)
const byRoleCount = await TeamMemberService.countByRole(teamId)
// => { owner: 1, admin: 2, member: 5, viewer: 3 }
```

---

### Service Pattern Reference

All services follow this consistent pattern:

```typescript
/**
 * Entity Service
 *
 * Description of what this service manages.
 *
 * @module EntityService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import type { Entity } from '@/core/lib/entities/...'

export class EntityService {
  // ===========================================
  // QUERIES
  // ===========================================

  /**
   * Get entity by ID
   *
   * @param id - Entity ID
   * @param userId - User ID for RLS
   * @returns Entity or null
   *
   * @example
   * const entity = await EntityService.getById('123', userId)
   */
  static async getById(id: string, userId?: string): Promise<Entity | null> {
    // 1. Input validation
    if (!id || id.trim() === '') {
      throw new Error('Entity ID is required')
    }

    // 2. Query with RLS
    return queryOneWithRLS<Entity>(
      'SELECT * FROM "entities" WHERE id = $1',
      [id],
      userId
    )
  }

  // ===========================================
  // MUTATIONS
  // ===========================================

  static async create(data: CreatePayload, userId: string): Promise<Entity> {
    // Validation
    if (!data.name) {
      throw new Error('Name is required')
    }

    // Mutation
    const result = await mutateWithRLS<Entity>(
      `INSERT INTO "entities" (name) VALUES ($1) RETURNING *`,
      [data.name],
      userId
    )

    // Return check
    if (!result.rows[0]) {
      throw new Error('Failed to create entity')
    }

    return result.rows[0]
  }
}
```

**Key Principles:**
- Static methods (no instantiation)
- JSDoc with @param, @returns, @example
- Input validation at method start
- RLS integration via userId parameter
- Consistent error messages
- Grouped by QUERIES / MUTATIONS / CHECKS

---

## Theme Entity Services

In addition to core services, **each theme entity should have its own service** that encapsulates data access logic. This pattern separates SQL queries from templates and components.

### Location

```text
contents/themes/[theme]/entities/[entity]/
├── [entity].types.ts       # TypeScript interfaces
└── [entity].service.ts     # Data access service
```

### Pattern: Entity Service

```typescript
// contents/themes/default/entities/posts/posts.service.ts

import { query, queryOne, queryOneWithRLS, queryWithRLS } from '@/core/lib/db'
import type { PostPublic, PostMetadata, PostListResult } from './posts.types'

export class PostsService {
  // ============================================
  // PUBLIC METHODS (sin RLS)
  // ============================================

  /**
   * Get published post by slug (public access)
   * Uses query() without RLS for public pages
   */
  static async getPublishedBySlug(slug: string): Promise<PostPublic | null> {
    try {
      if (!slug || slug.trim() === '') {
        throw new Error('Post slug is required')
      }

      return await queryOne<PostPublic>(
        `SELECT id, slug, title, excerpt, blocks, "createdAt"
         FROM posts
         WHERE slug = $1 AND status = 'published'`,
        [slug]
      )
    } catch (error) {
      console.error('PostsService.getPublishedBySlug error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch post')
    }
  }

  /**
   * Get post metadata for SEO (lightweight query)
   */
  static async getPublishedMetadata(slug: string): Promise<PostMetadata | null> {
    // Lightweight query for generateMetadata()
    return queryOne<PostMetadata>(
      `SELECT title, "seoTitle", "seoDescription", "ogImage"
       FROM posts WHERE slug = $1 AND status = 'published'`,
      [slug]
    )
  }

  // ============================================
  // AUTHENTICATED METHODS (con RLS)
  // ============================================

  /**
   * Get post by ID (requires authentication)
   * Uses queryOneWithRLS() for dashboard access
   */
  static async getById(id: string, userId: string): Promise<PostPublic | null> {
    try {
      if (!id || !userId) {
        throw new Error('Post ID and User ID are required')
      }

      return await queryOneWithRLS<PostPublic>(
        `SELECT id, slug, title, excerpt, blocks, "createdAt"
         FROM posts WHERE id = $1`,
        [id],
        userId
      )
    } catch (error) {
      console.error('PostsService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch post')
    }
  }
}
```

### Usage in Templates

```typescript
// contents/themes/default/templates/(public)/blog/[slug]/page.tsx

import { PostsService } from '@/contents/themes/default/entities/posts/posts.service'

// Lightweight metadata query
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const metadata = await PostsService.getPublishedMetadata((await params).slug)
  if (!metadata) return { title: 'Not Found' }

  return {
    title: metadata.seoTitle || metadata.title,
    description: metadata.seoDescription,
  }
}

// Full data query
export default async function BlogPost({ params }: PageProps) {
  const post = await PostsService.getPublishedBySlug((await params).slug)
  if (!post) notFound()

  return <PostRenderer post={post} />
}
```

### When to Use Public vs Authenticated Methods

| Method Type | RLS | Use Case |
|-------------|-----|----------|
| Public (`query`) | No | Public pages, SEO, anonymous access |
| Authenticated (`queryWithRLS`) | Yes | Dashboard, user-specific data |

### Entity Service Examples

The default theme includes services for all entities:

| Entity | Service Location |
|--------|------------------|
| Posts | `contents/themes/default/entities/posts/posts.service.ts` |
| Pages | `contents/themes/default/entities/pages/pages.service.ts` |
| Customers | `contents/themes/default/entities/customers/customers.service.ts` |
| Tasks | `contents/themes/default/entities/tasks/tasks.service.ts` |

---

## Registry Services

In addition to data-access services, the codebase includes **Registry Services** that wrap auto-generated registries. These services provide query functions for configuration data that is generated at build time.

### Purpose

Registry Services encapsulate queries against auto-generated registries (located in `core/lib/registries/`). This follows the data-only registry pattern:

- **Registries** export only data constants and types
- **Services** provide query functions with proper typing

### Available Registry Services

| Service | Registry | Purpose |
|---------|----------|---------|
| `ThemeService` | `theme-registry.ts` | Theme configs, entities, routes |
| `MiddlewareService` | `middleware-registry.ts` | Theme middleware handlers |
| `EntityTypeService` | `entity-registry.ts` | Entity configs, search types |
| `NamespaceService` | `namespace-registry.ts` | Route namespaces |
| `ScopeService` | `scope-registry.ts` | API scopes, restrictions |
| `RouteHandlerService` | `route-registry.ts` | Route handlers |

### Pattern: Registry Service

```typescript
// core/lib/services/middleware.service.ts

import {
  MIDDLEWARE_REGISTRY,
  MIDDLEWARE_METADATA,
  type MiddlewareRegistryEntry
} from '@/core/lib/registries/middleware-registry'

export class MiddlewareService {
  // ============== Lookup Methods ==============

  /** Get middleware for specific theme - O(1) */
  static getByTheme(themeName: string): MiddlewareRegistryEntry | undefined {
    return MIDDLEWARE_REGISTRY[themeName]
  }

  /** Get all registered middlewares */
  static getAll(): MiddlewareRegistryEntry[] {
    return Object.values(MIDDLEWARE_REGISTRY)
  }

  /** Check if theme has middleware - O(1) */
  static hasMiddleware(themeName: string): boolean {
    return themeName in MIDDLEWARE_REGISTRY && MIDDLEWARE_REGISTRY[themeName].exists
  }

  // ============== Execution Methods ==============

  /** Execute theme middleware with error handling */
  static async execute(
    themeName: string,
    request: NextRequest,
    coreSession?: SessionUser | null
  ): Promise<NextResponse | null> {
    const entry = MIDDLEWARE_REGISTRY[themeName]
    if (!entry?.exists) return null

    try {
      return await entry.middleware(request, coreSession)
    } catch (error) {
      console.error(`Error executing middleware for theme '${themeName}':`, error)
      return null
    }
  }
}
```

### Usage Examples

```typescript
import { ThemeService, MiddlewareService } from '@/core/lib/services'

// Theme queries
const theme = ThemeService.getTheme('default')
const dashboard = ThemeService.getDashboardConfig('default')
const themesWithEntities = ThemeService.getThemesWithEntities()

// Middleware queries
if (MiddlewareService.hasMiddleware(activeTheme)) {
  const response = await MiddlewareService.execute(activeTheme, request)
}

// Entity type queries
import { EntityTypeService } from '@/core/lib/services'
const searchTypes = EntityTypeService.getSearchTypes('default')
const entities = EntityTypeService.getEntitiesByCapability('hasBlocks')
```

### Key Differences from Data Services

| Aspect | Data Services | Registry Services |
|--------|--------------|-------------------|
| **Data Source** | Database (PostgreSQL) | Build-time generated registries |
| **Sync/Async** | Async (database queries) | Sync (in-memory lookups) |
| **RLS** | Uses `queryWithRLS` | N/A (config data) |
| **Updates** | Runtime mutations | Regenerate with `build-registry.mjs` |
| **Performance** | O(n) queries | O(1) lookups |

### Regenerating Registries

When theme or entity configurations change:

```bash
node core/scripts/build/registry.mjs
```

This regenerates all `core/lib/registries/*.ts` files.

---

## Best Practices

### Do's ✅

**1. Always Pass userId for RLS**
```typescript
static async getTask(taskId: string, userId: string) {
  return queryWithRLS('SELECT * FROM tasks WHERE id = $1', [taskId], userId);
}
```

**2. Validate Input**
```typescript
if (!userId || userId.trim() === '') {
  throw new Error('User ID is required');
}
```

**3. Use TypeScript Types**
```typescript
static async getTask(id: string, userId: string): Promise<Task | null> {
  // ...
}
```

**4. Handle Errors Gracefully**
```typescript
try {
  return await queryWithRLS(...);
} catch (error) {
  console.error('Service error:', error);
  throw new Error(
    error instanceof Error ? error.message : 'Operation failed'
  );
}
```

**5. Use Bulk Operations**
```typescript
const entities = await queryWithRLS(
  'SELECT * FROM entities WHERE id = ANY($1)',
  [ids],
  userId
);
```

### Don'ts ❌

**1. Never Bypass RLS**
```typescript
// ❌ BAD
const tasks = await query('SELECT * FROM tasks');

// ✅ GOOD
const tasks = await queryWithRLS('SELECT * FROM tasks', [], userId);
```

**2. Never Query in Loops**
```typescript
// ❌ BAD
for (const id of ids) {
  await queryWithRLS('SELECT * FROM tasks WHERE id = $1', [id], userId);
}

// ✅ GOOD
await queryWithRLS('SELECT * FROM tasks WHERE id = ANY($1)', [ids], userId);
```

---

## Summary

**Key Concepts:**
- Services abstract business logic from API routes
- Always use RLS context (userId parameter)
- Type-safe interfaces for consistency
- Centralized error handling
- Reusable across application

**See:** [User Service implementation](../../lib/services/user.service.ts)

**Next:** [Middleware](./06-middleware.md)

---

**Last Updated**: 2025-12-26
**Version**: 2.0.0
**Status**: Complete
