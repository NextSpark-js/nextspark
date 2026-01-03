---
title: React Integration
description: TeamContext, hooks, and client-side team management
---

# React Integration

The Teams system provides a React context and custom hooks for managing teams on the client side.

## TeamContext

The `TeamContext` provides global team state and switching functionality.

### Setup

The `TeamProvider` should be placed inside `QueryClientProvider` in your root layout:

```tsx
// app/layout.tsx
import { TeamProvider } from '@/core/contexts/TeamContext'
import { QueryProvider } from '@/core/providers/QueryProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>
          <TeamProvider>
            {children}
          </TeamProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
```

### Context Value

```typescript
interface TeamContextValue {
  // Current active team
  currentTeam: Team | null

  // All teams the user belongs to
  userTeams: UserTeamMembership[]

  // Loading state
  isLoading: boolean

  // Switching state (during team change)
  isSwitching: boolean

  // Switch to a different team
  switchTeam: (teamId: string) => Promise<void>

  // Refresh teams list from API
  refreshTeams: () => Promise<void>
}
```

### Using the Context

> **Mode Awareness**: When using the context directly, always check mode capabilities with `useTeamsConfig()` before rendering team switching UI.

```tsx
'use client'

import { useTeamContext } from '@/core/contexts/TeamContext'
import { useTeamsConfig } from '@/core/hooks/useTeamsConfig'

function MyComponent() {
  const {
    currentTeam,
    userTeams,
    isLoading,
    isSwitching,
    switchTeam,
    refreshTeams
  } = useTeamContext()

  // Always check mode capabilities
  const { canSwitch, canCreate, canInvite } = useTeamsConfig()

  if (isLoading) {
    return <div>Loading teams...</div>
  }

  return (
    <div>
      <h1>Current Team: {currentTeam?.name}</h1>

      {/* Only show team list if switching is available */}
      {canSwitch && userTeams.length > 1 && (
        <>
          <h2>Your Teams:</h2>
          <ul>
            {userTeams.map(({ team, role }) => (
              <li key={team.id}>
                {team.name} ({role})
                <button
                  onClick={() => switchTeam(team.id)}
                  disabled={isSwitching || team.id === currentTeam?.id}
                >
                  {team.id === currentTeam?.id ? 'Active' : 'Switch'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Single team display for restricted modes */}
      {!canSwitch && currentTeam && (
        <p>You are working in: {currentTeam.name}</p>
      )}
    </div>
  )
}
```

**Mode Capability Helpers:**

| Helper | Description | Available in Modes |
|--------|-------------|-------------------|
| `canSwitch` | User can switch between teams | `multi-tenant` |
| `canCreate` | User can create new teams | `multi-tenant` |
| `canInvite` | User can invite members | `single-tenant`, `multi-tenant` |
| `allowCreateTeams` | User can create additional teams | `multi-tenant` (controlled by config) |

### Team Switching Behavior

When `switchTeam()` is called:

1. Sets `isSwitching` to `true`
2. Opens the `TeamSwitchModal` with animation
3. Updates `currentTeam` immediately (optimistic)
4. Persists to `localStorage` for hydration
5. Calls `/api/v1/teams/switch` to update server session
6. Clears TanStack Query cache (`queryClient.clear()`)
7. Performs a full page reload to ensure fresh data
8. Dispatches `team-switched` custom event

```tsx
// Listen for team switch events
useEffect(() => {
  const handleTeamSwitch = (event: CustomEvent) => {
    console.log('Team switched to:', event.detail.teamId)
  }

  window.addEventListener('team-switched', handleTeamSwitch)
  return () => window.removeEventListener('team-switched', handleTeamSwitch)
}, [])
```

---

## Custom Hooks

### useTeams

Fetches all teams for the current user using TanStack Query.

```tsx
import { useTeams } from '@/core/hooks/useTeams'

function TeamList() {
  const { data: teams, isLoading, error, refetch } = useTeams()

  if (isLoading) return <Spinner />
  if (error) return <Error message={error.message} />

  return (
    <ul>
      {teams.map(team => (
        <li key={team.id}>{team.name}</li>
      ))}
    </ul>
  )
}
```

**Options:**

```typescript
const { data } = useTeams({
  search: 'project',   // Search term
  enabled: true,       // Enable/disable query
})
```

### useTeam

Fetches a single team by ID.

```tsx
import { useTeam } from '@/core/hooks/useTeam'

function TeamDetail({ teamId }: { teamId: string }) {
  const { data: team, isLoading } = useTeam(teamId)

  if (isLoading) return <Spinner />

  return (
    <div>
      <h1>{team.name}</h1>
      <p>{team.description}</p>
      <span>Members: {team.memberCount}</span>
    </div>
  )
}
```

### useTeamMembers

Fetches and manages team members.

```tsx
import { useTeamMembers } from '@/core/hooks/useTeamMembers'

function MembersList({ teamId }: { teamId: string }) {
  const {
    data: members,
    isLoading,
    updateRole,
    removeMember,
    isUpdating,
    isRemoving
  } = useTeamMembers(teamId)

  const handleRoleChange = async (memberId: string, newRole: string) => {
    await updateRole({ memberId, role: newRole })
  }

  const handleRemove = async (memberId: string) => {
    if (confirm('Remove this member?')) {
      await removeMember(memberId)
    }
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {members?.map(member => (
          <tr key={member.id}>
            <td>{member.user.firstName} {member.user.lastName}</td>
            <td>{member.user.email}</td>
            <td>
              <select
                value={member.role}
                onChange={e => handleRoleChange(member.id, e.target.value)}
                disabled={isUpdating || member.role === 'owner'}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </td>
            <td>
              {member.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={isRemoving}
                >
                  Remove
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### useTeamInvitations

Manages team invitations.

```tsx
import { useTeamInvitations } from '@/core/hooks/useTeamInvitations'

