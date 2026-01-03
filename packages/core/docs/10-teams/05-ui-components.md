---
title: UI Components
description: Team management UI components and usage
---

# UI Components

The Teams system provides pre-built UI components for common team management tasks.

## TeamSwitcher

Full-featured team switcher dropdown.

> **Conditional Rendering**: This component returns `null` when team switching is disabled. It's only visible in `multi-tenant` mode. The component internally checks `canSwitchTeams()` from `useTeamsConfig`.

```tsx
import { TeamSwitcher } from '@/core/components/teams/TeamSwitcher'

function Header() {
  return (
    <nav>
      {/* Returns null in single-user and single-tenant modes */}
      <TeamSwitcher />
    </nav>
  )
}
```

**Mode Visibility:**

| Mode | TeamSwitcher Visible |
|------|---------------------|
| `single-user` | ❌ Returns `null` |
| `single-tenant` | ❌ Returns `null` |
| `multi-tenant` | ✅ Rendered |

**Features:**

- Displays current team with avatar
- Shows user's role in each team
- Quick switch functionality
- "Create Team" option (controlled by `allowCreateTeams` config)
- Checkmark on active team

## TeamSwitcherCompact

Compact version for sidebar footer.

> **Conditional Rendering**: Like `TeamSwitcher`, this component returns `null` when team switching is disabled. It's only visible in `multi-tenant` mode. Uses the same `canSwitchTeams()` check internally.

```tsx
import { TeamSwitcherCompact } from '@/core/components/teams/TeamSwitcherCompact'

function Sidebar() {
  return (
    <aside>
      {/* Navigation items */}

      <footer>
        {/* Returns null in single-user and single-tenant modes */}
        <TeamSwitcherCompact className="border-t" />
      </footer>
    </aside>
  )
}
```

**Mode Visibility:**

| Mode | TeamSwitcherCompact Visible |
|------|-----------------------------|
| `single-user` | ❌ Returns `null` |
| `single-tenant` | ❌ Returns `null` |
| `multi-tenant` | ✅ Rendered |

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | string | - | Additional CSS classes |

**Features:**

- Minimal footprint
- Dropdown opens upward
- Shows team avatar and name
- Role badge
- Link to Teams settings
- "Create Team" option (controlled by `allowCreateTeams` config)

## TeamSwitchModal

Animated modal shown during team switching.

```tsx
import { TeamSwitchModal } from '@/core/components/teams/TeamSwitchModal'

// Usually used internally by TeamContext, but can be used standalone:
<TeamSwitchModal
  isOpen={isSwitching}
  fromTeam={previousTeam}
  toTeam={newTeam}
  onComplete={handleComplete}
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | boolean | Whether modal is visible |
| `fromTeam` | Team \| null | Previous team |
| `toTeam` | Team \| null | New team |
| `onComplete` | () => void | Called when animation finishes |

**Animation Sequence:**

1. Previous team avatar fades out
2. Switch icon wiggles
3. New team avatar zooms in
4. Progress bar fills
5. Checkmark appears
6. Auto-closes after ~1.4s

## TeamBadge

Badge component for displaying team roles.

```tsx
import { TeamBadge } from '@/core/components/teams/TeamBadge'

// Role badge
<TeamBadge role="owner" />     // Shows "Owner" badge
<TeamBadge role="admin" />     // Shows "Admin" badge
<TeamBadge role="member" />    // Shows "Member" badge
<TeamBadge role="viewer" />    // Shows "Viewer" badge
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `role` | TeamRole | Role to display |
| `className` | string | Additional CSS classes |

## TeamMembersList

Table component for displaying and managing team members.

```tsx
import { TeamMembersList } from '@/core/components/teams/TeamMembersList'

function TeamSettings({ teamId }) {
  return (
    <TeamMembersList
      teamId={teamId}
      showActions={true}
      onRoleChange={(memberId, role) => console.log('Role changed')}
      onRemove={(memberId) => console.log('Member removed')}
    />
  )
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `teamId` | string | required | Team ID |
| `showActions` | boolean | true | Show role/remove actions |
| `onRoleChange` | function | - | Callback when role changes |
| `onRemove` | function | - | Callback when member removed |
| `currentUserRole` | TeamRole | - | Current user's role (for permissions) |

**Features:**

- User avatar and name
- Email address
- Role selector (for admins)
- Remove button (for admins)
- Joined date
- Disabled actions for owner

## CreateTeamDialog

Modal dialog for creating new teams.

> **Mode Restriction**: Team creation is only available in `multi-tenant` mode. Always check `canCreateTeams()` before rendering the create button. Additionally, the `allowCreateTeams` option in `app.config.ts` controls whether users can create additional teams beyond their signup team.

```tsx
import { CreateTeamDialog } from '@/core/components/teams/CreateTeamDialog'
import { useTeamsConfig } from '@/core/hooks/useTeamsConfig'

