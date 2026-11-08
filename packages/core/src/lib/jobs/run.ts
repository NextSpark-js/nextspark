/**
 * Jobs - the worker process
 *
 * What `nextspark worker` runs: reads the project's `jobs` config, registers the Scheduled Actions handlers,
 * starts the pg-boss worker and stops it cleanly on SIGTERM or SIGINT. Needs the project's registries to be
 * resolvable (the CLI starts it with tsx and the project tsconfig) and `server-only` to be an empty module
 * (scripts/jobs/preload.mjs).
 *
 * @module core/lib/jobs/run
 */

import type { ScheduledActionDefinition } from '../scheduled-actions/types'
import type { JobsConfig } from './types'
import { startJobsWorker } from './worker'

export interface RunWorkerOptions {
  /** Defaults to `jobs` of the project's app config. */
  config?: JobsConfig
  /** Defaults to the Scheduled Actions registry, filled with the core and project handlers. */
  getHandler?: (name: string) => ScheduledActionDefinition | undefined
  /** Defaults to MIGRATE_DATABASE_URL, then DATABASE_URL: the role that can create pg-boss's schema. */
  connectionString?: string
}

const SIGNALS = ['SIGTERM', 'SIGINT'] as const

export async function runWorkerProcess(options: RunWorkerOptions = {}): Promise<void> {
  const connectionString = options.connectionString ?? (process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL)
  if (!connectionString) {
    throw new Error('[Jobs] Set MIGRATE_DATABASE_URL (or DATABASE_URL): pg-boss needs a role that can create its schema.')
  }

  // lib/db installs a SIGTERM/SIGINT handler that closes the pools. Loaded here, before the worker's own handler
  // is set, so the worker can take that handler over and run it after the running jobs end
  const db = await import('../db')

  let config = options.config
  let getHandler = options.getHandler
  if (!config || !getHandler) {
    const { APP_CONFIG_MERGED } = await import('../config')
    const scheduled = await import('../scheduled-actions')
    config ??= (APP_CONFIG_MERGED as { jobs?: JobsConfig }).jobs
    if (!getHandler) {
      scheduled.initializeScheduledActions()
      getHandler = scheduled.getActionHandler
    }
  }
  if (!config?.enabled) {
    throw new Error('[Jobs] The worker is off. Set `jobs.enabled: true` (and declare `jobs.queues`) in the project app config.')
  }

  // Take lib/db's handlers over before the worker takes its first job: a signal in between would close the pools
  // under a running job
  const closers = new Map(SIGNALS.map(signal => [signal, process.listeners(signal)]))
  for (const signal of SIGNALS) {
    for (const listener of closers.get(signal)!) process.removeListener(signal, listener)
  }

  const starting = startJobsWorker({
    connectionString: db.stripSSLParams(connectionString),
    ssl: db.parseSSLConfig(connectionString),
    config,
    getHandler,
  })
  starting.catch(() => {}) // reported by the await below; a signal while starting must not leave it unhandled

  let stopping = false
  const stop = async (signal: (typeof SIGNALS)[number]): Promise<void> => {
    if (stopping) return
    stopping = true
    console.log(`[Jobs] ${signal} received, finishing the running jobs...`)
    let code = 0
    try {
      await (await starting).stop()
    } catch (error) {
      console.error('[Jobs] Error while stopping:', error)
      code = 1
    }
    // The pools close only now, once no job is using them
    for (const listener of closers.get(signal)!) await (listener as (signal: NodeJS.Signals) => unknown)(signal)
    process.exit(code)
  }
  for (const signal of SIGNALS) process.on(signal, () => void stop(signal))

  await starting
}
