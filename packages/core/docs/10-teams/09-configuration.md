---
title: Configuration
description: Teams system configuration options
---

# Configuration

The Teams system can be customized through dashboard configuration and entity settings.

## Dashboard Configuration

### User Menu Settings

Control the user role display in the topbar:

```typescript
// core/lib/config/dashboard.config.ts
// or contents/themes/default/config/dashboard.config.ts

export const DASHBOARD_CONFIG = {
  topbar: {
    userMenu: {
      enabled: true,
      showAvatar: true,
      showEmail: true,
      showRole: false, // Disabled - team roles shown in TeamSwitcher instead
      items: [
        { type: 'link', label: 'navigation.profile', href: '/dashboard/settings/profile', icon: 'user' },
        { type: 'link', label: 'navigation.settings', href: '/dashboard/settings', icon: 'settings' },
        { type: 'divider' },
        { type: 'action', label: 'buttons.signOut', action: 'signOut', icon: 'log-out' },
      ],
    },
  },
  // ...
}
```

### Teams Settings Page

Enable/disable the Teams settings page:

> **Important**: These feature flags control UI visibility but do **not** override mode restrictions. For example, setting `createTeams: true` won't enable team creation in `single-user` mode. The Teams Mode configuration in `app.config.ts` takes precedence.

```typescript
export const DASHBOARD_CONFIG = {
  settings: {
    pages: {
      teams: {
        enabled: true,
        label: 'settings.pages.teams',
        description: 'settings.pages.teamsDescription',
        icon: 'users',
        order: 7,
        features: {
          // Note: These are additional UI controls, not overrides for mode restrictions
          createTeams: true,   // UI flag, mode still controls actual ability
          manageMembers: true,
          inviteMembers: true, // Won't work in single-user mode regardless
          teamSettings: true,
        },
      },
    },
  },
}
```

**Mode vs Feature Flag Priority:**

| Mode | `createTeams: true` Effect |
|------|---------------------------|
| `single-user` | ❌ Still disabled (mode restriction) |
| `single-tenant` | ❌ Still disabled (mode restriction) |
| `multi-tenant` | ✅ Enabled (further controlled by `allowCreateTeams` option) |

## Entity Configuration

### Team Isolation

Enable team isolation for entities:

```typescript
// Entity config
export const entityConfig: EntityConfig = {
  slug: 'my-entity',

  // Enable team isolation
  features: {
    teamIsolation: true,
  },

  // Configure sharing behavior
  access: {
    // true = all team members see all records
    // false = users only see their own records
    shared: true,
  },
}
```

### Access Levels

| Setting | Description | Use Case |
|---------|-------------|----------|
| `shared: true` | All team members see all records | Projects, Documents |
| `shared: false` | Users only see their own records | Tasks, Notes |

## Teams Entity (Core)

The Teams entity is a core entity that cannot be overridden:

```typescript
// core/lib/entities/core/teams/config.ts
export const teamsConfig: EntityConfig = {
  slug: 'teams',
  isCore: true, // Cannot be overridden

  name: {
    singular: 'Team',
    plural: 'Teams',
  },

  showInMenu: false, // Not in entity navigation
  showInQuickCreate: false,

  api: {
    enabled: false, // Custom API routes used instead
  },
}
```

## Internationalization

### Translation Keys

Teams translations are in the entity messages:

```text
core/lib/entities/core/teams/messages/
├── en.json
└── es.json
```

### Key Structure

```json
{
  "entity": {
    "singular": "Team",
    "plural": "Teams"
  },
  "fields": {
    "name": "Team Name",
    "slug": "Slug",
    "description": "Description",
    "role": "Role"
  },
  "roles": {
    "owner": "Owner",
    "admin": "Admin",
    "member": "Member",
    "viewer": "Viewer"
  },
  "actions": {
    "create": "Create Team",
    "invite": "Invite Member",
    "switch": "Switch Team"
  },
  "switcher": {
    "switchTeam": "Switch Team",
    "manageTeams": "Manage Teams",
    "active": "Active",
    "switchingTo": "Switching Team",
    "switchComplete": "Team Switched!",
    "loadingTeamData": "Loading team data...",
    "ready": "Ready! Redirecting..."
  },
  "messages": {
    "created": "Team created successfully",
    "memberInvited": "Member invited successfully"
  },
  "errors": {
    "notFound": "Team not found",
    "slugExists": "This slug is already in use"
  }
}
```

### Adding Custom Translations

If you need additional translation keys:

```typescript
// Use the teams namespace
const t = useTranslations('teams')

// Access translations
t('switcher.switchTeam') // "Switch Team"
t('roles.admin') // "Admin"
```