function InvitationsManager({ teamId }: { teamId: string }) {
  const {
    // Pending invitations for this team
    pendingInvitations,

    // User's pending invitations (received)
    userInvitations,

    // Mutations
    sendInvitation,
    cancelInvitation,
    acceptInvitation,
    declineInvitation,

    // Loading states
    isSending,
    isCancelling,
    isAccepting,
    isDeclining
  } = useTeamInvitations(teamId)

  const handleInvite = async (email: string, role: string) => {
    await sendInvitation({ email, role })
  }

  return (
    <div>
      {/* Invite form */}
      <InviteForm onSubmit={handleInvite} isLoading={isSending} />

      {/* Pending invitations */}
      <h3>Pending Invitations</h3>
      {pendingInvitations?.map(inv => (
        <div key={inv.id}>
          {inv.email} - {inv.role}
          <button onClick={() => cancelInvitation(inv.id)}>
            Cancel
          </button>
        </div>
      ))}
    </div>
  )
}
```

---

## Query Keys

The hooks use consistent query keys for cache management:

```typescript
// Teams list
['teams', { type, search }]

// Single team
['team', teamId]

// Team members
['team-members', teamId]

// Team invitations
['team-invitations', teamId]

// User's pending invitations
['user-invitations']
```

### Manual Cache Invalidation

```tsx
import { useQueryClient } from '@tanstack/react-query'

function MyComponent() {
  const queryClient = useQueryClient()

  const refreshAllTeamData = () => {
    // Invalidate all team-related queries
    queryClient.invalidateQueries({ queryKey: ['teams'] })
    queryClient.invalidateQueries({ queryKey: ['team-members'] })
    queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
  }

  const refreshSpecificTeam = (teamId: string) => {
    queryClient.invalidateQueries({ queryKey: ['team', teamId] })
    queryClient.invalidateQueries({ queryKey: ['team-members', teamId] })
  }
}
```

---

## TypeScript Types

```typescript
// Team entity
interface Team {
  id: string
  name: string
  slug: string
  description: string | null
  ownerId: string
  avatarUrl: string | null
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Team with member count
interface TeamWithMemberCount extends Team {
  memberCount: number
  userRole?: TeamRole
}

// User's team membership
interface UserTeamMembership {
  team: Team
  role: TeamRole
  joinedAt: string
}

// Team member with user details
interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: string
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    image: string | null
  }
}

// Team invitation
interface TeamInvitation {
  id: string
  teamId: string
  email: string
  role: TeamRole
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  token: string
  expiresAt: string
  invitedBy: string
  team?: Team
  invitedByUser?: {
    firstName: string
    lastName: string
  }
}

// Team roles
type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'
```

---

## Best Practices

### 1. Always Check Loading States

```tsx
const { currentTeam, isLoading } = useTeamContext()

if (isLoading) {
  return <TeamSkeleton />
}

if (!currentTeam) {
  return <NoTeamSelected />
}

return <TeamDashboard team={currentTeam} />
```

### 2. Check Mode Before Rendering Team Features

> **Important**: Always use `useTeamsConfig()` to check mode capabilities before rendering team-related UI. This prevents showing disabled features in restricted modes.

```tsx
import { useTeamsConfig } from '@/core/hooks/useTeamsConfig'

function TeamFeatures() {
  const { mode, canSwitch, canCreate, canInvite } = useTeamsConfig()

  return (
    <div>
      {/* Team switcher only in multi-tenant mode */}
      {canSwitch && <TeamSwitcher />}

      {/* Create team button only if allowed */}
      {canCreate && <CreateTeamButton />}

      {/* Invite button only if allowed (all modes except single-user) */}
      {canInvite && <InviteMemberButton />}

      {/* Show mode-specific message */}
      {mode === 'single-user' && (
        <p className="text-muted-foreground">
          This is your personal workspace.
        </p>
      )}
    </div>
  )
}
```

**Mode-Specific Considerations:**

| Mode | UI Behavior |
|------|-------------|
| `single-user` | Hide all team collaboration UI |
| `single-tenant` | Show invite UI, hide switcher/create |
| `multi-tenant` | Show all team features |

### 3. Handle Team Context in Server Components

Pass team data from server to client:

```tsx
// Server Component
async function TeamPage({ params }) {
  const team = await getTeam(params.teamId)
  return <TeamClient team={team} />
}

// Client Component
'use client'
function TeamClient({ team }) {
  // Use passed team data, context for switching
  const { switchTeam } = useTeamContext()
  // ...
}
```

### 3. Use Optimistic Updates

The hooks support optimistic updates for better UX:

```tsx
const { updateRole } = useTeamMembers(teamId)

// This will update UI immediately, then sync with server
await updateRole({ memberId, role: 'admin' })
```

### 4. Clean Up on Team Switch

If your component caches team-specific data:

```tsx
useEffect(() => {
  const handleSwitch = () => {
    // Clear local state when team changes
    setLocalData(null)
  }

  window.addEventListener('team-switched', handleSwitch)
  return () => window.removeEventListener('team-switched', handleSwitch)
}, [])
```

## Related Documentation

- [UI Components](./05-ui-components.md) - TeamSwitcher, dialogs, etc.
- [Permissions System](./06-permissions.md) - Role-based access
- [API Reference](./03-api-reference.md) - Backend endpoints
- [Billing Integration](../19-billing/03-hooks-context.md) - Subscription hooks
