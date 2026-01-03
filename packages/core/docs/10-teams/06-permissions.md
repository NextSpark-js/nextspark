---
title: Permissions System
description: Role-based access control for teams
---

# Permissions System

The Teams system implements a two-tier permission model combining global user roles with team-specific roles.

> **Three-Layer Permission Model:** RBAC (this page) is **Layer 1** of a three-layer permission system. When combined with the [Billing System](../19-billing/01-overview.md), actions are validated as:
>
> ```
> RESULT = Permission (RBAC) AND Feature (Plan) AND Quota (Limits)
> ```
>
> - **Layer 1 - Permission (RBAC):** Does the user's team role allow this action? (this page)
> - **Layer 2 - Feature (Plan):** Does the subscription plan include this feature? ([Billing](../19-billing/))
> - **Layer 3 - Quota (Limits):** Is there available quota for this action? ([Usage Tracking](../19-billing/06-usage-tracking.md))
>
> All three layers must pass for an action to be allowed. See [Billing System Overview](../19-billing/01-overview.md) for details.

## Role Hierarchy

### Global Roles

Users have a global role stored in the `users` table:

| Role | Description |
|------|-------------|
| `member` | Default role for all users |
| `superadmin` | Full system access, bypasses RLS |

### Team Roles

Each team membership has a role stored in `team_members`:

| Role | Level | Description |
|------|-------|-------------|
| `owner` | 4 | Team creator, full control |
| `admin` | 3 | Can manage members and settings |
| `member` | 2 | Can create/edit own content |
| `viewer` | 1 | Read-only access |

## Permission Matrix

> **Important**: Permissions apply within the context of the configured Teams Mode. Some actions (like creating teams or inviting members) may be completely disabled at the mode level, regardless of the user's team role. See [Teams Modes](./01-overview.md#teams-modes) for details.

### Mode-Level Restrictions

Before checking team-level permissions, the system enforces mode-level restrictions:

| Action | single-user | single-tenant | multi-tenant |
|--------|-------------|---------------|--------------|
| Create new teams | ❌ | ❌ | ✅* |
| Switch teams | ❌ | ❌ | ✅ |
| Invite members | ❌ | ✅ | ✅ |
| Delete teams | ❌ | ❌ | ✅ |