function TeamsPage() {
  const [open, setOpen] = useState(false)
  const { canCreate } = useTeamsConfig()

  // Don't show create button if mode doesn't allow team creation
  if (!canCreate) {
    return null
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Create Team
      </Button>

      <CreateTeamDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={(team) => {
          console.log('Created:', team)
          setOpen(false)
        }}
      />
    </>
  )
}
```

**Mode Availability:**

| Mode | Create Team Available |
|------|----------------------|
| `single-user` | ❌ Disabled |
| `single-tenant` | ❌ Disabled |
| `multi-tenant` | ✅ Available (controlled by `allowCreateTeams`) |

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `open` | boolean | Whether dialog is open |
| `onOpenChange` | (open: boolean) => void | Open state handler |
| `onSuccess` | (team: Team) => void | Called after successful creation |

**Form Fields:**

- **Name** - Team display name (required)
- **Slug** - URL-friendly identifier (auto-generated, editable)
- **Description** - Optional team description

**Validation:**

- Name: 2-100 characters
- Slug: lowercase alphanumeric with hyphens
- Real-time slug availability check

## InviteMemberDialog

Modal dialog for inviting new members.

> **Mode Restriction**: Invitations are disabled in `single-user` mode. All other modes support invitations.

```tsx
import { InviteMemberDialog } from '@/core/components/teams/InviteMemberDialog'

function MembersSection({ teamId }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Invite Member
      </Button>

      <InviteMemberDialog
        teamId={teamId}
        open={open}
        onOpenChange={setOpen}
        onSuccess={(invitation) => {
          toast.success(`Invitation sent to ${invitation.email}`)
          setOpen(false)
        }}
      />
    </>
  )
}
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `teamId` | string | Team to invite to |
| `open` | boolean | Whether dialog is open |
| `onOpenChange` | (open: boolean) => void | Open state handler |
| `onSuccess` | (invitation: TeamInvitation) => void | Called after successful invite |

**Form Fields:**

- **Email** - Invitee's email address (required)
- **Role** - Role to assign (admin, member, viewer)

## Mobile Components

### MobileMoreSheet Integration

The TeamSwitcherCompact is integrated into the mobile navigation:

```tsx
// In MobileMoreSheet.tsx
import { TeamSwitcherCompact } from '@/core/components/teams/TeamSwitcherCompact'

export function MobileMoreSheet({ isOpen, onOpenChange }) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        {/* Menu items */}

        {/* Team Switcher */}
        <Separator className="my-2" />
        <TeamSwitcherCompact className="border-0 p-0" />

        <Separator className="my-4" />

        {/* Sign Out */}
      </SheetContent>
    </Sheet>
  )
}
```

## Styling & Theming

All components use CSS variables and shadcn/ui primitives:

```tsx
// Components use theme variables
<div className="bg-background text-foreground border-border">
  {/* Content */}
</div>

// Custom styling via className prop
<TeamSwitcherCompact className="border-t border-sidebar-border" />
```

## Accessibility

All components include:

- **ARIA labels** - Descriptive labels for screen readers
- **Keyboard navigation** - Tab, Enter, Escape support
- **Focus management** - Proper focus trapping in modals
- **Role attributes** - Correct semantic roles
- **Contrast ratios** - WCAG AA compliant

```tsx
// Example ARIA usage in TeamSwitcher
<DropdownMenu>
  <DropdownMenuTrigger
    aria-label={t('teams.switcher.switchTeam')}
    aria-haspopup="menu"
  >
    {/* ... */}
  </DropdownMenuTrigger>
</DropdownMenu>
```

## Testing Attributes

All components include `data-cy` attributes for E2E testing:

```tsx
// Component
<Button data-cy="create-team-button">Create Team</Button>

// Cypress test
cy.get('[data-cy="create-team-button"]').click()
```

**Available Selectors:**

> **Important**: Some selectors are only available in certain modes. Components that return `null` in restricted modes will not render their `data-cy` attributes. Always verify the configured mode before asserting selector presence.

| Selector | Component | Mode Availability |
|----------|-----------|-------------------|
| `team-switcher` | TeamSwitcher dropdown | `multi-tenant` only |
| `team-switcher-compact` | TeamSwitcherCompact | `multi-tenant` only |
| `team-switch-modal` | TeamSwitchModal | `multi-tenant` only |
| `create-team-button` | Create team button | `multi-tenant` only |
| `create-team-dialog` | CreateTeamDialog | `multi-tenant` only |
| `create-team-form` | Form inside CreateTeamDialog | `multi-tenant` only |
| `invite-member-dialog` | InviteMemberDialog | `single-tenant`, `multi-tenant` |
| `team-members-list` | TeamMembersList | All modes |
| `team-member-row` | Individual member row | All modes |
| `mobile-team-switcher` | Mobile navigation team switcher | `multi-tenant` only |

**Testing Mode-Dependent UI:**

```typescript
// Cypress: Check if selector should exist based on mode
describe('Team Switcher', () => {
  it('should be visible in multi-tenant mode', () => {
    // Configure app for multi-tenant mode in test
    cy.get('[data-cy="team-switcher"]').should('exist')
  })

  it('should NOT exist in single-user mode', () => {
    // Configure app for single-user mode in test
    cy.get('[data-cy="team-switcher"]').should('not.exist')
  })
})
```

## Related Documentation

- [React Integration](./04-react-integration.md) - Hooks and context
- [Configuration](./09-configuration.md) - Customization options
- [Troubleshooting](./10-troubleshooting.md) - Common issues
