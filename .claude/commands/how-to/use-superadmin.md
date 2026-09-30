# /how-to:use-superadmin

Interactive guide to using the Superadmin Panel for system administration in NextSpark.

**Aliases:** `/how-to:superadmin`, `/how-to:admin-panel`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/permissions-system/SKILL.md` - Role-based access control
- `.claude/skills/service-layer/SKILL.md` - Data access patterns

---

## Syntax

```
/how-to:use-superadmin
/how-to:use-superadmin --section users
/how-to:use-superadmin --permissions
```

---

## Behavior

Guides the user through the Superadmin Panel capabilities: user management, team management, subscriptions, and role configuration.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Accessing the Superadmin Panel
        └── Requirements and permissions

Step 2: User Management
        └── View, filter, and manage users

Step 3: Team Management
        └── View and manage teams

Step 4: Subscription Management
        └── Handle team subscriptions

Step 5: Role Configuration
        └── Team roles and permissions matrix
```

---

## Step 1: Accessing the Superadmin Panel

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: USE SUPERADMIN PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Accessing the Superadmin Panel

The Superadmin Panel provides system-wide
administration capabilities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Access Requirements:**

```
┌─────────────────────────────────────────────┐
│  REQUIRED: superadmin role                  │
│  ─────────────────────────────────────────  │
│  Only users with the global 'superadmin'    │
│  role can access the Superadmin Panel.      │
│                                             │
│  This is a USER role, not a team role.      │
└─────────────────────────────────────────────┘
```

**📋 How to Access:**

```
URL: /superadmin

Navigation:
1. Log in as a superadmin user
2. Click the admin icon in the sidebar
   or navigate directly to /superadmin
```

**📋 Making a User Superadmin:**

```sql
-- In the database
UPDATE users SET role = 'superadmin' WHERE email = 'admin@example.com';
```

Or use the devKeyring in `app.config.ts`:

```typescript
// app.config.ts
devKeyring: {
  'admin@example.com': {
    password: 'Test1234',
    role: 'superadmin',
    // ...
  }
}
```

**📋 Panel Structure:**

```
/superadmin/
├── page.tsx           # Dashboard overview
├── users/
│   └── page.tsx       # User management
├── teams/
│   └── page.tsx       # Team management
├── subscriptions/
│   └── page.tsx       # Subscription management
└── team-roles/
    └── page.tsx       # Role configuration
```

**📋 Available Components:**

```
packages/core/src/components/superadmin/
├── SuperadminSidebar.tsx    # Navigation sidebar
├── TeamsTable.tsx           # Teams data table
├── PlanFeaturesMatrix.tsx   # Plan features overview
├── RolesPermissionsMatrix.tsx # Role permissions
└── filters/
    ├── SearchInput.tsx      # Search component
    ├── FilterDropdown.tsx   # Filter dropdowns
    └── PaginationControls.tsx # Pagination
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (User Management)
[2] I can't access the panel, help!
[3] What's the difference between superadmin and team admin?
```

---

## Step 2: User Management

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: User Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Manage all users in your application from
a single dashboard.
```

**📋 User Management Features:**

```
┌─────────────────────────────────────────────┐
│  /superadmin/users                          │
│  ─────────────────────────────────────────  │
│                                             │
│  TABS:                                      │
│  • Regular Users - All non-admin users      │
│  • Superadmins - System administrators      │
│                                             │
│  FILTERS:                                   │
│  • Search by name/email                     │
│  • Filter by role                           │
│  • Filter by status                         │
│                                             │
│  STATS:                                     │
│  • Total users                              │
│  • Total work teams                         │
│  • Total superadmins                        │
│  • Role distribution                        │
└─────────────────────────────────────────────┘
```

**📋 User Table Columns:**

| Column | Description |
|--------|-------------|
| Name | User's full name |
| Email | Email address |
| Role | User role (member, superadmin) |
| Status | Active, pending, suspended |
| Teams | Number of teams |
| Created | Registration date |
| Actions | View, edit, suspend |

**📋 Available Actions:**

```typescript
// View user details
onClick={() => router.push(`/superadmin/users/${userId}`)}

// Edit user
onClick={() => openEditModal(user)}

// Suspend user
onClick={() => suspendUser(userId)}

