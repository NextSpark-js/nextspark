/**
 * Auth helpers for API route protection.
 */

import { auth } from './auth'
import { headers } from 'next/headers'

type Session = {
  user: { id: string; email: string; name: string; role: string }
  session: { id: string; token: string; expiresAt: Date }
}

/**
 * Get the current session from the request, or null if unauthenticated.
 */
export async function getSession(): Promise<Session | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session as Session | null
}

/**
 * Require authentication. Throws a 401 Response if unauthenticated.
 * Usage in API routes:
 *   try { await requireSession() } catch (r) { return r as Response }
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return session
}
