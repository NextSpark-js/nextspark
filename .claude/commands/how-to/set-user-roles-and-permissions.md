# /how-to:set-user-roles-and-permissions

Interactive guide to configure team roles and RBAC permissions in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/permissions-system/SKILL.md` - Three-layer permission model
- `.claude/skills/service-layer/SKILL.md` - How services check permissions

---

## Syntax

```
/how-to:set-user-roles-and-permissions
```

---

## Behavior

Guides the user through configuring team roles, custom roles, and entity permissions for RBAC.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding User vs Team Roles
        └── Two separate role systems

Step 2: Configure Core Team Roles
        └── owner, admin, member, viewer

Step 3: Add Custom Team Roles
        └── editor, contributor, moderator

Step 4: Define Entity Permissions
        └── Map actions to roles

Step 5: Use Permissions in Code
        └── Server and client checks
```

---

## Step 1: Understanding User vs Team Roles

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: SET USER ROLES AND PERMISSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding User vs Team Roles

⚠️  CRITICAL: NextSpark has TWO separate role systems:

┌─────────────────────────────────────────────┐
│  USER ROLES (App-Level)                     │
│  ─────────────────────────────────────────  │
│  Storage: user.role column                  │
│  Scope: Global (entire app)                 │
│  Extensible: ❌ NO - Fixed in core          │
│  Purpose: Route access control              │
│  ─────────────────────────────────────────  │
│  Roles: member | superadmin | developer     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  TEAM ROLES (Team-Level)                    │
│  ─────────────────────────────────────────  │
│  Storage: teamMembers.role column           │
│  Scope: Per-team membership                 │
│  Extensible: ✅ YES - Themes add roles      │
│  Purpose: Entity permissions                │
│  ─────────────────────────────────────────  │
│  Core: owner | admin | member | viewer      │
│  Custom: editor | contributor | moderator   │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 When to Use Each:

