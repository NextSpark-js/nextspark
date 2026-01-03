---
title: Teams System Overview
description: Multi-tenant team management system with role-based access control
---

# Teams System Overview

The Teams system provides multi-tenant capabilities for NextSpark, enabling users to collaborate within organizations while maintaining data isolation and role-based permissions.

## Key Features

- **Multi-tenant Architecture**: Complete data isolation between teams using PostgreSQL RLS
- **Flexible Teams Modes**: 3 configuration modes from single-user to full multi-tenant
- **Role-Based Access Control**: Four team roles (owner, admin, member, viewer) plus global roles
- **Invitation System**: Email-based invitations with token validation and expiration (mode-dependent)
- **Team Switching**: Context switching with animated transitions (available in multi-tenant mode)
- **Two-Layer Security**: RLS for team isolation + app-level user isolation

## Teams Modes

The teams system supports **3 different operational modes** configured via `app.config.ts`. Each mode determines what teams are created, whether users can switch teams, create new teams, or invite members.

### Mode Comparison Table

| Mode | Description | Team Created on Signup | Team Switcher | Create Teams | Invitations |
|------|-------------|------------------------|---------------|--------------|-------------|
| `single-user` | Solo user, no collaboration | 1 team | Hidden | Disabled | Disabled |
| `single-tenant` | One global organization | Team (first user only) | Hidden | Disabled | Enabled |
| `multi-tenant` | Multiple organizations | 1 team | Visible | Enabled | Enabled |

### Mode Descriptions

#### `single-user`
- Simplest mode for individual use
- Each user has one team (auto-created on signup)
- No collaboration features visible
- All team UI components return `null`

#### `single-tenant`
- Single organization (B2B SaaS)
- **First signup**: Creates the global team and becomes owner
- **Subsequent signups**: Blocked unless invited
- No team switching (only one team exists)
- Use `api/auth/signup-with-invite` for new users

#### `multi-tenant`
- Full multi-tenant SaaS
- Each user gets their own team on signup
- Can create additional teams (controlled by `allowCreateTeams` option)
- Full team switching capability
- Complete invitation system

### Configuration Example

```typescript
// contents/themes/[theme]/app.config.ts
export const themeAppConfig: DeepPartial<AppConfig> = {
  teams: {
    mode: 'multi-tenant', // Choose your mode
    options: {
      allowCreateTeams: true, // Allow users to create additional teams (default: true)
    }
  }
}
```

### `allowCreateTeams` Option (multi-tenant mode only)

In multi-tenant mode, you can control whether users can create additional teams:

- `allowCreateTeams: true` (default): Users can create multiple teams without limit
- `allowCreateTeams: false`: Users can only be owner of maximum 1 team (the one created on signup)

Note: The signup team is always created regardless of this setting. This option only controls creation of additional teams.

### Helper Functions

Use the `useTeamsConfig` hook to check mode capabilities:

```typescript
import { useTeamsConfig } from '@/core/hooks/useTeamsConfig'

function MyComponent() {
  const { mode, canCreate, canSwitch, canInvite } = useTeamsConfig()

  // Conditionally render based on mode
  if (canSwitch) {
    return <TeamSwitcher />
  }
  return null
}
```

Available helpers:
- `canSwitchTeams()` - Returns true for `multi-tenant`
- `canCreateTeams()` - Returns true for `multi-tenant`
- `canInviteMembers()` - Returns true for all modes except `single-user`
- `createsTeamOnSignup()` - Returns true for `single-user` and `multi-tenant`
- `isPublicSignupRestricted()` - Returns true for `single-tenant` (invite-only after first user)
- `canUserCreateTeam(mode, options, ownedTeamsCount)` - Checks if a specific user can create a team

## Architecture Overview

