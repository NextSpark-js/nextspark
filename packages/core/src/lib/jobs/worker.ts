/**
 * Jobs - the pg-boss worker
 *
 * Declares the configured queues and cron schedules on pg-boss and runs each job with the Scheduled Actions
 * handler registered for it. pg-boss is an optional peer dependency, loaded here and nowhere else.
 *
 * The connection given to pg-boss is only for pg-boss's own schema. Handlers never receive it: they use
 * lib/db with the app role like any Scheduled Actions handler, so a handler that touches team data stays under RLS.
 *
 * @module core/lib/jobs/worker
 */

import type { ScheduledAction, ScheduledActionDefinition } from '../scheduled-actions/types'
import { resolveJobsConfig, type ResolvedJobsConfig } from './config'
import type { JobsConfig } from './types'

/** The part of a pg-boss instance the worker uses. */
interface Boss {
  on(event: 'error', listener: (error: Error) => void): unknown
  start(): Promise<unknown>
  stop(options?: { graceful?: boolean; timeout?: number }): Promise<void>
  getQueue(name: string): Promise<unknown | null>
  createQueue(name: string, options?: Record<string, unknown>): Promise<void>
  updateQueue(name: string, options?: Record<string, unknown>): Promise<void>
  work(name: string, options: Record<string, unknown>, handler: (jobs: BossJob[]) => Promise<void>): Promise<string>
  schedule(name: string, cron: string, data?: object | null, options?: Record<string, unknown>): Promise<void>
  unschedule(name: string, key?: string): Promise<void>
  getSchedules(): Promise<Array<{ name: string; key: string }>>
}

interface BossJob {
  id: string
  data: unknown
  retryCount: number
}

export interface JobsWorkerOptions {
  /** Connection pg-boss uses for its schema: the role must be able to create it (see the jobs docs). */
  connectionString: string
  ssl?: false | { rejectUnauthorized: boolean }
  config: JobsConfig
  /** The Scheduled Actions registry lookup (`getActionHandler`). */
  getHandler: (name: string) => ScheduledActionDefinition | undefined
  log?: (message: string) => void
}

export interface JobsWorker {
  /**
   * Stops taking jobs and waits up to `jobs.shutdownTimeout` seconds for the running ones. A job still running after
   * that is marked failed by pg-boss at once: it is retried only if the queue has retries left, so with `retryLimit: 0`
   * it is lost. Give the supervisor a grace period longer than `shutdownTimeout`.
   */
  stop(): Promise<void>
}

async function loadPgBoss(): Promise<new (options: Record<string, unknown>) => Boss> {
  try {
    const mod = await import('pg-boss')
    return mod.PgBoss as unknown as new (options: Record<string, unknown>) => Boss
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ERR_MODULE_NOT_FOUND' || (error as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND') {
      throw new Error('[Jobs] pg-boss is not installed. The worker needs it: add it to your project with `pnpm add pg-boss`.')
    }
    throw error
  }
}

function asAction(job: BossJob, queue: ResolvedJobsConfig['queues'][number]): ScheduledAction {
  const now = new Date()
  const payload = job.data
  const teamId = (payload as { teamId?: unknown } | null)?.teamId
  return {
    id: job.id,
    actionType: queue.handler,
    status: 'running',
    payload,
    teamId: typeof teamId === 'string' ? teamId : null,
    scheduledAt: now,
    startedAt: now,
    completedAt: null,
    errorMessage: null,
    attempts: job.retryCount + 1,
    maxRetries: queue.retryLimit + 1,
    recurringInterval: null,
    recurrenceType: null,
    lockGroup: null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function startJobsWorker(options: JobsWorkerOptions): Promise<JobsWorker> {
  const config = resolveJobsConfig(options.config)
  const log = options.log ?? ((message: string) => console.log(`[Jobs] ${message}`))

  const missing = config.queues.filter(q => !options.getHandler(q.handler))
  if (missing.length > 0) {
    throw new Error(
      `[Jobs] No Scheduled Actions handler is registered for: ${missing.map(q => `${q.name} -> ${q.handler}`).join(', ')}. ` +
      'Register it with registerScheduledAction in the project (or fix `handler` in jobs.queues).'
    )
  }

  const PgBoss = await loadPgBoss()
  const boss = new PgBoss({
    connectionString: options.connectionString,
    ssl: options.ssl,
    schema: config.schema,
    application_name: 'nextspark-worker',
  })
  boss.on('error', error => console.error('[Jobs] pg-boss error:', error))
  await boss.start()

  try {
    for (const queue of config.queues) {
      const queueOptions = {
        retryLimit: queue.retryLimit,
        retryDelay: queue.retryDelay,
        retryBackoff: queue.retryBackoff,
        expireInSeconds: queue.timeout,
      }
      // createQueue keeps an existing queue as it is: a changed config reaches it through updateQueue, which also
      // clears a retryDelayMax the config no longer sets. createQueue rejects the key itself without backoff.
      if (await boss.getQueue(queue.name)) {
        await boss.updateQueue(queue.name, { ...queueOptions, retryDelayMax: queue.retryBackoff ? (queue.retryDelayMax ?? null) : null })
      } else {
        await boss.createQueue(queue.name, { ...queueOptions, ...(queue.retryBackoff && queue.retryDelayMax !== undefined ? { retryDelayMax: queue.retryDelayMax } : {}) })
      }

      await boss.work(queue.name, { localConcurrency: queue.concurrency }, async jobs => {
        for (const job of jobs) {
          // looked up per job: a handler the project registers later replaces the one found at start
          const definition = options.getHandler(queue.handler)
          if (!definition) throw new Error(`No handler registered for action type: ${queue.handler}`)
          log(`${queue.name}: running job ${job.id} (attempt ${job.retryCount + 1} of ${queue.retryLimit + 1})`)
          await definition.handler(job.data, asAction(job, queue))
        }
      })
    }

    // The schedules the config no longer declares stop firing
    const declared = new Set(config.schedules.map(s => `${s.queue}\0${s.key}`))
    for (const existing of await boss.getSchedules()) {
      if (!declared.has(`${existing.name}\0${existing.key}`)) await boss.unschedule(existing.name, existing.key)
    }
    for (const schedule of config.schedules) {
      await boss.schedule(schedule.queue, schedule.cron, schedule.data, { tz: schedule.tz, key: schedule.key })
    }

  } catch (error) {
    // a half-started pg-boss would keep polling and hold the process open
    await boss.stop({ graceful: false }).catch(() => {})
    throw error
  }

  log(`started: ${config.queues.length} queue(s), ${config.schedules.length} schedule(s), schema "${config.schema}"`)

  let stopping: Promise<void> | null = null
  return {
    stop() {
      stopping ??= boss.stop({ graceful: true, timeout: config.shutdownTimeout * 1000 }).then(() => log('stopped'))
      return stopping
    },
  }
}
