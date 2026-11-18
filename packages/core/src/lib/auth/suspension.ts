import { queryWithRLS } from '../db'
import { canActOnUser, restoredRole } from './assignable-roles'

/**
 * A suspended account: `users.role = 'suspended'` (allowed by `check_users_role` since migration 031). It gets no new
 * session (the session create hook in lib/auth.ts), and its existing session and its API keys are refused where core
 * authenticates: dual-auth, `validateAndAuthenticateRequest`, getAuthorizationSession, validateApiKey and the proxy
 * template.
 */
export const SUSPENDED_ROLE = 'suspended'

export function isSuspendedRole(role: unknown): boolean {
  return role === SUSPENDED_ROLE
}

/**
 * Suspends `userId` in one statement: sets the role, deletes the user's sessions and deactivates their active API keys
 * (`status = 'inactive'`, so the audit log keeps the rows; unsuspending does not bring them back). The role it replaces
 * goes to `"roleBeforeSuspension"` (migration 047) for unsuspendUser; suspending a suspended user keeps the stored one. The caller authorizes
 * (`canActOnUser`). Returns null when no user was suspended (unknown id).
 *
 * Both functions run on the service connection: the caller authorizes (the superadmin users route checks the role).
 */
export async function suspendUser(userId: string, actorId: string): Promise<{ sessions: number; apiKeys: number } | null> {
  const [result] = await queryWithRLS<{ suspended: number; sessions: number; keyHashes: string[] }>(
    `WITH suspended AS (
       UPDATE "users"
       SET "roleBeforeSuspension" = CASE WHEN role = '${SUSPENDED_ROLE}' THEN "roleBeforeSuspension" ELSE role END,
           role = '${SUSPENDED_ROLE}', "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id
     ), sessions AS (
       DELETE FROM "session" WHERE "userId" IN (SELECT id FROM suspended) RETURNING id
     ), keys AS (
       UPDATE "api_key" SET status = 'inactive'
       WHERE "userId" IN (SELECT id FROM suspended) AND status = 'active'
       RETURNING "keyHash"
     )
     SELECT (SELECT COUNT(*) FROM suspended)::int AS suspended,
            (SELECT COUNT(*) FROM sessions)::int AS sessions,
            COALESCE((SELECT json_agg("keyHash") FROM keys), '[]'::json) AS "keyHashes"`,
    [userId],
    actorId,
    { service: true }
  )
  if (!result?.suspended) return null
  // validateApiKey caches a key for 5 minutes in this process: drop the deactivated ones now.
  // Loaded here, only when a key was deactivated: lib/api/auth pulls in the whole config registry, which the node test of
  // the SQL here (real PostgreSQL, no build) does not have.
  if (result.keyHashes.length) {
    const { invalidateApiKeyCache } = await import('../api/auth')
    for (const keyHash of result.keyHashes) invalidateApiKeyCache(keyHash)
  }
  return { sessions: result.sessions, apiKeys: result.keyHashes.length }
}

export const UNSUSPEND_FORBIDDEN = 'forbidden' as const

/**
 * Gives a suspended user back the role they had (`restoredRole`) and clears the stored one. `actorRole` must be allowed
 * to act on that role (`canActOnUser`: only a developer brings back a developer or a superadmin), else
 * UNSUSPEND_FORBIDDEN and nothing is written. The write only applies if the role is still the one that was checked.
 * Their deactivated API keys stay deactivated. Null if not suspended.
 */
export async function unsuspendUser(
  userId: string,
  actorId: string,
  actorRole: string | null | undefined
): Promise<{ id: string; role: string } | null | typeof UNSUSPEND_FORBIDDEN> {
  const [current] = await queryWithRLS<{ role: string; roleBeforeSuspension: string | null }>(
    `SELECT role, "roleBeforeSuspension" FROM "users" WHERE id = $1`,
    [userId],
    actorId,
    { service: true }
  )
  if (current?.role !== SUSPENDED_ROLE) return null
  const role = restoredRole(current.roleBeforeSuspension)
  if (!canActOnUser(actorRole, role)) return UNSUSPEND_FORBIDDEN
  return restoreSuspendedUser(userId, actorId, role)
}

/**
 * The write of unsuspendUser: `role` is the one that was checked, and it only applies while the stored role is still
 * that one (a change between the read and the write writes nothing). Null if nothing was written.
 */
export async function restoreSuspendedUser(userId: string, actorId: string, role: string): Promise<{ id: string; role: string } | null> {
  const [row] = await queryWithRLS<{ id: string; role: string }>(
    `UPDATE "users" SET role = $2, "roleBeforeSuspension" = NULL, "updatedAt" = NOW()
     WHERE id = $1 AND role = '${SUSPENDED_ROLE}' AND COALESCE("roleBeforeSuspension", 'member') = $2
     RETURNING id, role`,
    [userId, role],
    actorId,
    { service: true }
  )
  return row ?? null
}
