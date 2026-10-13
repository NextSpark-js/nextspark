# Permissions and Roles

NextSpark implements a comprehensive role-based access control (RBAC) system integrated with user flags for granular permission management.

## User Roles

A user's global role is `users.role`. What a user can do inside a team comes from their **team** role (`owner`, `admin`,
`member`, ... in `permissions.config.ts`), not from this one.

### Role Hierarchy

```text
developer   (100)  every superadmin capability, plus /devtools
  └─ superadmin (99)  the admin area (/superadmin, /admin) and every team's data
      └─ member  (1)  their own data and their teams'
suspended            no session and no API key (set only by the suspend action)
```

### Role Definitions

| Role | Description |
|------|-------------|
| `member` | Default role of every new user |
| `superadmin` | System administration: the admin area, every user and team, RLS bypass (`can_bypass_rls()`) |
| `developer` | Everything a superadmin can do, plus devtools. Bypasses RLS like a superadmin (migration 036) |
| `suspended` | Set by `PATCH /api/superadmin/users/:id` `{ "action": "suspend" }`; sessions are deleted and API keys deactivated |

### Role Assignment

**On signup** every user gets the default role (`member`); a user cannot set their own role:

```typescript
// Better Auth additionalFields (lib/auth.ts)
role: {
  type: "string",
  required: false,
  input: false,  // Users cannot set their own role
  defaultValue: USER_ROLES_CONFIG.defaultRole
}
```

**Changing a role** goes through `PATCH /api/superadmin/users/:id` (`{ "action": "change-role", "role": ... }`), or
`role` in `PATCH /api/v1/users/:id` and `POST /api/v1/users`. The same rules apply on all three
(`lib/auth/assignable-roles.ts`):

| Rule | Answer otherwise |
|------|------------------|
| Only a superadmin or a developer changes a role | 403 |
| The roles assigned are `member` and `developer`; `superadmin` is never assigned through the API | 400 |
| **Only a developer grants `developer`** | 403 |
| Nobody changes their own role | 400 |
| Nobody changes or deletes another superadmin | 403 |
| A suspended user comes back only through `unsuspend` | 400 |

A superadmin is created by the owner directly in the database.

## User Flags

### Overview

User flags provide granular feature access beyond role-based permissions.

```typescript
type UserFlag = 
  | 'beta_tester'      // Access to beta features
  | 'early_adopter'    // Early access to new features
  | 'limited_access'   // Restricted feature set
  | 'vip'              // Premium features
  | 'restricted'       // Limited permissions
  | 'experimental'     // Experimental feature access
```

### Storage

Flags are stored in the `user_metas` table:

```sql
CREATE TABLE "user_metas" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "metaKey" TEXT NOT NULL,
  "metaValue" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "metaKey")
);

-- User flags stored as:
-- metaKey: 'user_flags'
-- metaValue: '["beta_tester", "vip"]' (JSON array)
```

### Managing Flags

```typescript
// Get user flags
const flags = await getUserFlags(userId)
// Returns: ['beta_tester', 'vip']

// Set user flags
await updateUserFlags(userId, ['beta_tester', 'vip', 'early_adopter'])

// Add flag
await addUserFlag(userId, 'experimental')

// Remove flag
await removeUserFlag(userId, 'limited_access')
```

### Flags in Session

Flags are automatically loaded into the session:

```typescript
// Available in session
session.user.flags // ['beta_tester', 'vip']
```

## Checking Permissions

### In Server Components

```typescript
import { auth } from '@nextsparkjs/core/lib/auth'
import { headers } from 'next/headers'

export default async function AdminPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  if (!session) {
    redirect('/login')
  }
  
  // Check role
  if (session.user.role !== 'admin') {
    redirect('/403')
  }
  
  return <AdminDashboard />
}
```

### In Client Components

```typescript
'use client'

import { useSession } from '@nextsparkjs/core/lib/auth-client'

export function FeatureComponent() {
  const { data: session } = useSession()
  
  // Check role
  const isAdmin = session?.user.role === 'admin'
  const isCollaborator = ['admin', 'colaborator'].includes(session?.user.role || '')
  
  // Check flags
  const hasBetaAccess = session?.user.flags?.includes('beta_tester')
  
  return (
    <div>
      {isAdmin && <AdminPanel />}
      {isCollaborator && <CollaboratorTools />}
      {hasBetaAccess && <BetaFeature />}
    </div>
  )
}
```