*In multi-tenant mode, the `allowCreateTeams` option can further restrict team creation. See [Configuration](./09-configuration.md#allowcreateteams-option).

**Example**: Even if a user is a team `owner` in `single-tenant` mode, they cannot create additional teams because the mode restricts it.

### Team Management (Role-Based)

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View team details | ✅ | ✅ | ✅ | ✅ |
| Update team settings | ✅ | ✅ | ❌ | ❌ |
| Delete team | ✅* | ❌ | ❌ | ❌ |
| View team members | ✅ | ✅ | ✅ | ✅ |
| Invite members | ✅* | ✅* | ❌ | ❌ |
| Remove members | ✅ | ✅** | ❌ | ❌ |
| Change member roles | ✅ | ✅** | ❌ | ❌ |

*Subject to mode restrictions (see table above).
**Admins cannot modify other admins or the owner.

### Entity Access (with `access.shared: true`)

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View all team records | ✅ | ✅ | ✅ | ✅ |
| Create records | ✅ | ✅ | ✅ | ❌ |
| Edit any record | ✅ | ✅ | ❌ | ❌ |
| Edit own records | ✅ | ✅ | ✅ | ❌ |
| Delete any record | ✅ | ✅ | ❌ | ❌ |
| Delete own records | ✅ | ✅ | ✅ | ❌ |

### Entity Access (with `access.shared: false`)

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View own records | ✅ | ✅ | ✅ | ✅ |
| View others' records | ✅ | ✅ | ❌ | ❌ |
| Create records | ✅ | ✅ | ✅ | ❌ |
| Edit own records | ✅ | ✅ | ✅ | ❌ |
| Delete own records | ✅ | ✅ | ✅ | ❌ |

## Permission Utilities

### checkTeamPermission

The primary function for checking team permissions. Combines global role (superadmin bypass) with team role checks:

```typescript
import { checkTeamPermission, type UserRole, type TeamPermission } from '@/core/lib/teams/permissions'
import type { TeamRole } from '@/core/lib/teams/types'

// Check if user can edit the team
const canEdit = checkTeamPermission(
  'member' as UserRole,      // User's global role
  'admin' as TeamRole,       // User's team role
  'team.edit'                // Permission to check
)

// Superadmin bypasses all team permissions
const superadminCanDelete = checkTeamPermission(
  'superadmin',              // Superadmin global role
  null,                      // No team role needed
  'team.delete'              // Always returns true for superadmin
)
```

**Parameters:**
- `userRole: UserRole` - The user's global role (`'member'` or `'superadmin'`)
- `teamRole: TeamRole | null` - The user's role in the team (or `null` if not a member)
- `permission: TeamPermission` - The permission to check

**Returns:** `boolean` - `true` if user has the permission

### hasPermission

Check if a specific team role has a permission:

```typescript
import { hasPermission, type TeamPermission } from '@/core/lib/teams/permissions'
import type { TeamRole } from '@/core/lib/teams/types'

// Check role permission
const canInvite = hasPermission('admin', 'team.members.invite')  // true
const canDelete = hasPermission('admin', 'team.delete')          // false
const canBilling = hasPermission('owner', 'team.billing.manage') // true
```

**Parameters:**
- `role: TeamRole` - The team role to check
- `permission: TeamPermission` - The permission to check
- `isGlobalAdmin?: boolean` - If true, bypasses team role check (returns true)

### Available Permissions

```typescript
type TeamPermission =
  | 'team.view'              // View team details
  | 'team.edit'              // Edit team settings
  | 'team.delete'            // Delete the team
  | 'team.members.view'      // View team members
  | 'team.members.invite'    // Invite new members
  | 'team.members.remove'    // Remove members
  | 'team.members.update_role' // Change member roles
  | 'team.settings.view'     // View team settings
  | 'team.settings.edit'     // Edit team settings
  | 'team.billing.view'      // View billing info
  | 'team.billing.manage'    // Manage billing (owner only)
```

### Other Utility Functions

```typescript
import {
  isSuperadmin,
  canManageRole,
  getRoleDescription,
  isInvitableRole,
  getInvitableRoles,
  validateRoleTransition
} from '@/core/lib/teams/permissions'

// Check if user is superadmin
isSuperadmin('superadmin') // true

// Check if actor can manage target role
canManageRole('owner', 'admin')  // true (owner > admin)
canManageRole('admin', 'owner')  // false (admin < owner)

// Get human-readable role description
getRoleDescription('admin') // "Can manage members, settings, and most team operations"

// Get roles that can be assigned via invitation
getInvitableRoles() // ['admin', 'member', 'viewer']

// Validate role change
validateRoleTransition('member', 'admin', 'owner')
// { allowed: true }
```

## Permission Checks in API

### API Endpoint Pattern

```typescript
// app/api/v1/teams/[teamId]/members/route.ts
export async function POST(req: NextRequest, { params }) {
  const authResult = await authenticateRequest(req)

  if (!authResult.success) {
    return createApiError('Unauthorized', 401)
  }

  // Check team permission
  const member = await getTeamMember(
    authResult.user.id,
    params.teamId
  )

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return createApiError('Forbidden', 403)
  }

  // Proceed with invitation...
}
```

### React Hook Pattern

```typescript
import { useTeamContext } from '@/core/contexts/TeamContext'

function TeamSettings() {
  const { currentTeam, userTeams } = useTeamContext()

  // Find user's role in current team
  const membership = userTeams.find(
    m => m.team.id === currentTeam?.id
  )
  const userRole = membership?.role

  const canManageMembers = ['owner', 'admin'].includes(userRole)
  const canDeleteTeam = userRole === 'owner'

  return (
    <div>
      {canManageMembers && (
        <Button onClick={openInviteDialog}>Invite Member</Button>
      )}

      {canDeleteTeam && (
        <Button variant="destructive" onClick={deleteTeam}>
          Delete Team
        </Button>
      )}
    </div>
  )
}
```

## Superadmin Bypass

Superadmins bypass all team restrictions:

### Database Level (RLS)

```sql
-- RLS policies include superadmin bypass
CREATE POLICY "team_policy" ON public."teams"
  FOR ALL TO authenticated
  USING (
    id IN (SELECT "teamId" FROM team_members WHERE "userId" = get_auth_user_id())
    OR is_superadmin() -- Superadmin bypass
  );
```

### Application Level

```typescript
// Check for superadmin in API
if (authResult.user.role === 'superadmin') {
  // Skip permission checks
  return proceedWithAction()
}

// Normal permission check
const hasPermission = await checkTeamPermission(...)
```

## Entity Configuration

Configure entity access in the entity config:

```typescript
// Entity with shared access (all team members see all records)
const projectsConfig: EntityConfig = {
  slug: 'projects',
  access: {
    shared: true, // Everyone sees everything in the team
  },
  // ...
}

// Entity with private access (users see only their records)
const tasksConfig: EntityConfig = {
  slug: 'tasks',
  access: {
    shared: false, // Users only see their own tasks
  },
  // ...
}
```

## Permission Constants

```typescript
// core/lib/teams/permissions.ts

// Global user roles (Phase 2 simplification: only 2 roles)
export type UserRole = 'member' | 'superadmin'

// Team-specific permissions (string literals, not enum)
export type TeamPermission =
  | 'team.view'
  | 'team.edit'
  | 'team.delete'
  | 'team.members.view'
  | 'team.members.invite'
  | 'team.members.remove'
  | 'team.members.update_role'
  | 'team.settings.view'
  | 'team.settings.edit'
  | 'team.billing.view'
  | 'team.billing.manage'

// Role permissions matrix (internal, not exported directly)
// owner: all permissions
// admin: all except team.delete and team.billing.manage
// member: team.view, team.members.view, team.settings.view
// viewer: team.view, team.members.view
```

## Best Practices

### 1. Always Validate Server-Side

```typescript
// Never trust client-side role claims
// Always verify in API endpoints

// ❌ Bad: Trust client header
const role = req.headers.get('x-user-role')

// ✅ Good: Verify from database
const member = await getTeamMember(userId, teamId)
const role = member?.role
```

### 2. Use Permission Utilities

```typescript
// ❌ Bad: Hardcode role checks everywhere
if (role === 'owner' || role === 'admin') { ... }

// ✅ Good: Use permission utilities
if (hasPermission(role, Permission.INVITE_MEMBERS)) { ... }
```

### 3. Fail Closed

```typescript
// ❌ Bad: Allow if no role found
const role = member?.role || 'member'

// ✅ Good: Deny if no membership
if (!member) {
  return createApiError('Not a team member', 403)
}
```

### 4. Audit Sensitive Actions

```typescript
// Log permission-sensitive actions
console.log(`[AUDIT] User ${userId} changed role of ${memberId} to ${newRole}`)
```

## Server-Side Permission Validation

The permissions system implements server-side validation at the layout level using Next.js App Router. This ensures that permissions are checked **before** any page renders, providing security that cannot be bypassed by theme customizations.

### Entity Layout Validation

The `app/dashboard/(main)/[entity]/layout.tsx` validates entity permissions automatically:

```typescript
// This layout runs BEFORE any entity page renders
// Located at: app/dashboard/(main)/[entity]/layout.tsx

export default async function EntityPermissionLayout({
  children,
  params
}: EntityLayoutProps) {
  const { entity } = await params
  const headersList = await headers()
  const cookieStore = await cookies()

  // Get userId from middleware header
  const userId = headersList.get('x-user-id')

  // Get teamId from cookie (set by TeamContext on client)
  const teamId = cookieStore.get('activeTeamId')?.value

  // Detect required action from pathname
  const action = detectActionFromPathname(pathname, entity)
  const permission = `${entity}.${action}` as Permission

  // Check permission using core function
  const hasPermission = await checkPermission(userId, teamId, permission)

  if (!hasPermission) {
    redirect(`/dashboard/permission-denied?entity=${entity}&action=${action}`)
  }

  return <>{children}</>
}
```

### Action Detection from Routes

| Route Pattern | Detected Action |
|---------------|-----------------|
| `/dashboard/companies` | `list` |
| `/dashboard/companies/create` | `create` |
| `/dashboard/companies/123` | `read` |
| `/dashboard/companies/123/edit` | `update` |

### Cookie-Based Team Context

The team context is synchronized via cookies for server-side access:

1. **Client-side**: `TeamContext` stores `activeTeamId` in localStorage AND sets a cookie
2. **API call**: `/api/v1/teams/switch` sets `activeTeamId` cookie when switching teams
3. **Server layouts**: Read `activeTeamId` from cookies for permission checks

```typescript
// TeamContext sets cookie for server access
document.cookie = `activeTeamId=${teamId}; path=/; max-age=31536000; samesite=lax`

// Server layouts read from cookies
const teamId = cookieStore.get('activeTeamId')?.value
```

## Client-Side Permission Hooks

For UI-level permission checks (hiding buttons, disabling actions), use the permission hooks:

### usePermission

Check a single permission:

```typescript
import { usePermission } from '@/core/lib/permissions/hooks'
import type { Permission } from '@/core/lib/permissions/types'

function CreateButton({ entitySlug }: { entitySlug: string }) {
  const canCreate = usePermission(`${entitySlug}.create` as Permission)

  if (!canCreate) return null

  return <Button>Create {entitySlug}</Button>
}
```

### usePermissions

Check multiple permissions at once:

```typescript
import { usePermissions } from '@/core/lib/permissions/hooks'
import type { Permission } from '@/core/lib/permissions/types'

function EntityActions({ entitySlug }: { entitySlug: string }) {
  const { canUpdate, canDelete } = usePermissions({
    canUpdate: `${entitySlug}.update` as Permission,
    canDelete: `${entitySlug}.delete` as Permission,
  })

  return (
    <div>
      {canUpdate && <Button>Edit</Button>}
      {canDelete && <Button variant="destructive">Delete</Button>}
    </div>
  )
}
```

### Entity Components with Permission Checks

The core entity components (`EntityList`, `EntityDetail`) automatically check permissions:

```typescript
// EntityList hides Add button if user lacks create permission
const canCreate = usePermission(`${entityConfig.slug}.create` as Permission)
{canCreate && (
  <Button asChild>
    <Link href={`/dashboard/${entityConfig.slug}/create`}>
      <Plus className="mr-2 h-4 w-4" />
      Add {entityConfig.names.singular}
    </Link>
  </Button>
)}

// EntityDetail hides Edit/Delete buttons based on permissions
const { canUpdate, canDelete } = usePermissions({
  canUpdate: `${entityConfig.slug}.update` as Permission,
  canDelete: `${entityConfig.slug}.delete` as Permission,
})
```

### Two-Layer Permission Security

The system uses a two-layer approach for maximum security:

| Layer | Type | Purpose |
|-------|------|---------|
| **Server Layout** | Backend | Prevents access to routes entirely |
| **Permission Hooks** | Frontend | Hides UI elements user cannot use |

This ensures:
1. Users cannot bypass permissions by typing URLs directly
2. UI is clean and only shows actionable elements
3. Theme overrides cannot bypass security (layout is not overridable)

## Related Documentation

- [Database Schema](./02-database-schema.md) - RLS policies
- [API Reference](./03-api-reference.md) - Endpoint permissions
- [Entity Integration](./07-entity-integration.md) - Access configuration
- [Billing System](../19-billing/01-overview.md) - Feature and quota layers (Layers 2 & 3)
