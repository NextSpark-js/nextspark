# Theme Permissions Configuration

## Overview

The `permissions.config.ts` file is the **single source of truth** for all permissions and custom roles in a theme. This file defines:

- **Custom Roles**: Additional roles beyond core (owner, admin, member, viewer)
- **Team Permissions**: Team-level actions (team.view, team.edit, team.members.invite, etc.)
- **Entity Permissions**: CRUD permissions for entities (customers, tasks, posts, etc.)
- **Feature Permissions**: Theme-specific features (page-builder, media, etc.)

All sections use a **unified format**: `{ action: '...', roles: [...] }`

All permissions are processed at **build time** and merged into a pre-computed registry for O(1) runtime lookups.

## File Location

```
contents/themes/{theme-name}/config/permissions.config.ts
```

## Complete Configuration Structure

```typescript
import type { ThemePermissionsConfig } from '@/core/lib/permissions/types'

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // ==========================================
  // 1. CUSTOM ROLES
  // ==========================================
  roles: {
    /** Additional roles beyond core (owner, admin, member, viewer) */
    additionalRoles: ['editor'] as const,

    /** Role hierarchy (higher = more authority) */
    hierarchy: {
      editor: 5,  // Between viewer (1) and member (10)
    },

    /** Display names (translation keys) */
    displayNames: {
      editor: 'common.teamRoles.editor',
    },

    /** Role descriptions */
    descriptions: {
      editor: 'Can view team content with limited editing capabilities',
    },
  },

  // ==========================================
  // 2. TEAM PERMISSIONS
  // ==========================================
  teams: [
    // View permissions
    { action: 'team.view', label: 'View Team', roles: ['owner', 'admin', 'member', 'viewer', 'editor'] },
    { action: 'team.members.view', label: 'View Members', roles: ['owner', 'admin', 'member', 'viewer', 'editor'] },
    { action: 'team.billing.view', label: 'View Billing', roles: ['owner', 'admin'] },

    // Edit permissions
    { action: 'team.edit', label: 'Edit Team', roles: ['owner', 'admin'] },
    { action: 'team.settings.edit', label: 'Edit Settings', roles: ['owner', 'admin'] },

    // Member management
    { action: 'team.members.invite', label: 'Invite Members', roles: ['owner', 'admin'] },
    { action: 'team.members.remove', label: 'Remove Members', roles: ['owner', 'admin'] },
    { action: 'team.members.update_role', label: 'Update Roles', roles: ['owner', 'admin'] },

    // Dangerous actions
    { action: 'team.delete', label: 'Delete Team', roles: ['owner'], dangerous: true },
  ],

  // ==========================================
  // 3. ENTITY PERMISSIONS
  // ==========================================
  entities: {
    customers: [
      { action: 'create', label: 'Create customers', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View customers', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'list', label: 'List customers', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'update', label: 'Edit customers', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete customers', roles: ['owner'], dangerous: true },
    ],
    tasks: [
      { action: 'create', label: 'Create tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete tasks', roles: ['owner', 'admin'], dangerous: true },
      { action: 'assign', label: 'Assign tasks', roles: ['owner', 'admin'] },
    ],
  },

  // ==========================================
  // 4. FEATURE PERMISSIONS
  // ==========================================
  features: [
    {
      action: 'page-builder.access',
      label: 'Access Page Builder',
      description: 'Can use the visual page builder',
      category: 'Page Builder',
      roles: ['owner', 'admin', 'editor', 'member'],
    },
    {
      action: 'media.upload',
      label: 'Upload Media',
      description: 'Can upload media files',
      category: 'Media',
      roles: ['owner', 'admin', 'editor', 'member'],
    },
    {
      action: 'media.delete',
      label: 'Delete Media',
      description: 'Can permanently delete media',
      category: 'Media',
      roles: ['owner', 'admin'],
      dangerous: true,
    },
  ],

  // ==========================================
  // 5. CORE PERMISSION OVERRIDES
  // ==========================================
  overrides: {
    'settings.billing': {
      roles: ['owner'], // More restrictive than default
    },
  },

  // ==========================================
  // 6. DISABLED PERMISSIONS
  // ==========================================
  disabled: ['reports.export'], // Disable if not needed

  // ==========================================
  // 7. UI SECTIONS
  // ==========================================
  uiSections: [
    {
      id: 'teams',
      label: 'Teams',
      description: 'Team management permissions',
      categories: ['Teams'],
    },
    {
      id: 'page-builder',
      label: 'Page Builder',
      description: 'Visual content editing features',
      categories: ['Page Builder'],
    },
  ],
}

export default PERMISSIONS_CONFIG_OVERRIDES
```

