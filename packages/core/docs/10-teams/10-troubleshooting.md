---
title: Troubleshooting
description: Common issues and solutions for the Teams system
---

# Troubleshooting

This guide covers common issues and their solutions when working with the Teams system.

## Translation Issues

### Problem: Translation Keys Showing Instead of Values

**Symptom:** UI shows `teams.switcher.switchTeam` instead of "Switch Team"

**Cause:** The `teams` entity has its own i18n namespace that can override core translations.

**Solution:** Ensure all translation keys exist in the entity messages:

```json
// core/lib/entities/core/teams/messages/en.json
{
  "switcher": {
    "switchTeam": "Switch Team",
    "manageTeams": "Manage Teams",
    "active": "Active",
    "switchingTo": "Switching Team",
    "switchComplete": "Team Switched!",
    "loadingTeamData": "Loading team data...",
    "ready": "Ready! Redirecting..."
  }
}
```

**Note:** Entity namespaces can override core namespaces with the same name. The solution is to add all required keys to the entity's message files.

## Data Staleness After Team Switch

### Problem: Old Data Shows After Switching Teams

**Symptom:** After switching teams, you still see data from the previous team.

**Cause:** TanStack Query cache retains data after `router.refresh()`.

**Solution:** The TeamContext now uses `window.location.reload()` and `queryClient.clear()`:

```typescript
// core/contexts/TeamContext.tsx
const handleSwitchComplete = useCallback(() => {
  // Clear all TanStack Query cache
  queryClient.clear()

  // Force full page reload
  window.location.reload()
}, [queryClient])
```

If you're still experiencing issues:

1. Verify your component re-renders on team change
2. Check that your queries include team context
3. Ensure your hooks depend on `currentTeam`

```typescript
// Good: Query depends on team
const { data } = useQuery({
  queryKey: ['items', currentTeam?.id],
  queryFn: () => fetchItems(currentTeam?.id),
  enabled: !!currentTeam,
})

// Bad: Query doesn't consider team
const { data } = useQuery({
  queryKey: ['items'],
  queryFn: fetchItems,
})
```

## Team Switching Issues

### Problem: Can't Find Team Switcher

**Symptom:** The TeamSwitcher component is not visible in the UI.

**Cause:** This is expected behavior based on your Teams Mode configuration.

**Solution:** Check your configured mode in `app.config.ts`:

```typescript
// Check mode
import { TEAMS_CONFIG } from '@/core/lib/config/config-sync'
console.log('Teams Mode:', TEAMS_CONFIG.mode)
```

**Mode Visibility:**

| Mode | TeamSwitcher Visible | Reason |
|------|---------------------|--------|
| `single-user` | ❌ Hidden | Only one team exists |
| `single-tenant` | ❌ Hidden | Only one global team exists |
| `multi-tenant` | ✅ Visible | Multiple teams supported |

If you need team switching, change your mode to `multi-tenant`.

### Problem: Team Switch Doesn't Persist

**Symptom:** After refreshing, you're back to the previous team.

**Solution:** Verify localStorage and cookie are being set:

```typescript
// In TeamContext.tsx
localStorage.setItem('activeTeamId', teamId)

// Middleware should read from cookie
const activeTeamId = cookies.get('activeTeamId')?.value
```

Check browser DevTools:
- Application > Local Storage > `activeTeamId`
- Application > Cookies > `activeTeamId`

### Problem: Team Context Not Available

**Symptom:** `useTeamContext` throws "must be used within TeamProvider"

**Solution:** Ensure TeamProvider is in your component tree:

```tsx
// app/layout.tsx
<QueryProvider>
  <TeamProvider>
    {children}
  </TeamProvider>
</QueryProvider>
```

### Problem: "Create Team" Button Missing

**Symptom:** Cannot find the option to create new teams.

**Cause:** Team creation is disabled in your mode, or restricted by configuration.

**Mode Availability:**

| Mode | Create Team | Reason |
|------|-------------|--------|
| `single-user` | ❌ Disabled | One team only |
| `single-tenant` | ❌ Disabled | One global team only |
| `multi-tenant` | ✅ Enabled | Multiple teams allowed |

**Additional Check for multi-tenant:**

Even in `multi-tenant` mode, the button may be hidden if:
- `allowCreateTeams: false` is set in config AND user already owns a team
- Use `useTeam()` hook to check `canCurrentUserCreateTeam`

```typescript
const { canCurrentUserCreateTeam } = useTeam()
// If false, user has reached their team ownership limit
```

To enable team creation, change mode to `multi-tenant`. For unlimited team creation, ensure `allowCreateTeams: true` in options.

## RLS Policy Issues

### Problem: Users Can See Other Teams' Data

**Symptom:** Data from other teams appears in queries.

**Causes & Solutions:**

1. **RLS not enabled on table:**
```sql
ALTER TABLE public."your_table" ENABLE ROW LEVEL SECURITY;
```

