# Entity Permission System

The permission system controls which users can perform which actions on each entity, integrating role-based control with the centralized permissions registry.

## Architecture Overview

Entity permissions are defined **centrally** in `permissions.config.ts`, not in individual entity config files. This provides a single source of truth for all permissions.

```
permissions.config.ts  →  Registry Generator  →  permissions-registry.ts  →  PermissionService
       ↓                                                                           ↓
   Define roles                                                              hasPermission()
   per action                                                                canPerformAction()
```

## Defining Entity Permissions

### In permissions.config.ts

All entity permissions are defined in the theme's `permissions.config.ts`:

```typescript
// contents/themes/{theme}/permissions.config.ts
import type { ThemePermissionsConfig } from '@/core/lib/permissions/types'

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // Entity permissions - centralized definition
  entities: {
    customers: [
      { action: 'create', label: 'Create customers', description: 'Can create new customers', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View customers', description: 'Can view customer details', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'list', label: 'List customers', description: 'Can see the customers list', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'update', label: 'Edit customers', description: 'Can modify customer information', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete customers', description: 'Can delete customers', roles: ['owner'], dangerous: true },
    ],
    tasks: [
      { action: 'create', label: 'Create tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete tasks', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', label: 'Assign tasks', roles: ['owner', 'admin'] }, // custom action
    ],
  },

  // Feature permissions
  features: [...],

  // UI sections
  uiSections: [...],
}
```

### Permission ID Format

Entity permissions use the format `{entity}.{action}`:

- `customers.create`
- `customers.read`
- `tasks.delete`
- `posts.publish`

## Available Team Roles

The system uses team-based roles defined in `app.config.ts`:

| Role | Level | Description |
|------|-------|-------------|
| `owner` | 4 | Team owner, full control, all permissions |
| `admin` | 3 | Administrator, most permissions |
| `member` | 2 | Standard team member |
| `viewer` | 1 | Read-only access |
| `editor`* | Custom | Theme-defined custom role |

*Custom roles like `editor` are defined per-theme in `app.config.ts`

## Standard Actions

| Action | Description | Typical Roles |
|--------|-------------|---------------|
| `create` | Create new records | owner, admin, member |
| `read` | View record details | owner, admin, member, viewer |
| `list` | See records list | owner, admin, member, viewer |
| `update` | Modify records | owner, admin, member |
| `delete` | Delete records | owner, admin |

## Custom Actions

Define entity-specific actions beyond CRUD:

```typescript
entities: {
  posts: [
    // Standard CRUD
    { action: 'create', roles: ['owner', 'admin', 'member'] },
    { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'update', roles: ['owner', 'admin', 'member'] },
    { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
    // Custom actions
    { action: 'publish', label: 'Publish Posts', roles: ['owner', 'admin'] },
    { action: 'schedule', label: 'Schedule Posts', roles: ['owner', 'admin'] },
  ],
  opportunities: [
    // ... CRUD ...
    { action: 'assign', label: 'Assign opportunities', roles: ['owner', 'admin'] },
    { action: 'move_stage', label: 'Move stage', roles: ['owner', 'admin'] },
    { action: 'close', label: 'Close opportunities', roles: ['owner', 'admin'] },
  ],
}
```

## Checking Permissions

### In API Routes

```typescript
import { MembershipService } from '@/core/lib/services'

export async function POST(request: Request) {
  const membership = await MembershipService.get(userId, teamId)

  // Check permission (includes RBAC + billing layers)
  const result = membership.canPerformAction('customers.create')

  if (!result.allowed) {
    return NextResponse.json({ error: result.reason }, { status: 403 })
  }

  // Continue with creation...
}
```

### In Components

```typescript
'use client'

import { usePermission, usePermissions } from '@/core/lib/permissions/hooks'

export function CustomerActions({ customer }) {
  const canUpdate = usePermission('customers.update')
  const canDelete = usePermission('customers.delete')

  // Or check multiple at once
  const { canUpdate, canDelete } = usePermissions({
    canUpdate: 'customers.update',
    canDelete: 'customers.delete',
  })

  return (
    <div>
      {canUpdate && <Button onClick={handleEdit}>Edit</Button>}
      {canDelete && <Button onClick={handleDelete} variant="destructive">Delete</Button>}
    </div>
  )
}
```

### Using PermissionService Directly

```typescript
import { PermissionService } from '@/core/lib/services'

// O(1) lookup - pre-computed at build time
const canCreate = PermissionService.hasPermission('admin', 'customers.create')

// Get all permissions for a role
const adminPerms = PermissionService.getRolePermissions('admin')
```

## Row-Level Security (RLS)

RLS is the database-level security layer in PostgreSQL.

### Data per User (`shared: false`)

Each user sees only their records:

```sql
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON "tasks"
  FOR SELECT
  USING ("userId" = auth.uid());
```

### Shared Data (`shared: true`)

All team members see all records:

```sql
CREATE POLICY "tasks_select_team" ON "tasks"
  FOR SELECT
  USING (
    "teamId" IN (
      SELECT "teamId" FROM "team_members"
      WHERE "userId" = auth.uid()
    )
  );
```

### Public Data (`public: true`)

Anonymous users can read:

```sql
CREATE POLICY "posts_select_public" ON "posts"
  FOR SELECT
  USING ("status" = 'published');
```

## Build-Time Registry

Permissions are pre-computed during build for O(1) runtime:

```bash
node core/scripts/build/registry.mjs
```

This generates `core/lib/registries/permissions-registry.ts` with:

- Pre-computed role matrices
- Category indices for UI
- Full matrix for Admin Panel visualization

## Permission Scenarios

### Scenario 1: Private Entity (Personal Tasks)

```typescript
entities: {
  tasks: [
    { action: 'create', roles: ['owner', 'admin', 'member'] },
    { action: 'read', roles: ['owner', 'admin', 'member'] },
    { action: 'update', roles: ['owner', 'admin', 'member'] },
    { action: 'delete', roles: ['owner', 'admin', 'member'] },
  ],
}
// Combined with access.shared: false in entity config
```

### Scenario 2: Shared Workspace Entity

```typescript
entities: {
  projects: [
    { action: 'create', roles: ['owner', 'admin'] },
    { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'update', roles: ['owner', 'admin'] },
    { action: 'delete', roles: ['owner'] },
  ],
}
// Combined with access.shared: true in entity config
```

### Scenario 3: Admin-Only Entity

```typescript
entities: {
  settings: [
    { action: 'read', roles: ['owner', 'admin'] },
    { action: 'update', roles: ['owner'] },
  ],
}
```

## Best Practices

1. **Define all permissions centrally** in `permissions.config.ts`
2. **Use `dangerous: true`** for destructive actions (delete, etc.)
3. **Owner gets all permissions** automatically (hardcoded in registry)
4. **Prefer explicit roles** over implicit hierarchy
5. **Combine RBAC with RLS** for defense in depth
6. **Test permissions** with different roles

## See Also

- **[Theme Permissions Configuration](../06-authentication/10-permissions-config.md)** - Full config reference
- **[Permission Service](../14-permissions/03-permission-service.md)** - API reference
- **[Teams Permissions](../10-teams/06-permissions.md)** - Team-level permissions
- **[Validation](./10-validation.md)** - Validation system

---

> **Note**: Entity permissions in `entity.config.ts` are optional and serve as fallback. The recommended approach is to define all permissions in `permissions.config.ts` for a single source of truth.