// Make superadmin
onClick={() => updateUserRole(userId, 'superadmin')}
```

**📋 API Endpoints:**

```
GET  /api/superadmin/users         # List users
GET  /api/superadmin/users/:id     # Get user details
PATCH /api/superadmin/users/:id    # Update user
DELETE /api/superadmin/users/:id   # Delete user (soft)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Team Management)
[2] How do I bulk import users?
[3] Can I export user data?
```

---

## Step 3: Team Management

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Team Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View and manage all teams (organizations)
in your application.
```

**📋 Team Management Features:**

```
┌─────────────────────────────────────────────┐
│  /superadmin/teams                          │
│  ─────────────────────────────────────────  │
│                                             │
│  VIEW:                                      │
│  • All teams with member counts             │
│  • Team owners and plans                    │
│  • Creation dates and activity              │
│                                             │
│  FILTERS:                                   │
│  • Search by team name                      │
│  • Filter by plan                           │
│  • Filter by status                         │
│                                             │
│  ACTIONS:                                   │
│  • View team details                        │
│  • Change team plan                         │
│  • Suspend/reactivate team                  │
└─────────────────────────────────────────────┘
```

**📋 TeamsTable Component:**

```typescript
// Usage in page
import { TeamsTable } from '@nextsparkjs/core/components/superadmin'

<TeamsTable
  teams={teams}
  onViewTeam={(id) => router.push(`/superadmin/teams/${id}`)}
  onEditTeam={(team) => openEditModal(team)}
  onSuspendTeam={(id) => suspendTeam(id)}
/>
```

**📋 Team Table Columns:**

| Column | Description |
|--------|-------------|
| Name | Team name |
| Slug | URL identifier |
| Owner | Team owner email |
| Members | Member count |
| Plan | Current subscription plan |
| Status | Active, suspended, trial |
| Created | Creation date |
| Actions | View, edit, suspend |

**📋 Team Details View:**

```
/superadmin/teams/:teamId

Shows:
• Team information
• Member list with roles
• Subscription details
• Activity log
• Usage statistics
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Subscriptions)
[2] How do I merge teams?
[3] Can I impersonate a team?
```

---

## Step 4: Subscription Management

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Subscription Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Manage team subscriptions and billing
information.
```

**📋 Subscription Features:**

```
┌─────────────────────────────────────────────┐
│  /superadmin/subscriptions                  │
│  ─────────────────────────────────────────  │
│                                             │
│  VIEW:                                      │
│  • All active subscriptions                 │
│  • Plan distribution                        │
│  • Revenue metrics                          │
│                                             │
│  FILTERS:                                   │
│  • Filter by plan                           │
│  • Filter by status                         │
│  • Filter by billing cycle                  │
│                                             │
│  ACTIONS:                                   │
│  • Change plan manually                     │
│  • Extend trial                             │
│  • Cancel subscription                      │
│  • Apply credits                            │
└─────────────────────────────────────────────┘
```

**📋 Subscription Table:**

| Column | Description |
|--------|-------------|
| Team | Team name |
| Plan | Current plan (Free, Pro, Enterprise) |
| Status | Active, trialing, canceled, past_due |
| Billing | Monthly, yearly |
| Amount | Subscription amount |
| Next billing | Next charge date |
| Actions | Manage, cancel, upgrade |

**📋 Plan Features Matrix:**

```typescript
import { PlanFeaturesMatrix } from '@nextsparkjs/core/components/superadmin'

// Shows all plans and their features
<PlanFeaturesMatrix />
```

```
┌─────────────────────────────────────────────┐
│  PLAN FEATURES MATRIX                       │
│  ─────────────────────────────────────────  │
│                                             │
│  Feature        Free   Pro    Enterprise   │
│  ─────────────  ────   ────   ──────────   │
│  Team members   3      10     Unlimited    │
│  Storage        1GB    10GB   100GB        │
│  API calls      1K     10K    Unlimited    │
│  Support        Email  Chat   Dedicated    │
└─────────────────────────────────────────────┘
```

**📋 Manual Plan Changes:**

```typescript
// Change a team's plan (bypasses Stripe)
await updateTeamSubscription(teamId, {
  planId: 'pro',
  reason: 'Customer support request',
  expiresAt: null // or specific date
})
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Role Configuration)
[2] How do I give a team free access?
[3] Where do I configure plans?
```

---

## Step 5: Role Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Role Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure team roles and their permissions.
```

**📋 Role System Overview:**

