import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'fixture-session'
const FIXTURE_USER = 'fixture-user'

export type Session = { userId: string }

/** A fake cookie session: the only valid session is the fixture user. */
export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value
  return value === FIXTURE_USER ? { userId: value } : null
}