### In API Routes

```typescript
// api/admin/route.ts
import { auth } from '@nextsparkjs/core/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers
  })
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check role
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Admin-only logic
  return NextResponse.json({ data: 'Admin data' })
}
```

## Protecting Routes

### Middleware Protection

```typescript
// proxy.ts
import { auth } from '@nextsparkjs/core/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const roleProtectedRoutes: Record<string, string[]> = {
  '/admin': ['admin'],
  '/dashboard/settings': ['admin', 'colaborator'],
  '/dashboard': ['admin', 'colaborator', 'member']
}

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers
  })
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Check role-based access
  for (const [path, allowedRoles] of Object.entries(roleProtectedRoutes)) {
    if (request.nextUrl.pathname.startsWith(path)) {
      if (!allowedRoles.includes(session.user.role)) {
        return NextResponse.redirect(new URL('/403', request.url))
      }
    }
  }
  
  return NextResponse.next()
}
```

## Entity-Level Permissions

### Centralized in permissions.config.ts

Entity permissions are defined centrally in the theme's `permissions.config.ts`:

```typescript
// permissions.config.ts
entities: {
  customers: [
    { action: 'create', roles: ['owner', 'admin'] },
    { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'list', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'update', roles: ['owner', 'admin'] },
    { action: 'delete', roles: ['owner'], dangerous: true },
  ],
}
```

### Permission Check Flow

```text
1. Request to entity endpoint
   ↓
2. Authenticate user (session or API key)
   ↓
3. Load user role + flags
   ↓
4. Check entity permissions
   ↓
5. Verify RLS policies
   ↓
6. Check flag access (if configured)
   ↓
7. Grant/Deny access
```

## API Key Scopes

### Scope-Based Permissions

API keys use scope-based permissions:

```typescript
// API key scopes
{
  scopes: [
    'tasks:read',      // Read tasks
    'tasks:write',     // Create and update tasks
    'users:read',      // Read user information
    'admin:api-keys'   // Manage API keys
  ]
}
```

### Checking Scopes

```typescript
import { hasScope } from '@nextsparkjs/core/lib/api/auth'

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check specific scope
  if (!hasScope(auth, 'tasks:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  // Continue with logic
}
```

## Row-Level Security (RLS)

### Database-Level Isolation

RLS policies enforce data isolation at the PostgreSQL level:

```sql
-- Users can only see their own tasks
CREATE POLICY "tasks_select_own" ON "tasks"
  FOR SELECT
  USING ("userId" = public.get_auth_user_id());

-- Users can only create tasks for themselves
CREATE POLICY "tasks_insert_own" ON "tasks"
  FOR INSERT
  WITH CHECK ("userId" = public.get_auth_user_id());

-- Users can only update their own tasks
CREATE POLICY "tasks_update_own" ON "tasks"
  FOR UPDATE
  USING ("userId" = public.get_auth_user_id())
  WITH CHECK ("userId" = public.get_auth_user_id());

-- A superadmin or a developer deletes any task
CREATE POLICY "tasks_delete_admin" ON "tasks"
  FOR DELETE
  USING (public.can_bypass_rls());
```

### Helper Functions

```sql
-- The request user, from the app.user_id the application sets per transaction
public.get_auth_user_id()

-- True for a superadmin or a developer (migration 036); is_superadmin() is an alias
public.can_bypass_rls()
```

## Permission Utilities

### Helper Functions

```typescript
// core/lib/permissions.ts

export function hasRole(user: SessionUser, ...roles: string[]): boolean {
  return roles.includes(user.role)
}

export function hasFlag(user: SessionUser, flag: UserFlag): boolean {
  return user.flags?.includes(flag) || false
}

export function hasAnyFlag(user: SessionUser, ...flags: UserFlag[]): boolean {
  return flags.some(flag => user.flags?.includes(flag))
}

export function hasAllFlags(user: SessionUser, ...flags: UserFlag[]): boolean {
  return flags.every(flag => user.flags?.includes(flag))
}
```

### Usage

```typescript
import { hasRole, hasFlag } from '@nextsparkjs/core/lib/permissions'

const canManageUsers = hasRole(session.user, 'admin', 'colaborator')
const hasBetaAccess = hasFlag(session.user, 'beta_tester')
```