## Unified Format

All permission sections use the same format for consistency:

```typescript
interface PermissionAction {
  action: string        // Permission identifier (e.g., 'team.edit', 'customers.create')
  label: string         // UI display name
  description?: string  // Tooltip text
  roles: string[]       // Roles that have this permission
  category?: string     // Grouping for UI (features only)
  dangerous?: boolean   // Show warning in UI
}
```

### Teams Format

```typescript
teams: [
  { action: 'team.view', label: 'View Team', roles: ['owner', 'admin', 'member'] },
  { action: 'team.edit', label: 'Edit Team', roles: ['owner', 'admin'] },
]
```

### Entities Format

Entity permissions are namespaced automatically: `{entity}.{action}`

```typescript
entities: {
  customers: [
    { action: 'create', label: 'Create', roles: ['owner', 'admin'] },
    // Results in permission: 'customers.create'
  ],
}
```

### Features Format

```typescript
features: [
  {
    action: 'page-builder.access',  // Full action name
    label: 'Access Page Builder',
    category: 'Page Builder',       // For UI grouping
    roles: ['owner', 'admin'],
  },
]
```

## Permission Sources (Merge Order)

The system merges permissions from multiple sources:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | Core System | Base permissions in `core/lib/permissions/system.ts` |
| 2 | Theme Teams | Team permissions from `permissions.config.ts → teams` |
| 3 | Theme Features | Feature permissions from `permissions.config.ts → features` |
| 4 | Theme Entities | Entity permissions from `permissions.config.ts → entities` |

### Core System Permissions

8 base permissions always available:

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `team.view` | View team details | owner, admin, member, viewer |
| `team.edit` | Edit team settings | owner, admin |
| `team.invite` | Invite new members | owner, admin |
| `team.remove` | Remove members | owner, admin |
| `settings.view` | View settings | owner, admin, member |
| `settings.billing` | Manage billing | owner, admin |
| `settings.security` | Manage security | owner, admin |
| `settings.general` | Manage general settings | owner, admin |

## Build-Time Processing

All permissions are pre-computed during build:

```bash
node core/scripts/build/registry.mjs
```

This generates `core/lib/registries/permissions-registry.ts` with:

- `ALL_RESOLVED_PERMISSIONS` - All merged permissions
- `PERMISSIONS_BY_ROLE` - Role → permissions lookup (Set for O(1))
- `TEAM_PERMISSIONS_BY_ROLE` - Team permissions by role
- `CUSTOM_ROLES` - Custom role configuration
- `AVAILABLE_ROLES` - All available roles (core + custom)
- `ROLE_HIERARCHY` - Role hierarchy values
- `FULL_MATRIX` - Complete permission matrix for UI

## Runtime Usage

### Using canDoAction() (Recommended)

The unified way to check any permission type:

```typescript
import { PermissionService } from '@/core/lib/services/permission.service'

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

### Using hasPermission()

Lower-level permission check:

```typescript
import { PermissionService } from '@/core/lib/services/permission.service'

// O(1) lookup - no runtime computation
if (PermissionService.hasPermission('admin', 'posts.create')) {
  // Allow action
}
```

### Getting Role Permissions

```typescript
import { PermissionService } from '@/core/lib/services/permission.service'

