# Extensible Roles System

NextSpark implements an extensible role system that allows themes to add custom roles while protecting core system roles. This hybrid approach provides flexibility for vertical-specific applications (CRM, Blog, E-commerce) while maintaining system stability.

## Overview

### Core Concept

The role system uses a **protected core + extensible theme** architecture:

```text
Core Roles (Protected)          Theme Roles (Extensible)
├── member (hierarchy: 1)       ├── editor (hierarchy: 25)
├── superadmin (hierarchy: 99)  ├── moderator (hierarchy: 50)
└── developer (hierarchy: 100)  └── viewer (hierarchy: 5)
         ↓                              ↓
    Cannot be removed           Can be added by themes
    Cannot be redefined         Hierarchy must be 1-99
```

### Key Features

- **Core Role Protection**: `member`, `superadmin`, and `developer` are always present
- **Theme Extension**: Themes can add custom roles via `additionalRoles`
- **Hierarchy System**: Higher values = more permissions (developer is always 100)
- **Type Safety**: Full TypeScript support with `UserRole`, `CoreRole` types
- **Validation**: Console warnings for invalid configurations (non-blocking)
- **Backwards Compatibility**: Existing themes work without modification

### ⚠️ Critical: Custom Roles Are Theme-Only

**Custom roles (e.g., `editor`, `moderator`) must NEVER appear in core files.**

This is a fundamental architectural principle:

| Location | Core Roles | Custom Roles |
|----------|------------|--------------|
| `core/lib/` | ✅ Can reference | ❌ Must NOT reference |
| `core/components/` | ✅ Can reference | ❌ Must use fallbacks |
| `core/messages/` | ✅ Must define | ❌ Must NOT define |
| `contents/themes/*/` | ✅ Can reference | ✅ Must define here |

**Why this matters:**
1. Core is theme-agnostic - it doesn't know what custom roles exist
2. Themes are independent - each theme defines its own roles
3. Core components must gracefully handle ANY custom role via fallbacks

**Example - Correct pattern in core components:**
```typescript
// Core roles only - custom roles use fallback
const roleIconsMap: Record<string, IconType | null> = {
  owner: Crown,
  admin: Shield,
  member: null,
  viewer: Eye,
  // NO 'editor' or other custom roles here!
}

// Type-safe helper with fallback for ANY custom role
const getRoleIcon = (role: TeamRole) => roleIconsMap[role] ?? Eye
```