2. **Missing RLS policy:**
```sql
CREATE POLICY "your_policy" ON public."your_table"
  FOR ALL TO authenticated
  USING ("teamId" = ANY(public.get_user_team_ids()));
```

3. **Query bypassing RLS:**
```typescript
// Bad: Direct query without RLS context
const data = await db.query('SELECT * FROM items')

// Good: Use queryWithRLS
const data = await queryWithRLS(
  'SELECT * FROM items WHERE "teamId" = $1',
  [teamId],
  userId
)
```

### Problem: Superadmin Can't See All Data

**Symptom:** Superadmin is blocked by RLS.

**Solution:** Ensure `is_superadmin()` bypass is in policy:

```sql
CREATE POLICY "policy_name" ON public."your_table"
  FOR ALL TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin() -- Add this
  );
```

## API Issues

### Problem: 401 Unauthorized on Team Endpoints

**Causes:**

1. **Missing authentication:**
```typescript
// Ensure dual auth is implemented
const authResult = await authenticateRequest(req)
if (!authResult.success) {
  return createApiError('Unauthorized', 401)
}
```

2. **Expired session:**
- Clear cookies and log in again
- Check session expiration settings

3. **Invalid API key:**
- Verify API key exists and is active
- Check rate limits

### Problem: 403 Forbidden When Managing Members

**Cause:** User doesn't have required role.

**Solution:** Verify user has `owner` or `admin` role:

```typescript
const member = await getTeamMember(userId, teamId)
if (!['owner', 'admin'].includes(member?.role)) {
  return createApiError('Forbidden', 403)
}
```

### Problem: Team Creation Fails with "Slug Exists"

**Symptom:** 409 Conflict error when creating team.

**Solution:**
1. Use a different slug
2. Check if team was soft-deleted (not supported yet)
3. Verify slug format: lowercase alphanumeric with hyphens

```typescript
// Valid slugs
'my-team'
'team-123'
'project-alpha'

// Invalid slugs
'My Team'      // Spaces
'Team_123'     // Underscore
'UPPERCASE'    // Not lowercase
```

## Invitation Issues

### Problem: Invitation Email Not Received

**Causes & Solutions:**

1. **Email service not configured:**
```env
RESEND_API_KEY=your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

2. **Email in spam folder:**
- Check spam/junk folder
- Add sender to whitelist

3. **Invalid email address:**
- Verify email format
- Check for typos

### Problem: Invitation Link Not Working

**Symptom:** "Invalid or expired invitation" error.

**Causes:**

1. **Invitation expired:**
   - Default expiration is 7 days
   - Send a new invitation

2. **Already accepted:**
   - Check if user is already a team member

3. **Token malformed:**
   - Ensure full URL is used
   - Check for URL encoding issues

### Problem: Can't Accept Invitation (Wrong Email)

**Symptom:** "Email doesn't match" error.

**Cause:** Logged-in user's email differs from invitation email.

**Solution:**
1. Log out
2. Sign up with the invited email, OR
3. Request new invitation to correct email

## Mobile Issues

### Problem: TeamSwitcher Not Visible on Mobile

**Symptom:** Can't switch teams on mobile devices.

**Solution:** The TeamSwitcherCompact is in MobileMoreSheet:

```tsx
// core/components/dashboard/mobile/MobileMoreSheet.tsx
import { TeamSwitcherCompact } from '@/core/components/teams/TeamSwitcherCompact'