const adminPerms = PermissionService.getRolePermissions('admin')
// Returns: ['posts.create', 'posts.read', 'team.view', ...]
```

### Checking Team Permissions

```typescript
import { checkTeamPermission } from '@/core/lib/teams/permissions'

// Check if role can perform team action
if (checkTeamPermission('admin', 'team.members.invite')) {
  // Can invite members
}
```

### Getting Full Matrix (for UI)

```typescript
import { FULL_MATRIX, UI_SECTIONS } from '@/core/lib/registries/permissions-registry'

// Use for building permissions matrix UI in Admin Panel
```

## Adding Custom Roles

To add a custom role, update only `permissions.config.ts`:

```typescript
export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  roles: {
    additionalRoles: ['editor', 'contractor'] as const,
    hierarchy: {
      editor: 5,
      contractor: 3,  // Lower than editor
    },
    displayNames: {
      editor: 'common.teamRoles.editor',
      contractor: 'common.teamRoles.contractor',
    },
    descriptions: {
      editor: 'Can view and edit content',
      contractor: 'External contractor with limited access',
    },
  },

  // Then assign permissions to the new role
  teams: [
    { action: 'team.view', roles: ['owner', 'admin', 'member', 'viewer', 'editor', 'contractor'] },
    // ...
  ],

  entities: {
    customers: [
      { action: 'read', roles: ['owner', 'admin', 'member', 'editor', 'contractor'] },
      // contractor can only read, not create/update/delete
    ],
  },
}
```

After changes, regenerate the registry:

```bash
node core/scripts/build/registry.mjs
```

## Role Hierarchy

Core roles have fixed hierarchy values:

| Role | Hierarchy Value |
|------|-----------------|
| owner | 100 |
| admin | 50 |
| member | 10 |
| viewer | 1 |

Custom roles can have any value. Higher values = more authority for role comparisons.

## Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `canDoAction()` | O(1) | Set.has lookup |
| `hasPermission()` | O(1) | Set.has lookup |
| `getRolePermissions()` | O(1) | Pre-computed array |
| `checkTeamPermission()` | O(1) | Pre-computed lookup |
| Module load | Instant | Pre-computed at build |

## Best Practices

1. **Single Source of Truth**: Define all permissions in `permissions.config.ts`
2. **Unified Format**: Use `action` property consistently across all sections
3. **Use canDoAction()**: Prefer the unified API for permission checks
4. **Group by Category**: Use `category` for features to organize the UI
5. **Mark Dangerous**: Use `dangerous: true` for destructive actions
6. **Custom Roles**: Define hierarchy, display names, and descriptions together
7. **Regenerate Registry**: Run `node core/scripts/build/registry.mjs` after changes

## Migration from Old Format

If you have old `id` format in features, update to `action`:

```typescript
// OLD (deprecated)
features: [
  { id: 'page-builder.access', label: '...', roles: [...] },
]

// NEW (current)
features: [
  { action: 'page-builder.access', label: '...', roles: [...] },
]
```

If you had team roles in `app.config.ts`, move them to `permissions.config.ts`:

```typescript
// OLD (in app.config.ts) - DEPRECATED
teamRoles: {
  additionalTeamRoles: ['editor'],
  hierarchy: { editor: 5 },
  permissions: { editor: ['team.view'] },
}

// NEW (in permissions.config.ts) - CURRENT
roles: {
  additionalRoles: ['editor'],
  hierarchy: { editor: 5 },
},
teams: [
  { action: 'team.view', roles: ['owner', 'admin', 'member', 'viewer', 'editor'] },
]
```

## See Also

- [Permissions and Roles](./06-permissions-and-roles.md)
- [Extensible Roles](./09-extensible-roles.md)
- [Permission Service](../14-permissions/03-permission-service.md)
- [Registry System](../03-registry-system/01-overview.md)
- [Entity Configuration](../04-entities/02-entity-configuration.md)
