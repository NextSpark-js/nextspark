/**
 * Which of the scopes asked for a user may hold in a team.
 *
 * Superadmin and developer are GLOBAL roles (`users.role`): they never appear among the team roles, so they are
 * special-cased here rather than in the scope data. Every other user is resolved through their TEAM role for
 * `teamId` (not their global `users.role`: entity authorization is team-scoped), and what that role holds comes
 * from `scopesOfRole`.
 *
 * `scopesOfRole` is a parameter so that this one implementation serves two callers without either importing the
 * other's data: `validateScopesForUser` (lib/api/auth) passes the scope registry's, and the consent of MCP browser
 * sign-in (#541) passes the same mapping computed from data `lib/auth` can import (lib/mcp/oauth/scopes).
 */
import { queryOne } from '../../db'
import { TeamMemberService } from '../../services/team-member.service'

export interface UserScopesResult {
  valid: boolean
  allowedScopes: string[]
  deniedScopes: string[]
}

export async function scopesAllowedForUser(
  userId: string,
  teamId: string | null,
  requestedScopes: string[],
  scopesOfRole: (teamRole: string) => string[]
): Promise<UserScopesResult> {
  const none = (): UserScopesResult => ({ valid: false, allowedScopes: [], deniedScopes: requestedScopes })
  const all = (): UserScopesResult => ({ valid: true, allowedScopes: requestedScopes, deniedScopes: [] })
  try {
    const user = await queryOne<{ role: string }>('SELECT role FROM "users" WHERE id = $1', [userId])
    if (!user) return none()

    if (user.role === 'superadmin' || user.role === 'developer') return all()

    // Non-superadmin with no resolvable team context: there is no role to check scopes against
    if (!teamId) return none()

    const teamRole = await TeamMemberService.getRole(teamId, userId)
    if (!teamRole) return none()

    const allowedScopes = scopesOfRole(teamRole)
    // Full access allows everything asked for
    if (allowedScopes.includes('*')) return all()

    const validScopes = requestedScopes.filter(scope => allowedScopes.includes(scope))
    const deniedScopes = requestedScopes.filter(scope => !allowedScopes.includes(scope))
    return { valid: deniedScopes.length === 0, allowedScopes: validScopes, deniedScopes }
  } catch (error) {
    console.error('Error validating scopes for user:', error)
    return none()
  }
}