USER ROLES:
• Route protection (/superadmin/*, /devtools/*)
• System-level access
• Checked via middleware

TEAM ROLES:
• Entity CRUD permissions
• Feature access within team
• Checked via MembershipService

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Core Team Roles)
[2] I have a question about the difference
[3] Show me code examples for each
```

---

## Step 2: Configure Core Team Roles

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Configure Core Team Roles
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Core provides 4 team roles with fixed hierarchy:

| Role   | Hierarchy | Description                      |
|--------|-----------|----------------------------------|
| owner  | 100       | Team creator, all permissions    |
| admin  | 50        | Team management, member roles    |
| member | 10        | Standard entity access           |
| viewer | 1         | Read-only access                 |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure core permissions in your theme:

```typescript
// contents/themes/default/config/permissions.config.ts
import type { ThemePermissionsConfig } from '@/core/lib/permissions/types'

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // Team-level permissions
  teams: [
    { action: 'team.view', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'team.edit', roles: ['owner', 'admin'] },
    { action: 'team.members.invite', roles: ['owner', 'admin'] },
    { action: 'team.members.remove', roles: ['owner', 'admin'] },
    { action: 'team.members.changeRole', roles: ['owner', 'admin'] },
    { action: 'team.billing.manage', roles: ['owner', 'admin'] },
    { action: 'team.delete', roles: ['owner'], dangerous: true },
  ],

  // Entity permissions (basic example)
  entities: {
    customers: [
      { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'] },
    ],
  },
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Hierarchy Rule:

Higher hierarchy = more permissions.
A role inherits all permissions from lower roles.

owner (100) > admin (50) > member (10) > viewer (1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Custom Roles)
[2] What team permissions are available?
[3] My app doesn't need all roles
```

---

## Step 3: Add Custom Team Roles

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Add Custom Team Roles
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Themes can add custom roles between core roles:

```typescript
// contents/themes/default/config/permissions.config.ts

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // 1. Define custom roles
  roles: {
    additionalRoles: ['editor', 'contributor', 'moderator'] as const,

    // Place in hierarchy (between existing roles)
    hierarchy: {
      editor: 5,        // Between viewer (1) and member (10)
      contributor: 3,   // Above viewer, below editor
      moderator: 7,     // Above editor, below member
    },

    // Display names (i18n keys)
    displayNames: {
      editor: 'common.teamRoles.editor',
      contributor: 'common.teamRoles.contributor',
      moderator: 'common.teamRoles.moderator',
    },

    // Descriptions for UI
    descriptions: {
      editor: 'Can view and edit content without delete access',
      contributor: 'Can create and edit own content only',
      moderator: 'Can moderate content and manage comments',
    },
  },

  // 2. Include custom roles in permissions
  teams: [
    { action: 'team.view', roles: ['owner', 'admin', 'member', 'editor', 'contributor', 'moderator', 'viewer'] },
    // ...
  ],

  entities: {
    products: [
      { action: 'read', roles: ['owner', 'admin', 'member', 'editor', 'contributor', 'moderator', 'viewer'] },
      { action: 'create', roles: ['owner', 'admin', 'member', 'editor', 'contributor'] },
      { action: 'update', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'delete', roles: ['owner', 'admin'] },
      { action: 'moderate', roles: ['owner', 'admin', 'moderator'] },
    ],
  },
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Visual Hierarchy After Custom Roles:

owner (100)
  │
admin (50)
  │
member (10)
  │
moderator (7)     ← Custom
  │
editor (5)        ← Custom
  │
contributor (3)   ← Custom
  │
viewer (1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3️⃣  Add Translations:

```json
// contents/themes/default/messages/en.json
{
  "common": {
    "teamRoles": {
      "editor": "Editor",
      "contributor": "Contributor",
      "moderator": "Moderator"
    }
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Entity Permissions)
[2] How do I choose hierarchy values?
[3] Can I remove core roles?
```

---

## Step 4: Define Entity Permissions

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Define Entity Permissions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define which roles can perform which actions on each entity:

```typescript
// contents/themes/default/config/permissions.config.ts

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // ... roles config ...

  entities: {
    // Products entity
    products: [
      { action: 'read', roles: ['owner', 'admin', 'member', 'editor', 'contributor', 'moderator', 'viewer'] },
      { action: 'create', roles: ['owner', 'admin', 'member', 'editor', 'contributor'] },
      { action: 'update', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
      { action: 'export', roles: ['owner', 'admin'] },
      { action: 'publish', roles: ['owner', 'admin', 'member'] },
    ],

    // Customers entity
    customers: [
      { action: 'read', roles: ['owner', 'admin', 'member'] },
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
      { action: 'export', roles: ['owner', 'admin'] },
    ],

    // Invoices entity (more restricted)
    invoices: [
      { action: 'read', roles: ['owner', 'admin', 'member'] },
      { action: 'create', roles: ['owner', 'admin'] },
      { action: 'update', roles: ['owner', 'admin'] },
      { action: 'delete', roles: ['owner'], dangerous: true },
      { action: 'void', roles: ['owner', 'admin'], dangerous: true },
    ],
  },

  // Feature permissions
  features: [
    {
      action: 'page-builder.access',
      roles: ['owner', 'admin', 'editor', 'member'],
      label: 'Access Page Builder',
    },
    {
      action: 'page-builder.custom-css',
      roles: ['owner', 'admin'],
      dangerous: true,
      label: 'Use custom CSS',
    },
    {
      action: 'api-keys.manage',
      roles: ['owner', 'admin'],
      label: 'Manage API Keys',
    },
  ],
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Standard Entity Actions:

• read    - View individual record
• list    - View list of records
• create  - Create new record
• update  - Edit existing record
• delete  - Remove record
• export  - Export data
• publish - Publish/unpublish
• archive - Archive record

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Dangerous Actions:

Mark destructive actions with `dangerous: true`:
• Adds confirmation dialogs in UI
• Highlighted differently in admin panel
• Extra audit logging

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Use in Code)
[2] How do I add custom actions?
[3] Show me the permission matrix UI
```

---

## Step 5: Use Permissions in Code

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Use Permissions in Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Server-Side Permission Checks:

```typescript
// In API route or server action
import { checkPermission } from '@/core/lib/permissions/check'
import { MembershipService } from '@/core/lib/services/membership.service'

export async function DELETE(request: NextRequest, { params }) {
  const { userId, teamId } = await getAuthContext(request)

  // Method 1: Direct permission check
  const canDelete = await checkPermission(userId, teamId, 'products.delete')
  if (!canDelete) {
    return Response.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Method 2: Full membership context
  const membership = await MembershipService.get(userId, teamId)

  // Check single permission
  if (!membership.hasPermission('products.delete')) {
    return Response.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Check role level
  if (!membership.hasMinHierarchy(50)) {  // admin or higher
    return Response.json({ error: 'Admin required' }, { status: 403 })
  }

  // Proceed with deletion
  await ProductsService.delete(params.id, userId)
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Client-Side Permission Checks:

```typescript
// In React component
import { usePermission, usePermissions, useTeamRole } from '@/core/lib/permissions/hooks'

function ProductActions({ productId }: Props) {
  // Single permission check
  const canDelete = usePermission('products.delete')

  // Multiple permissions
  const { canEdit, canExport } = usePermissions({
    canEdit: 'products.update',
    canExport: 'products.export',
  })

  // Current role
  const role = useTeamRole()

  return (
    <div>
      {canEdit && <EditButton id={productId} />}
      {canDelete && <DeleteButton id={productId} />}
      {canExport && <ExportButton id={productId} />}
      {role === 'owner' && <OwnerSettings />}
    </div>
  )
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 User Role Checks (App-Level):

```typescript
import { roleHelpers } from '@/core/lib/role-helpers'

// Check user roles (NOT team roles)
if (roleHelpers.isDeveloper(user.role)) {
  // Access to /devtools/*
}

if (roleHelpers.isSuperAdmin(user.role)) {
  // Access to /superadmin/*
  // Bypasses team permission checks
}

// ⚠️ WRONG: Never mix contexts
if (membership.hasRole('superadmin')) {}  // This checks TEAM role!
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4️⃣  Rebuild Registry:

```bash
node core/scripts/build/registry.mjs
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've configured:
• Team role hierarchy
• Custom roles for your theme
• Entity permissions per action
• Server and client permission checks

📚 Related tutorials:
   • /how-to:set-plans-and-permissions - Billing integration
   • /how-to:create-entity - Entity with permissions

🔙 Back to menu: /how-to:start
```

---

## Common Questions

### "Can I remove core roles?"

```
📋 Core roles CANNOT be removed:

• owner  - Required for team ownership
• admin  - Required for team management
• member - Default role for invites
• viewer - Minimum access role

You CAN:
• Not use certain roles (just don't assign them)
• Hide roles from selection UI (theme config)
• Add custom roles between them
```

### "How do I choose hierarchy values?"

```
📋 Hierarchy Value Guidelines:

Fixed core roles:
• owner: 100 (maximum)
• admin: 50
• member: 10
• viewer: 1 (minimum)

Add custom roles in gaps:
• 11-49: Higher than member, below admin
• 2-9: Higher than viewer, below member

Example placements:
• manager: 40 (almost admin-level)
• editor: 8 (can edit, can't create)
• contributor: 5 (limited creation)
• readonly: 2 (slightly above viewer)
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:set-plans-and-permissions` | Billing and features |
| `/how-to:create-entity` | Create entities with permissions |