## Custom Permission Logic

### Hook-Based Permissions

```typescript
// Entity hooks for custom permission logic
hooks: {
  beforeCreate: [
    async (context) => {
      const { data, userId } = context
      
      // Custom permission check
      if (data.priority === 'critical' && !hasRole(user, 'admin')) {
        return {
          continue: false,
          error: 'Only admins can create critical tasks'
        }
      }
      
      return { continue: true }
    }
  ]
}
```

## Best Practices

### Principle of Least Privilege

```typescript
// ✅ Good: Minimal permissions (in permissions.config.ts)
entities: {
  projects: [
    { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'create', roles: ['owner', 'admin'] },
    { action: 'update', roles: ['owner', 'admin'] },
    { action: 'delete', roles: ['owner'], dangerous: true },
  ],
}

// ❌ Bad: Too permissive
entities: {
  projects: [
    { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'create', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'update', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'delete', roles: ['owner', 'admin', 'member', 'viewer'] },
  ],
}
```

### Defense in Depth

Always implement multiple security layers:

1. **Application Layer**: Role/flag checks in code
2. **API Layer**: Permission validation in endpoints
3. **Database Layer**: RLS policies

## Unified Permissions System

### Single Source of Truth

All permissions and custom roles are defined in `permissions.config.ts`:

```typescript
// config/permissions.config.ts
export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  roles: { ... },      // Custom roles (e.g., editor)
  teams: [ ... ],      // Team permissions (team.view, team.edit, etc.)
  entities: { ... },   // Entity CRUD permissions
  features: [ ... ],   // Feature permissions (page-builder, blog, etc.)
}
```

### Using canDoAction() (Recommended)

The unified way to check any permission type:

```typescript
import { PermissionService } from '@nextsparkjs/core/lib/services/permission.service'

// Team permissions
if (PermissionService.canDoAction('admin', 'team.edit')) {
  // Can edit team
}

// Entity permissions
if (PermissionService.canDoAction('member', 'customers.create')) {
  // Can create customers
}

// Feature permissions
if (PermissionService.canDoAction('editor', 'page-builder.access')) {
  // Can access page builder
}

// Owner has ALL permissions
PermissionService.canDoAction('owner', 'anything') // Always true
```

### Build-Time Optimization

All permissions are pre-computed at build time for O(1) runtime lookups:

```typescript
import { PermissionService } from '@nextsparkjs/core/lib/services/permission.service'

// O(1) permission check
if (PermissionService.hasPermission('admin', 'posts.create')) {
  // Allow action
}

// Get role permissions
const adminPerms = PermissionService.getRolePermissions('admin')
// Returns: ['posts.create', 'posts.read', 'team.view', ...]
```

### Permission Sources

The system merges permissions from four sources:

1. **Core System Permissions** (12 base permissions)
2. **Theme Team Permissions** (`permissions.config.ts → teams`)
3. **Theme Feature Permissions** (`permissions.config.ts → features`)
4. **Theme Entity Permissions** (`permissions.config.ts → entities`)

For detailed configuration, see **[Theme Permissions Configuration](./10-permissions-config.md)**.

## Extended Permission Model

When combined with the [Billing System](../19-billing/01-overview.md), permissions extend to a three-layer model:

```text
RESULT = Permission (RBAC) AND Feature (Plan) AND Quota (Limits)
```

- **Layer 1 - Permission (RBAC):** Does the user's role allow this action? (this page)
- **Layer 2 - Feature (Plan):** Does the subscription plan include this feature? (Billing)
- **Layer 3 - Quota (Limits):** Is there available quota for this action? (Billing)

See [Billing System Overview](../19-billing/01-overview.md) for complete details.

## Next Steps

1. **[Security Best Practices](./07-security-best-practices.md)** - Security implementation
2. **[Testing Authentication](./08-testing-authentication.md)** - Testing permissions
3. **[Extensible Roles](./09-extensible-roles.md)** - Theme role extension system
4. **[Theme Permissions Configuration](./10-permissions-config.md)** - Custom theme permissions
5. **[Billing System](../19-billing/01-overview.md)** - Feature and quota layers

---

> 💡 **Tip**: Use roles for broad access levels and flags for specific feature gates. Combine both for fine-grained control.
