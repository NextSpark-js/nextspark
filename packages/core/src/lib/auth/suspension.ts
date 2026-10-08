import { queryWithRLS } from '../db'
import { invalidateApiKeyCache } from '../api/auth'

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
 * (`status = 'inactive'`, so the audit log keeps the rows; unsuspending does not bring them back). A superadmin is never
 * suspended. Returns null when no user was suspended (unknown id, or a superadmin).
 */
export async function suspendUser(userId: string, actorId: string): Promise<{ sessions: number; apiKeys: number } | null> {
  const [result] = await queryWithRLS<{ suspended: number; sessions: number; keyHashes: string[] }>(
    `WITH suspended AS (
       UPDATE "users" SET role = '${SUSPENDED_ROLE}', "updatedAt" = NOW()
       WHERE id = $1 AND role <> 'superadmin'
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
    actorId
  )
  if (!result?.suspended) return null
  // validateApiKey caches a key for 5 minutes in this process: drop the deactivated ones now.
  for (const keyHash of result.keyHashes) invalidateApiKeyCache(keyHash)
  return { sessions: result.sessions, apiKeys: result.keyHashes.length }
}

/** Gives a suspended user back the `member` role. Their deactivated API keys stay deactivated. Null if not suspended. */
export async function unsuspendUser(userId: string, actorId: string): Promise<{ id: string } | null> {
  const [row] = await queryWithRLS<{ id: string }>(
    `UPDATE "users" SET role = 'member', "updatedAt" = NOW() WHERE id = $1 AND role = '${SUSPENDED_ROLE}' RETURNING id`,
    [userId],
    actorId
  )
  return row ?? null
}
