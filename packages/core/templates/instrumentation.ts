/**
 * Next.js Instrumentation
 *
 * This file runs once when the server starts (not on every request).
 * Used to initialize global systems like scheduled action handlers.
 *
 * Runs in both development and production environments.
 * Initialization is idempotent - safe to call multiple times.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing scheduled actions system...')

    try {
      const {
        initializeScheduledActions,
        initializeRecurringActions,
      } = await import('@nextsparkjs/core/lib/scheduled-actions')

      // Register scheduled action handlers (includes entity hooks for automatic scheduling)
      // This registers hooks like 'entity.contents.updated' that create scheduled actions
      initializeScheduledActions()

      // Register recurring scheduled actions (token refresh, cleanup jobs, etc.)
      // These are background tasks that run on a schedule (e.g., every 30 minutes)
      // Non-blocking: if DB is unavailable at cold start, the server still boots
      await initializeRecurringActions()

      console.log('[Instrumentation] ✅ Scheduled actions initialized')
    } catch (error) {
      console.warn(`[Instrumentation] ⚠️ Failed to initialize scheduled actions: ${error instanceof Error ? error.message : error}`)
      console.warn('[Instrumentation] Server will continue without recurring actions')
    }
  }
}
