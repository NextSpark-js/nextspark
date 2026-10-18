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
    // Sessions are signed with the secret the auth library resolves from BETTER_AUTH_SECRETS, BETTER_AUTH_SECRET or
    // AUTH_SECRET: a production server never starts without one, or with a template value or a short one. The next
    // build collects page data with NODE_ENV=production too, and the build's own readiness check judges it there.
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
      const { sessionSecretProblem } = await import('../lib/auth/readiness')
      const bad = sessionSecretProblem(process.env, { requirePresent: true })
      if (bad) {
        // Code and fixed message only, never the value
        console.error(`[auth-readiness] ${bad.code}: ${bad.message} The server will not start.`)
        process.exit(1)
      }
    }

    // Re-validate login providers at startup: logs one safe error in production when none can work
    try {
      const { logAuthReadinessAtStartup } = await import('../lib/auth/runtime-readiness')
      logAuthReadinessAtStartup()
    } catch {
      // Fixed text only: what failed to load can carry configuration values
      console.error('[auth-readiness] startup readiness check could not run; per-request gates still apply')
    }

    // A misconfigured STORAGE_DRIVER, and the local driver's volume caveat, show at startup, not on the first upload
    try {
      const { logStorageAtStartup } = await import('../lib/media/storage')
      logStorageAtStartup()
    } catch {
      console.error('[storage] startup storage check could not run; uploads still check it per request')
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
