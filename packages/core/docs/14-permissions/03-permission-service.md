# PermissionService Reference

**Version:** 3.0
**Last Updated:** 2025-12-29

---

## Overview

`PermissionService` provides runtime permission checks using pre-computed data from the permissions registry. All operations are O(1) lookups.

**New in v3.0:** The unified `canDoAction()` method for checking any permission type (teams, entities, features).

## Import

```typescript
import { PermissionService } from '@/core/lib/services'
```

---

## Methods

### `canDoAction(role, action)` ⭐ Recommended

Unified permission check - works for teams, entities, and features.

```typescript
static canDoAction(role: string, action: string): boolean
```

**Example:**

```typescript
// Team permissions
PermissionService.canDoAction('admin', 'team.edit')
// true

PermissionService.canDoAction('member', 'team.members.invite')
// false

// Entity permissions
PermissionService.canDoAction('admin', 'customers.create')
// true

PermissionService.canDoAction('viewer', 'customers.delete')
// false

// Feature permissions
PermissionService.canDoAction('editor', 'page-builder.access')
// true

// Owner has ALL permissions
PermissionService.canDoAction('owner', 'anything')
// true (always)
```

**Why use `canDoAction()`:**
- Works with ALL permission types (team, entity, feature)
- Owner always returns true (no need for special case)
- Consistent API for the entire application
- O(1) lookup using pre-computed Sets

---

### `hasPermission(role, permission)`

Check if a role has a specific permission.

```typescript
static hasPermission(role: string, permission: Permission): boolean
```

**Example:**

```typescript
const canCreate = PermissionService.hasPermission('admin', 'customers.create')
// true

const canDelete = PermissionService.hasPermission('member', 'customers.delete')
// false (typically only admin/owner)
```

### `getRolePermissions(role)`

Get all permissions for a role.

```typescript
static getRolePermissions(role: string): Permission[]
```

**Example:**

```typescript
const adminPerms = PermissionService.getRolePermissions('admin')
// ['customers.create', 'customers.read', 'customers.update', ...]

const memberPerms = PermissionService.getRolePermissions('member')
// ['customers.read', 'customers.list', ...]
```

### `getByCategory(category)`

Get all permissions in a category.

```typescript
static getByCategory(category: string): ResolvedPermission[]
```

**Example:**

```typescript
const customerPerms = PermissionService.getByCategory('customers')
// Returns full permission configs for all customer permissions
```

### `getCategories()`

Get all permission category names.

```typescript
static getCategories(): string[]
```

**Example:**

```typescript
const categories = PermissionService.getCategories()
// ['customers', 'tasks', 'teams', 'settings', ...]
```

### `getMatrix()`

Get the full permission matrix for UI rendering.

```typescript
static getMatrix(): {
  permissions: Permission[]
  matrix: Record<TeamRole, Permission[]>
  sections: PermissionUISection[]
}
```

**Example:**

```typescript
// In Admin Panel permissions UI
const { permissions, matrix, sections } = PermissionService.getMatrix()

// Render permission checkboxes grouped by section
sections.forEach(section => {
  const categoryPerms = permissions.filter(p =>
    section.categories.includes(p.split('.')[0])
  )
  // Render section with categoryPerms
})
```

### `isValid(permission)`

Check if a permission ID is valid.

```typescript
static isValid(permission: Permission): boolean
```

**Example:**

```typescript
if (PermissionService.isValid('customers.create')) {
  // Valid permission
}

if (!PermissionService.isValid('invalid.permission')) {
  // Unknown permission
}
```

### `getConfig(permission)`

Get full configuration for a permission.

```typescript
static getConfig(permission: Permission): ResolvedPermission | undefined
```

**Example:**

```typescript
const config = PermissionService.getConfig('customers.delete')
if (config?.dangerous) {
  // Show warning in UI
}
```

### `getAll()`

Get all permission IDs.

```typescript
static getAll(): Permission[]
```

**Example:**

```typescript
const allPerms = PermissionService.getAll()
// ['customers.create', 'customers.read', ...]
```

### `hasAnyPermission(role, permissions)`

Check if role has ANY of the specified permissions.

```typescript
static hasAnyPermission(role: string, permissions: Permission[]): boolean
```

**Example:**

```typescript
const canManage = PermissionService.hasAnyPermission('member', [
  'customers.create',
  'customers.update',
])
// true if member can do either action
```

### `hasAllPermissions(role, permissions)`

Check if role has ALL of the specified permissions.

```typescript
static hasAllPermissions(role: string, permissions: Permission[]): boolean
```

**Example:**

```typescript
const canFullyManage = PermissionService.hasAllPermissions('admin', [
  'customers.create',
  'customers.update',
  'customers.delete',
])
// true only if admin has all three
```

---

## Types

### Permission

```typescript
type Permission = `${string}.${string}`
// Examples: 'customers.create', 'teams.invite', 'settings.billing'
```

### ResolvedPermission

```typescript
interface ResolvedPermission {
  id: Permission
  label: string
  description?: string
  category: string
  roles: TeamRole[]
  dangerous?: boolean
  requires?: Permission[]
  source: 'core' | 'theme' | 'entity'
  disabled: boolean
}
```

### PermissionUISection

```typescript
interface PermissionUISection {
  id: string
  label: string
  description?: string
  categories: string[]
}
```

---

## Permission Matrix

The permission matrix is pre-computed at build time by `build-registry.mjs` from:

1. **Core permissions** - `core/lib/permissions/system.ts`
2. **Team permissions** - `permissions.config.ts → teams`
3. **Feature permissions** - `permissions.config.ts → features`
4. **Entity permissions** - `permissions.config.ts → entities`

### Permission Sources (Single File)

All permissions are defined in `contents/themes/[theme]/config/permissions.config.ts`:

```typescript
export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  roles: { ... },      // Custom roles definition
  teams: [ ... ],      // Team permissions (team.view, team.edit, etc.)
  features: [ ... ],   // Feature permissions (page-builder.access, etc.)
  entities: { ... },   // Entity CRUD permissions
}
```

### Default Role Permissions

| Permission Type | Owner | Admin | Member | Viewer |
|-----------------|-------|-------|--------|--------|
| `*.create` | ✓ | ✓ | varies | - |
| `*.read` | ✓ | ✓ | ✓ | ✓ |
| `*.list` | ✓ | ✓ | ✓ | ✓ |
| `*.update` | ✓ | ✓ | varies | - |
| `*.delete` | ✓ | varies | - | - |
| `team.edit` | ✓ | ✓ | - | - |
| `team.billing.*` | ✓ | ✓ | - | - |
| `team.delete` | ✓ | - | - | - |

> **Note:** Owner has ALL permissions automatically. Specific permissions for other roles are configured in `permissions.config.ts`.

---

## Best Practices

### 1. Use TeamMembership for API routes

```typescript
// Prefer this (includes subscription checks)
const membership = await MembershipService.get(userId, teamId)
const result = membership.canPerformAction('customers.create')

// Over this (only checks RBAC)
const hasPermission = PermissionService.hasPermission(role, 'customers.create')
```

### 2. Use PermissionService for UI

```typescript
// In UI components
const { matrix, sections } = PermissionService.getMatrix()

// Render role permissions editor
```

### 3. Check dangerous actions

```typescript
const config = PermissionService.getConfig('customers.delete')
if (config?.dangerous) {
  // Require confirmation
  showConfirmDialog('This action cannot be undone.')
}
```