> **Note**: Some UI components (TeamSwitcher, CreateDialog) are conditionally rendered based on the configured teams mode. See [Teams Modes](#teams-modes) for details.

```text
+-----------------------------------------------------------------+
|                        Application Layer                         |
+-----------------------------------------------------------------+
|  TeamContext (React)     |  Team Hooks      |  UI Components*   |
|  - currentTeam           |  - useTeam       |  - TeamSwitcher   |
|  - userTeams             |  - useTeams      |  - TeamMembers    |
|  - switchTeam()          |  - useMembers    |  - Invitations    |
|  - refreshTeams()        |  - useInvites    |  - CreateDialog   |
|                          |                  |  *Mode-dependent  |
+-----------------------------------------------------------------+
|                          API Layer                               |
+-----------------------------------------------------------------+
|  /api/v1/teams           |  /api/v1/teams/[id]/members          |
|  /api/v1/teams/[id]      |  /api/v1/team-invitations            |
|  /api/v1/teams/switch    |  Dual Auth (Session + API Key)       |
+-----------------------------------------------------------------+
|                       Service Layer                              |
+-----------------------------------------------------------------+
|  TeamService             |  TeamMemberService                    |
|  - getById()             |  - listByTeam()                       |
|  - create()              |  - add() / remove()                   |
|  - update()              |  - updateRole()                       |
|  - getUserTeams()        |  - hasPermission()                    |
|  See: core/docs/10-backend/05-service-layer.md                  |
+-----------------------------------------------------------------+
|                        Database Layer                            |
+-----------------------------------------------------------------+
|  teams                   |  team_members    |  team_invitations |
|  - id, name, slug        |  - team_id       |  - token          |
|  - owner_id              |  - user_id       |  - email          |
|                          |  - role          |  - expires_at     |
|                          |                  |  - status         |
+-----------------------------------------------------------------+
|                      RLS Policies                                |
|  - Team isolation (users can only see their teams' data)        |
|  - Helper functions: get_user_team_ids(), is_superadmin()       |
+-----------------------------------------------------------------+
```

### Service Layer

For internal server-side operations, use the service layer instead of direct SQL:

```typescript
import { TeamService, TeamMemberService } from '@/core/lib/services'

// Team operations
const team = await TeamService.getById(teamId, userId)
const userTeams = await TeamService.getUserTeams(userId)
const newTeam = await TeamService.create(userId, 'My Company')

// Member operations
const members = await TeamMemberService.listByTeam(teamId, userId)
const isAdmin = await TeamMemberService.isAdminOrOwner(teamId, userId)
await TeamMemberService.add(teamId, newUserId, 'member', { invitedBy: userId })
```

See [Service Layer documentation](../10-backend/05-service-layer.md#teamservice) for complete API reference.

## Two-Layer Security Model

The Teams system implements a two-layer security model:

### Layer 1: Database (RLS) - Team Isolation
- RLS policies filter data by `team_id`
- All entities with `team_id` column are automatically isolated
- Uses helper function `get_user_team_ids()` for efficient filtering
- Superadmins can bypass via `is_superadmin()` function

### Layer 2: Application - User Isolation
- Entity `access.shared` configuration determines visibility within teams
- `shared: true` - All team members can see all records
- `shared: false` - Users only see records they created
- Implemented in API handlers, not RLS

```typescript
// Example: Entity with user isolation within teams
const tasksConfig = {
  access: {
    shared: false, // Each user only sees their own tasks
  }
}

// Example: Entity shared within teams
const projectsConfig = {
  access: {
    shared: true, // All team members see all projects
  }
}
```

## Team Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `owner` | Team creator | Full control, delete team, manage all members |
| `admin` | Team administrator | Manage members (except owner), edit team settings |
| `member` | Regular member | Create/edit own content, view team content |
| `viewer` | Read-only access | View team content only |

## Global Roles

In addition to team roles, users have global roles:

| Role | Description |
|------|-------------|
| `member` | Default role for all users |
| `superadmin` | Full system access, bypasses RLS |

## Quick Start

### 1. Access Teams Settings

Navigate to `/dashboard/settings/teams` to manage your teams.

### 2. Create a Team

> **Mode Restriction**: Team creation is only available in `multi-tenant` mode. In other modes, this endpoint returns `403 Forbidden`.

```typescript
// Using the API (multi-tenant mode only)
const response = await fetch('/api/v1/teams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Team',
    slug: 'my-team',
    description: 'A collaborative workspace'
  })
})

// Check mode before showing create UI
import { useTeamsConfig } from '@/core/hooks/useTeamsConfig'
const { canCreate } = useTeamsConfig()
if (canCreate) {
  // Show create team button
}
```

### 3. Invite Members

> **Mode Restriction**: Invitations are disabled in `single-user` mode. All other modes support invitations.

```typescript
// Invite via API (all modes except single-user)
const response = await fetch(`/api/v1/teams/${teamId}/members`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'colleague@example.com',
    role: 'member'
  })
})

// Check mode before showing invite UI
import { useTeamsConfig } from '@/core/hooks/useTeamsConfig'
const { canInvite } = useTeamsConfig()
if (canInvite) {
  // Show invite member button
}
```

### 4. Switch Teams

> **Mode Restriction**: Team switching is only available in `multi-tenant` mode. The TeamSwitcher component returns `null` in other modes.

Use the TeamSwitcher component in the sidebar or programmatically:

```typescript
import { useTeamContext } from '@/core/contexts/TeamContext'
import { useTeamsConfig } from '@/core/hooks/useTeamsConfig'

function MyComponent() {
  const { currentTeam, switchTeam } = useTeamContext()
  const { canSwitch } = useTeamsConfig()

  // Only enable switching in supported modes
  if (!canSwitch) return null

  const handleSwitch = async (teamId: string) => {
    await switchTeam(teamId)
    // Page will reload with new team context
  }
}
```

## File Structure

```text
core/
+-- contexts/
|   +-- TeamContext.tsx          # React context and provider
+-- hooks/
|   +-- useTeam.ts               # Single team operations
|   +-- useTeams.ts              # List user's teams
|   +-- useTeamMembers.ts        # Team member management
|   +-- useTeamInvitations.ts    # Invitation management
+-- components/teams/
|   +-- TeamSwitcher.tsx         # Full team switcher
|   +-- TeamSwitcherCompact.tsx  # Compact sidebar version
|   +-- TeamSwitchModal.tsx      # Animated transition modal
|   +-- TeamMembersList.tsx      # Members table
|   +-- TeamBadge.tsx            # Role badges
|   +-- CreateTeamDialog.tsx     # New team form
|   +-- InviteMemberDialog.tsx   # Invite form
+-- lib/
|   +-- teams/
|   |   +-- actions.ts           # Server actions
|   |   +-- helpers.ts           # Mode helper functions
|   |   +-- permissions.ts       # Permission utilities
|   +-- entities/core/teams/
|       +-- config.ts            # Entity configuration
|       +-- schema.ts            # Zod schemas
|       +-- types.ts             # TypeScript types
|       +-- messages/            # i18n translations
|           +-- en.json
|           +-- es.json
app/
+-- api/v1/
|   +-- teams/
|   |   +-- route.ts             # GET/POST teams
|   |   +-- switch/route.ts      # POST switch team
|   |   +-- [teamId]/
|   |       +-- route.ts         # GET/PATCH/DELETE team
|   |       +-- members/
|   |           +-- route.ts     # GET/POST members
|   |           +-- [memberId]/route.ts
|   +-- team-invitations/
|       +-- route.ts             # GET pending invitations
|       +-- [token]/
|           +-- accept/route.ts  # POST accept
|           +-- decline/route.ts # POST decline
+-- accept-invite/
|   +-- [token]/page.tsx         # Invitation landing page
+-- dashboard/settings/teams/
    +-- page.tsx                 # Teams management page
```

## Related Documentation

- [Database Schema](./02-database-schema.md) - Tables, RLS policies, and migrations
- [API Reference](./03-api-reference.md) - All team endpoints
- [React Integration](./04-react-integration.md) - Context, hooks, and components
- [Permissions System](./06-permissions.md) - Role-based access control
- [Entity Integration](./07-entity-integration.md) - Adding teamId to entities
- [Configuration](./09-configuration.md) - Dashboard and UI settings
- [Troubleshooting](./10-troubleshooting.md) - Common issues and solutions
