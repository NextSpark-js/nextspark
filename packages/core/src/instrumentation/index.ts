/**
 * NextSpark server startup, the public `@nextsparkjs/core/instrumentation` entry
 *
 * A project's `instrumentation.ts` re-exports `register` from here, or calls it
 * from its own `register()` before or after its own startup code. Next.js runs
 * it once when the server starts (not on every request), in development and
 * production. Initialization is idempotent - safe to call multiple times.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * A directory, not src/instrumentation.ts: see src/proxy/index.ts.
 *
 * @module core/instrumentation
 */

export async function register(): Promise<void> {
  // Only run on server (not during build or in edge runtime). Kept as an if block, not
  // an early return, so the bundler drops the imports below from the edge build.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Re-validate login providers at startup: logs one safe error in production when none can work
    try {
      const { logAuthReadinessAtStartup } = await import('../lib/auth/runtime-readiness')
      logAuthReadinessAtStartup()
    } catch {
      // Fixed text only: what failed to load can carry configuration values
      console.error('[auth-readiness] startup readiness check could not run; per-request gates still apply')
    }

    console.log('[Instrumentation] Initializing scheduled actions system...')

    try {
      const {
        initializeScheduledActions,
        initializeRecurringActions,
      } = await import('../lib/scheduled-actions')

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
