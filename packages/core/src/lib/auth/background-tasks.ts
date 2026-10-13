/**
 * Better Auth's `advanced.backgroundTasks.handler`. Without one, Better Auth 1.7 awaits the verification email of a
 * sign-up inside the sign-up's database transaction, so a slow mail provider holds a connection of the auth pool
 * (which also reads every request's session) for as long as the send takes. With it, the send is handed off and
 * runs after the transaction: within a request through Next's after(), so the platform keeps it alive after the
 * response; elsewhere (a script, a test) as a detached promise.
 */
import { after } from 'next/server'

export function runAfterResponse(task: Promise<unknown>): void {
  // Better Auth logs the failures of the sends it hands off; anything else must not become an unhandled rejection
  const settled = task.catch(() => {})
  try {
    after(settled)
  } catch {
    // after() outside a request scope throws; the promise runs on its own
  }
}