**Custom role translations:**
- Core defines: `teams.roles.{owner|admin|member|viewer}`
- Theme extends: `teams.roles.{editor}` (in theme's messages files)

## Core Roles

### Protected System Roles

| Role | Hierarchy | Description | Can Override |
|------|-----------|-------------|--------------|
| `member` | 1 | Standard user role, default for new registrations | Hierarchy only |
| `superadmin` | 99 | Administrative role with full access | Hierarchy only |
| `developer` | 100 | Development/QA access with system-level permissions | Never |

### Why Core Roles Are Protected

1. **System Stability**: Guards and middleware depend on these roles existing
2. **Security**: Developer role hierarchy must remain highest for system access
3. **Backwards Compatibility**: Existing code references these roles

## Theme Role Extension

### Adding Custom Roles

Themes extend roles in their `app.config.ts`:

```typescript
// contents/themes/your-theme/config/app.config.ts
export const APP_CONFIG_OVERRIDES = {
  userRoles: {
    // Add custom roles
    additionalRoles: ['editor', 'moderator', 'viewer'] as const,

    // Define hierarchy for custom roles
    hierarchy: {
      viewer: 5,      // Read-only access
      editor: 25,     // Can create/edit content
      moderator: 50,  // Can moderate content and users
    },

    // Display names (translation keys)
    displayNames: {
      viewer: 'common.userRoles.viewer',
      editor: 'common.userRoles.editor',
      moderator: 'common.userRoles.moderator',
    },

    // Descriptions
    descriptions: {
      viewer: 'Read-only access to content',
      editor: 'Can create and edit content',
      moderator: 'Can moderate content and users',
    },

    // Change default role for new users (optional)
    defaultRole: 'viewer',
  },
}
```

### Resulting Available Roles

After merge, the final configuration is:

```typescript
availableRoles: [
  'member',      // Core
  'superadmin',  // Core
  'developer',   // Core
  'editor',      // Theme
  'moderator',   // Theme
  'viewer',      // Theme
]
```

## Hierarchy System

### How Hierarchy Works

The hierarchy value determines role permissions:

```text
100 ─┬─ developer     ← System-level access (always 100)
     │
 99 ─┼─ superadmin    ← Full admin access
     │
 50 ─┼─ moderator     ← Content moderation
     │
 25 ─┼─ editor        ← Content creation
     │
 10 ─┼─ member        ← Standard access
     │
  5 ─┼─ viewer        ← Read-only
     │
  1 ─┴─ (minimum)
```

### Using Hierarchy for Access Control

```typescript
import { roleHelpers, ROLE_HIERARCHY } from '@/core/types/user.types'

// Check if user has sufficient role level
function canEditContent(userRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY['editor']
}

// Using the helper
roleHelpers.hasRoleLevel(userRole, 'editor') // true if hierarchy >= editor
```

### Hierarchy Constraints

| Rule | Description |
|------|-------------|
| Developer = 100 | Always, cannot be changed |
| Non-developer ≤ 99 | Automatically capped if set higher |
| Missing hierarchy = 1 | Defaults to minimum |

## Type System

### Available Types

```typescript
// All roles (core + theme)
type UserRole = 'member' | 'superadmin' | 'developer' | 'editor' | 'moderator' | 'viewer'

// Only protected core roles
type CoreRole = 'member' | 'superadmin' | 'developer'
```

### Type Guards

```typescript
import { isCoreRole, isThemeRole } from '@/core/types/user.types'

// Check if role is a protected core role
if (isCoreRole(userRole)) {
  // TypeScript knows: userRole is CoreRole
  console.log('This is a core role')
}

// Check if role is a theme-specific role
if (isThemeRole(userRole)) {
  console.log('This is a custom theme role')
}
```

### Dynamic USER_ROLES Constant

The `USER_ROLES` constant is generated dynamically:

```typescript
import { USER_ROLES } from '@/core/types/user.types'

// Access roles by uppercase name
USER_ROLES.MEMBER      // 'member'
USER_ROLES.SUPERADMIN  // 'superadmin'
USER_ROLES.DEVELOPER   // 'developer'
USER_ROLES.EDITOR      // 'editor' (if defined by theme)
USER_ROLES.MODERATOR   // 'moderator' (if defined by theme)
```

## Configuration Reference

### Theme Configuration Options

```typescript
interface ThemeRolesConfig {
  // Add custom roles (appended to core roles)
  additionalRoles?: readonly string[]

  // Set default role for new user registrations
  defaultRole?: string

  // Define hierarchy values (1-99 for custom, 100 reserved for developer)
  hierarchy?: Record<string, number>

  // Translation keys for role names
  displayNames?: Record<string, string>

  // Role descriptions (plain text or translation keys)
  descriptions?: Record<string, string>
}
```

### What You Can Do

| Action | Allowed | Notes |
|--------|---------|-------|
| Add custom roles | ✅ | Via `additionalRoles` array |
| Set custom role hierarchy | ✅ | Values 1-99 |
| Override core role hierarchy | ✅ | Except developer (always 100) |
| Override displayNames | ✅ | Any role |
| Override descriptions | ✅ | Any role |
| Change defaultRole | ✅ | Must be valid role |

### What You Cannot Do

| Action | Result |
|--------|--------|
| Remove core roles | Ignored (core roles always present) |
| Add core role via additionalRoles | Warning, ignored |
| Set developer hierarchy ≠ 100 | Warning, forced to 100 |
| Set non-developer hierarchy ≥ 100 | Warning, capped to 99 |
| Set invalid defaultRole | Warning, falls back to 'member' |

## Validation & Warnings

The system validates configurations and logs warnings:

```typescript
// Example: Attempting to set developer hierarchy to 50
userRoles: {
  hierarchy: {
    developer: 50,  // ⚠️ Warning logged, forced to 100
  },
}
// Console: [roles-merge] Theme attempted to set developer hierarchy to 50.
//          Developer role must always have hierarchy 100. Forcing to 100.
```

### Warning Types

| Issue | Warning Message |
|-------|-----------------|
| Core role in additionalRoles | "Core roles cannot be redefined. Ignoring." |
| Developer hierarchy ≠ 100 | "Developer role must always have hierarchy 100. Forcing to 100." |
| Non-developer hierarchy ≥ 100 | "Non-developer roles cannot have hierarchy >= 100. Capping to 99." |
| Missing hierarchy for role | "Role X is missing hierarchy value. Defaulting to 1." |
| Invalid defaultRole | "Theme defaultRole X does not exist. Falling back to 'member'." |

## Use Case Examples

### Blog Theme

```typescript
userRoles: {
  additionalRoles: ['author', 'editor', 'subscriber'] as const,
  hierarchy: {
    subscriber: 5,   // Can read content
    author: 25,      // Can write posts
    editor: 50,      // Can edit all posts
  },
  defaultRole: 'subscriber',
}
```

### CRM Theme

```typescript
userRoles: {
  additionalRoles: ['sales_rep', 'sales_manager', 'support'] as const,
  hierarchy: {
    support: 20,        // Handle tickets
    sales_rep: 30,      // Manage own deals
    sales_manager: 60,  // Manage team deals
  },
  defaultRole: 'sales_rep',
}
```

### E-commerce Theme

```typescript
userRoles: {
  additionalRoles: ['customer', 'vendor', 'warehouse'] as const,
  hierarchy: {
    customer: 5,     // Place orders
    warehouse: 30,   // Manage inventory
    vendor: 40,      // Manage products
  },
  defaultRole: 'customer',
}
```

## Team Roles System

In addition to global user roles, the boilerplate implements a separate **Team Roles** system for team-based permissions.

### Two Separate Role Systems

| System | Table | Column | Protected Roles | Customizable |
|--------|-------|--------|-----------------|--------------|
| **User Roles** | `users` | `role` | member, superadmin, developer | None (100% immutable) |
| **Team Roles** | `team_members` | `role` | owner | admin, member, viewer + custom |

### Default Team Roles

| Role | Hierarchy | Description |
|------|-----------|-------------|
| `owner` | 100 | Full team control (PROTECTED) |
| `admin` | 50 | Team management |
| `member` | 10 | Standard access |
| `viewer` | 1 | Read-only access |

### Team Roles Configuration (permissions.config.ts)

**IMPORTANT:** Team roles and their permissions are now defined in `permissions.config.ts`, the **single source of truth** for all permissions.

```typescript
// contents/themes/your-theme/config/permissions.config.ts
export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // ==========================================
  // CUSTOM ROLES
  // ==========================================
  roles: {
    additionalRoles: ['editor', 'contractor'] as const,
    hierarchy: {
      editor: 5,       // Between viewer (1) and member (10)
      contractor: 3,   // Lower than editor
    },
    displayNames: {
      editor: 'common.teamRoles.editor',
      contractor: 'common.teamRoles.contractor',
    },
    descriptions: {
      editor: 'Can view team content with limited editing',
      contractor: 'External contractor with limited access',
    },
  },

  // ==========================================
  // TEAM PERMISSIONS
  // ==========================================
  teams: [
    // View permissions
    { action: 'team.view', label: 'View Team', roles: ['owner', 'admin', 'member', 'viewer', 'editor', 'contractor'] },
    { action: 'team.members.view', label: 'View Members', roles: ['owner', 'admin', 'member', 'viewer', 'editor'] },
    { action: 'team.billing.view', label: 'View Billing', roles: ['owner', 'admin'] },

    // Edit permissions
    { action: 'team.edit', label: 'Edit Team', roles: ['owner', 'admin'] },
    { action: 'team.settings.edit', label: 'Edit Settings', roles: ['owner', 'admin'] },

    // Member management
    { action: 'team.members.invite', label: 'Invite Members', roles: ['owner', 'admin'] },
    { action: 'team.members.remove', label: 'Remove Members', roles: ['owner', 'admin'] },
    { action: 'team.members.update_role', label: 'Update Roles', roles: ['owner', 'admin'] },

    // Dangerous
    { action: 'team.delete', label: 'Delete Team', roles: ['owner'], dangerous: true },
  ],

  // Then include the new roles in entity and feature permissions
  entities: {
    customers: [
      { action: 'read', roles: ['owner', 'admin', 'member', 'editor', 'contractor'] },
      // contractor can only read, not create/update/delete
    ],
  },
}
```

### Checking Team Permissions

Use `canDoAction()` or `checkTeamPermission()`:

```typescript
import { PermissionService } from '@/core/lib/services/permission.service'
import { checkTeamPermission } from '@/core/lib/teams/permissions'

// Unified API (recommended)
if (PermissionService.canDoAction('admin', 'team.members.invite')) {
  // Can invite members
}

// Legacy API (still works)
if (checkTeamPermission('admin', 'team.members.invite')) {
  // Can invite members
}
```

### Team Role Protection Rules

| Action | Result |
|--------|--------|
| Remove 'owner' | Not possible (owner is protected) |
| Modify owner hierarchy | Not possible (always 100) |
| Add custom roles | Define in `roles.additionalRoles` |
| Assign permissions to roles | Include role in `teams[].roles` array |

### Why 'owner' is Protected

The `owner` role is critical because:
1. **Team Creation**: When a user creates a team, they become the owner
2. **Team Deletion**: Only owners can delete teams
3. **Transfer Logic**: Ownership transfer depends on this role
4. **Has ALL Permissions**: Owner automatically has every permission

## Integration with Guards

### Using Roles in Guards

```typescript
// Existing guards work unchanged
import { roleHelpers } from '@/core/types/user.types'

// Check any role (core or theme)
roleHelpers.hasRoleLevel(user.role, 'editor')
roleHelpers.isAdmin(user.role)
roleHelpers.isSuperAdmin(user.role)
roleHelpers.isDeveloper(user.role)

// Get ordered roles
roleHelpers.getAllRolesByHierarchy()
// Returns: ['developer', 'superadmin', 'moderator', 'editor', 'member', 'viewer']
```

### Role Helpers Reference

| Helper | Description |
|--------|-------------|
| `hasRoleLevel(role, required)` | Check if role hierarchy ≥ required role |
| `isAdmin(role)` | Check if role is admin or higher |
| `isSuperAdmin(role)` | Check if role is exactly superadmin |
| `isDeveloper(role)` | Check if role is exactly developer |
| `canAccessAdmin(role)` | Check if superadmin or developer |
| `getRoleDisplayKey(role)` | Get translation key for role |
| `getAllRolesByHierarchy()` | Get all roles ordered by hierarchy |

## Merge Process

### How Configuration Merges

```text
Core Config (DEFAULT_APP_CONFIG)
        ↓
Theme Config (APP_CONFIG_OVERRIDES)
        ↓
  mergeRolesConfig()
        ↓
Final USER_ROLES_CONFIG
```

### Merge Rules

1. **Core roles preserved**: Always in `availableRoles`
2. **additionalRoles appended**: After core roles, in order
3. **Hierarchy merged**: Theme values override, developer forced to 100
4. **displayNames/descriptions merged**: Theme overrides core
5. **defaultRole validated**: Must exist, fallback to 'member'

## File Locations

| File | Purpose |
|------|---------|
| `core/lib/config/roles-merge.ts` | Merge functions for user and team roles |
| `core/lib/config/app.config.ts` | Core roles definition (userRoles + teamRoles) |
| `core/lib/config/config-sync.ts` | Config merge integration |
| `core/lib/config/types.ts` | TeamRolesConfig interface |
| `core/types/user.types.ts` | UserRole, CoreRole types and helpers |
| `contents/themes/*/app.config.ts` | Theme role extensions |

## Troubleshooting

### Role Not Available

**Problem**: Custom role not appearing in `USER_ROLES`

**Solution**:
1. Ensure role is in `additionalRoles` array
2. Use `as const` for type inference:
   ```typescript
   additionalRoles: ['editor', 'viewer'] as const,
   ```text
3. Check console for validation warnings

### Hierarchy Not Working

**Problem**: Role access check fails unexpectedly

**Solution**:
1. Verify hierarchy is set in config
2. Check that non-developer roles are ≤ 99
3. Missing hierarchy defaults to 1 (minimum)

### Type Errors

**Problem**: TypeScript doesn't recognize custom role

**Solution**:
1. Ensure `as const` is used on `additionalRoles`
2. Restart TypeScript server after config changes
3. Check that theme config is exported correctly

## Next Steps

1. **[Permissions and Roles](./06-permissions-and-roles.md)** - RBAC system details
2. **[Security Best Practices](./07-security-best-practices.md)** - Security implementation
3. **[Testing Authentication](./08-testing-authentication.md)** - Testing strategies

---

> **Note**: The extensible roles system is designed for theme developers who need custom roles. Most applications work fine with the core roles (`member`, `superadmin`, `developer`). Only add custom roles when your vertical requires specific role-based access patterns.
