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
    // A demo never starts next to credentials of a real service. Names only, never a value
    if (process.env.NEXTSPARK_DEMO_MODE && process.env.NEXT_PHASE !== 'phase-production-build') {
      const { demoModeRefusal } = await import('../lib/demo/mode')
      const refusal = demoModeRefusal(process.env)
      if (refusal) {
        console.error(`[demo-mode] ${refusal} The server will not start.`)
        process.exit(1)
      }
    }

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

    // Production only, not awaited: one warning when DATABASE_URL's role skips RLS, never a delay or an error at start
    void import('../lib/rls-runtime').then(({ logRlsBypassAtStartup }) => logRlsBypassAtStartup()).catch(() => {})

    console.log('[Instrumentation] Initializing scheduled actions system...')

    // A project whose work depends on the recurring actions sets scheduledActions.requireRecurringSeed: the server
    // waits for the seed and does not start without it (#435). Never during next build, which runs register() too.
    let requireSeed = false
    let seeding = false
    try {
      const { APP_CONFIG_MERGED } = await import('../lib/config/config-sync')
      requireSeed = Boolean(APP_CONFIG_MERGED.scheduledActions?.requireRecurringSeed) && process.env.NEXT_PHASE !== 'phase-production-build'
      const {
        initializeScheduledActions,
        initializeRecurringActions,
      } = await import('../lib/scheduled-actions')

      // Register scheduled action handlers (includes entity hooks for automatic scheduling)
      // This registers hooks like 'entity.contents.updated' that create scheduled actions
      initializeScheduledActions()

      if (requireSeed) {
        seeding = true
        await initializeRecurringActions()
        console.log('[Instrumentation] ✅ Scheduled action handlers initialized; recurring actions seeded')
      } else {
        // Seed the recurring scheduled actions (token refresh, cleanup jobs, etc.) without holding register():
        // Next.js serves nothing until it resolves, and after the first boot the seed only finds its rows already
        // there. Safe to run late or twice: scheduleRecurringAction is idempotent under an advisory lock, and the
        // cron only needs the handlers above. A failure is logged here and the next boot seeds again.
        void initializeRecurringActions().catch((error) => {
          console.warn(`[Instrumentation] ⚠️ Failed to seed recurring actions: ${error instanceof Error ? error.message : error}`)
        })
        console.log('[Instrumentation] ✅ Scheduled action handlers initialized; recurring actions seeding in the background')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : error
      if (requireSeed) {
        // the seed itself, or the handlers and the module before it: each says which
        const what = seeding ? 'Failed to seed recurring actions' : 'Failed to initialize scheduled actions'
        console.error(`[Instrumentation] ${what}: ${message}. scheduledActions.requireRecurringSeed is set: the server will not start.`)
        process.exit(1)
      }
      console.warn(`[Instrumentation] ⚠️ Failed to initialize scheduled actions: ${message}`)
      console.warn('[Instrumentation] Server will continue without recurring actions')
    }
  }
}