```
┌─────────────────────────────────────────────┐
│  TWO TYPES OF ROLES                         │
│  ─────────────────────────────────────────  │
│                                             │
│  USER ROLES (Global):                       │
│  • member - Regular user                    │
│  • superadmin - System administrator        │
│                                             │
│  TEAM ROLES (Per team):                     │
│  • owner - Full control                     │
│  • admin - Most permissions                 │
│  • member - Limited permissions             │
│  • viewer - Read-only access                │
└─────────────────────────────────────────────┘
```

**📋 Roles Permissions Matrix:**

```typescript
import { RolesPermissionsMatrix } from '@nextsparkjs/core/components/superadmin'

// View all roles and their permissions
<RolesPermissionsMatrix />
```

```
┌──────────────────────────────────────────────────────────┐
│  TEAM PERMISSIONS BY ROLE                                │
│  ────────────────────────────────────────────────────    │
│                                                          │
│  Permission              Owner  Admin  Member  Viewer    │
│  ──────────────────────  ────   ────   ──────  ──────    │
│  team.view               ✓      ✓      ✓       ✓         │
│  team.edit               ✓      ✓      ✗       ✗         │
│  team.delete             ✓      ✗      ✗       ✗         │
│  team.members.view       ✓      ✓      ✓       ✓         │
│  team.members.invite     ✓      ✓      ✗       ✗         │
│  team.members.remove     ✓      ✓      ✗       ✗         │
│  team.settings.view      ✓      ✓      ✓       ✗         │
│  team.settings.edit      ✓      ✓      ✗       ✗         │
│  team.billing.view       ✓      ✓      ✗       ✗         │
│  team.billing.manage     ✓      ✗      ✗       ✗         │
└──────────────────────────────────────────────────────────┘
```

**📋 Role Hierarchy:**

```
superadmin (bypasses all team permissions)
    │
    ▼
  owner (full team control)
    │
    ▼
  admin (most permissions)
    │
    ▼
  member (limited permissions)
    │
    ▼
  viewer (read-only)
```

**📋 Custom Roles:**

Themes can define custom roles in `app.config.ts`:

```typescript
// app.config.ts
teamRoles: {
  custom: [
    {
      name: 'editor',
      displayName: 'Editor',
      description: 'Can edit content but not settings',
      permissions: [
        'team.view',
        'entities.read',
        'entities.write',
      ]
    }
  ]
}
```

**📋 Permission Registry:**

```typescript
// Import from registry
import {
  TEAM_PERMISSIONS_BY_ROLE,
  AVAILABLE_ROLES,
  ROLE_HIERARCHY,
} from '@nextsparkjs/registries/permissions-registry'

// Check permission
const hasPermission = TEAM_PERMISSIONS_BY_ROLE[role].includes(permission)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Accessing the Superadmin Panel
• User management and filtering
• Team management capabilities
• Subscription handling
• Role and permission configuration

📚 Related tutorials:
   • /how-to:set-user-roles-and-permissions - Configure RBAC
   • /how-to:set-plans-and-permissions - Configure billing plans

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "What's the difference between superadmin and team admin?"

```
📋 Superadmin vs Team Admin:

SUPERADMIN (User Role):
• Global system administrator
• Access to /superadmin panel
• Can manage ALL users and teams
• Can change any user's role
• Can modify subscriptions
• NOT tied to any specific team

TEAM ADMIN (Team Role):
• Administrator of a specific team
• Access to team settings
• Can invite/remove team members
• Can change member roles (except owner)
• CANNOT access other teams
• CANNOT access superadmin panel

In short:
• Superadmin = System-wide power
• Team Admin = Team-specific power
```

### "How do I give a team free access?"

```
📋 Granting Free Access:

Option 1: Manual plan override
   1. Go to /superadmin/subscriptions
   2. Find the team
   3. Click "Change Plan"
   4. Select plan and check "Free override"
   5. Set expiration (or never)

Option 2: Via database

   UPDATE team_subscriptions
   SET plan_id = 'enterprise',
       stripe_subscription_id = NULL,
       status = 'active',
       free_override = true,
       free_override_reason = 'Partner program'
   WHERE team_id = 'team-id';

Option 3: Via API

   await updateTeamSubscription(teamId, {
     planId: 'pro',
     freeOverride: true,
     reason: 'Beta tester reward',
     expiresAt: '2025-12-31'
   })
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:set-user-roles-and-permissions` | Configure RBAC system |
| `/how-to:set-plans-and-permissions` | Configure billing plans |
| `/how-to:use-devtools` | Developer tools panel |
