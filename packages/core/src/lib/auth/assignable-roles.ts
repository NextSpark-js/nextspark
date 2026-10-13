/**
 * The roles an admin assigns to a user (`users.role`) through core's routes: `member`, and `developer` only when the
 * caller is a developer (the developer role ranks above superadmin). `superadmin` is never assigned through the API,
 * and `suspended` only through the suspend action.
 */
export const ASSIGNABLE_USER_ROLES = ['member', 'developer'] as const

export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number]

/** Whether a caller with `callerRole` may assign `role` to another user. */
export function canGrantUserRole(callerRole: string | null | undefined, role: string): boolean {
  return role === 'member' || (role === 'developer' && callerRole === 'developer')
}

/**
 * Whether a caller with `callerRole` may change, suspend or delete another user whose role is `targetRole`: the developer
 * role ranks above superadmin, so only a developer acts on a developer or on a superadmin. This is the only rule: the
 * routes and the admin UI call it, none repeats it.
 */
export function canActOnUser(callerRole: string | null | undefined, targetRole: string): boolean {
  return (targetRole !== 'superadmin' && targetRole !== 'developer') || callerRole === 'developer'
}