// Inside the sheet
<TeamSwitcherCompact className="border-0 p-0" />
```

Verify the component is rendered by checking:
- MobileMoreSheet is included in layout
- TeamSwitcherCompact import is correct

## Performance Issues

### Problem: Slow Team Switching

**Possible Causes:**

1. **Large cache to clear:**
   - Normal for apps with lots of cached data
   - Consider selective invalidation

2. **Slow API response:**
   - Check network tab for slow requests
   - Verify database indexes exist

3. **Heavy page re-render:**
   - Profile with React DevTools
   - Check for unnecessary re-renders

### Problem: Teams List Loading Slow

**Solution:** Ensure indexes exist:

```sql
CREATE INDEX idx_team_members_user ON team_members("userId");
CREATE INDEX idx_teams_owner ON teams("ownerId");
```

## Database Issues

### Problem: Migration Fails

**Common Errors:**

1. **Table/column already exists:**
```sql
-- Use IF NOT EXISTS pattern
CREATE TABLE IF NOT EXISTS public."teams" (...);
ALTER TABLE public."teams" ADD COLUMN IF NOT EXISTS "description" TEXT;
```

2. **Foreign key constraint:**
- Ensure referenced tables exist
- Run migrations in correct order

3. **Permission denied:**
- Check database user has CREATE permission
- Verify RLS is properly configured

### Problem: Team Not Created on Signup

**Symptom:** User has no teams after registration.

**Possible Causes:**

1. **Mode doesn't create teams automatically:**

   | Mode | Team Created on Signup |
   |------|------------------------|
   | `single-user` | ✅ Team (auto) |
   | `single-tenant` | ✅ Team (first user only) |
   | `multi-tenant` | ✅ Team (auto) |

   In `single-tenant` mode, only the **first user** creates a team. Subsequent users must be invited.

2. **Better Auth callback failed:**

   Check the callback is configured correctly:

   ```typescript
   // core/lib/auth.ts
   databaseHooks: {
     user: {
       create: {
         after: async (user) => {
           try {
             const teamsMode = TEAMS_CONFIG.mode
             switch (teamsMode) {
               case 'single-user':
               case 'multi-tenant':
                 await createTeam(user.id)
                 break
               case 'single-tenant':
                 const existingTeam = await getGlobalTeam()
                 if (!existingTeam) {
                   await createTeam(user.id)
                 }
                 break
             }
           } catch (error) {
             console.error('Failed to create team:', error)
           }
         }
       }
     }
   }
   ```

3. **Single-tenant mode after first user:**

   In `single-tenant` mode, only the **first user** creates a team automatically. Subsequent users must be invited via `/api/v1/auth/signup-with-invite`.

## Permission Issues

### Problem: Redirected to Permission Denied Page

**Symptom:** Trying to access an entity page results in redirect to `/dashboard/permission-denied`.

**Cause:** Server-side permission validation in `[entity]/layout.tsx` detected insufficient permissions.

**Solutions:**

1. **Check team role:**
   ```typescript
   // Your team role determines entity permissions
   const { userTeams, currentTeam } = useTeamContext()
   const membership = userTeams.find(m => m.team.id === currentTeam?.id)
   console.log('Current role:', membership?.role) // owner, admin, member, viewer
   ```

2. **Check cookie is set:**
   - Open DevTools > Application > Cookies
   - Verify `activeTeamId` cookie exists
   - If missing, switch teams or refresh

3. **Check permission configuration:**
   ```typescript
   // core/lib/permissions/defaults.ts
   // Member role permissions for entities
   const defaultPermissions = {
     member: {
       'companies.list': true,
       'companies.read': true,
       'companies.create': false,  // <-- This might be blocking
       'companies.update': false,
       'companies.delete': false,
     }
   }
   ```

### Problem: Edit/Delete Buttons Missing

**Symptom:** Can view entity details but Edit/Delete buttons are not visible.

**Cause:** UI permission hooks hiding buttons based on role.

**This is expected behavior.** The hooks `usePermission` and `usePermissions` check role-based permissions:

```typescript
// EntityDetail uses permission checks
const { canUpdate, canDelete } = usePermissions({
  canUpdate: `${entitySlug}.update`,
  canDelete: `${entitySlug}.delete`,
})

// Buttons only render if user has permission
{canUpdate && <Button>Edit</Button>}
{canDelete && <Button>Delete</Button>}
```

**To verify permissions work correctly:**
- Log in as `owner` or `admin` - should see Edit/Delete
- Log in as `member` - should NOT see Edit/Delete
- Log in as `viewer` - should NOT see Edit/Delete

### Problem: Cookie Not Being Set

**Symptom:** Server-side validation fails because `activeTeamId` cookie is missing.

**Causes & Solutions:**

1. **TeamContext not loading:**
   - Ensure TeamProvider is in the component tree
   - Check for errors in browser console

2. **Team switch API not setting cookie:**
   - `/api/v1/teams/switch` should set the `activeTeamId` cookie
   - Check API response for Set-Cookie header

3. **Cookie blocked by browser:**
   - Check if third-party cookies are blocked
   - Verify SameSite policy allows the cookie

**Manual cookie debug:**
```typescript
// In browser console
document.cookie.includes('activeTeamId') // Should be true
```

## Debugging Tips

### Enable Debug Logging

```typescript
// Add to API endpoints
console.log('[Teams Debug]', {
  userId: authResult.user?.id,
  teamId: req.headers.get('x-team-id'),
  action: 'create_team',
})
```

### Check Team Context

```typescript
// In React component
const { currentTeam, userTeams, isLoading } = useTeamContext()
console.log('Team Context:', { currentTeam, userTeams, isLoading })
```

### Verify RLS Policies

```sql
-- List policies on a table
SELECT * FROM pg_policies WHERE tablename = 'teams';

-- Test policy as specific user
SET request.jwt.claim.sub = 'user_id_here';
SELECT * FROM teams;
```

## Getting Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Search existing discussions
3. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details
   - Relevant code snippets

## Related Documentation

- [Overview](./01-overview.md) - System architecture
- [Database Schema](./02-database-schema.md) - Tables and RLS
- [API Reference](./03-api-reference.md) - Endpoints
- [Configuration](./08-configuration.md) - Settings