## Better Auth Integration

### Auto-Create Team on Signup

Teams are created automatically via Better Auth hooks based on the configured mode:

> **Important**: Team creation depends on the `teams.mode` setting in `app.config.ts`. Different modes create teams at different times or require invitations.

```typescript
// core/lib/auth.ts
export const auth = betterAuth({
  // ...
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const teamsMode = TEAMS_CONFIG.mode

          switch (teamsMode) {
            case 'single-user':
            case 'multi-tenant':
              // Always create a team for the user
              await createTeam(user.id)
              break

            case 'single-tenant':
              // Only first user creates the global team
              const existingTeam = await getGlobalTeam()
              if (!existingTeam) {
                await createTeam(user.id, `${user.name}'s Company`)
              }
              // Subsequent users must be invited
              break
          }
        }
      }
    }
  }
})
```

**Team Creation by Mode:**

| Mode | Team Created on Signup |
|------|------------------------|
| `single-user` | Team (auto) - isolated workspace |
| `single-tenant` | Team (first user only, then invite-required) |
| `multi-tenant` | Team (auto) - can create more if `allowCreateTeams: true` |

**Single-Tenant Special Case:**

In `single-tenant` mode, the first user to sign up creates the global team and becomes its owner. Subsequent signups are blocked and must use the invitation flow:

```typescript
// Simplified flow for single-tenant mode
async function handleSignup(userData) {
  if (isPublicSignupRestricted()) {
    // Check if global team exists
    const globalTeam = await getGlobalTeam()

    if (!globalTeam) {
      // First user: create global team
      return await createTeam(user.id)
    } else {
      // Subsequent users: must use invitation
      throw new Error('PUBLIC_SIGNUP_RESTRICTED')
    }
  }
}
```

### allowCreateTeams Option

In `multi-tenant` mode, you can control whether users can create additional teams beyond their signup team:

```typescript
// contents/themes/[theme]/app.config.ts
export const themeAppConfig: DeepPartial<AppConfig> = {
  teams: {
    mode: 'multi-tenant',
    options: {
      allowCreateTeams: false, // Users can only own 1 team (default: true)
    }
  }
}
```

| Setting | Behavior |
|---------|----------|
| `allowCreateTeams: true` (default) | Users can create unlimited teams |
| `allowCreateTeams: false` | Each user can only be owner of 1 team |

**Note:** The signup team is always created. This setting only controls creation of additional teams.

### Session Context

The middleware adds team context to requests:

```typescript
// middleware.ts
const activeTeamId = cookies.get('activeTeamId')?.value

// Add to headers for API routes
headers.set('x-team-id', activeTeamId)
```

## Mobile Navigation

### MobileMoreSheet Configuration

The TeamSwitcher is included in mobile navigation:

```typescript
// core/components/dashboard/mobile/MobileMoreSheet.tsx
import { TeamSwitcherCompact } from '@/core/components/teams/TeamSwitcherCompact'

// Positioned between menu items and sign out
<Separator className="my-2" />
<TeamSwitcherCompact className="border-0 p-0" />
<Separator className="my-4" />
```

## Environment Variables

No specific environment variables are required for Teams, but ensure these are set:

```env
# Database (required for team storage)
DATABASE_URL=postgresql://...

# Email (required for invitations)
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App URL (required for invitation links)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Feature Flags

You can disable teams features globally:

```typescript
// Example feature flag implementation
const TEAMS_FEATURES = {
  enabled: true,
  createWorkTeams: true,
  invitations: true,
  roleManagement: true,
}

// In components
if (!TEAMS_FEATURES.createWorkTeams) {
  return null // Hide create team option
}
```

## Performance Tuning

### Query Optimization

The Teams system uses optimized queries:

```sql
-- Helper function caches team IDs
CREATE FUNCTION get_user_team_ids() RETURNS TEXT[]
STABLE -- Can be cached during transaction
```

### Index Configuration

Ensure these indexes exist for performance:

```sql
-- Teams
CREATE INDEX idx_teams_owner ON teams("ownerId");
CREATE INDEX idx_teams_slug ON teams(slug);

-- Members
CREATE INDEX idx_team_members_user ON team_members("userId");
CREATE INDEX idx_team_members_team ON team_members("teamId");

-- Invitations
CREATE INDEX idx_invitations_token ON team_invitations(token);
CREATE INDEX idx_invitations_email ON team_invitations(email);
```

## Related Documentation

- [Overview](./01-overview.md) - System architecture
- [UI Components](./05-ui-components.md) - Component customization
- [Troubleshooting](./09-troubleshooting.md) - Common issues
