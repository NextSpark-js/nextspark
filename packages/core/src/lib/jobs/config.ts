/**
 * Jobs - config validation
 */

import type { JobsConfig } from './types'

export interface ResolvedQueue {
  name: string
  handler: string
  concurrency: number
  retryLimit: number
  retryDelay: number
  retryBackoff: boolean
  retryDelayMax?: number
  timeout: number
}

export interface ResolvedSchedule {
  queue: string
  key: string
  cron: string
  tz?: string
  data: Record<string, unknown>
}

export interface ResolvedJobsConfig {
  schema: string
  shutdownTimeout: number
  queues: ResolvedQueue[]
  schedules: ResolvedSchedule[]
}

const NAME = /^[\w.\-/]+$/

function fail(message: string): never {
  throw new Error(`[Jobs] Invalid jobs config: ${message}`)
}

function count(label: string, value: unknown, fallback: number, min: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) fail(`${label} must be an integer of at least ${min}`)
  return value
}

/** The jobs config with its defaults, or an error naming the first thing wrong. A config that is not enabled never resolves. */
export function resolveJobsConfig(raw: JobsConfig | undefined): ResolvedJobsConfig {
  if (!raw?.enabled) fail('`jobs.enabled` is not true, so the worker has nothing to do')
  if (!raw.queues || typeof raw.queues !== 'object') fail('`jobs.queues` is required')
  const schema = raw.schema ?? 'pgboss'
  if (!NAME.test(schema)) fail('`jobs.schema` can only hold letters, digits, `_`, `-`, `.` and `/`')

  const queues = Object.entries(raw.queues).map(([name, queue]): ResolvedQueue => {
    if (!NAME.test(name)) fail(`queue "${name}": a queue name can only hold letters, digits, "_", "-", "." and "/" (put the action type in \`handler\`)`)
    const q = queue ?? {}
    return {
      name,
      handler: q.handler ?? name,
      concurrency: count(`queue "${name}" concurrency`, q.concurrency, 1, 1),
      retryLimit: count(`queue "${name}" retryLimit`, q.retryLimit, 2, 0),
      retryDelay: count(`queue "${name}" retryDelay`, q.retryDelay, 0, 0),
      retryBackoff: q.retryBackoff ?? false,
      retryDelayMax: q.retryDelayMax === undefined ? undefined : count(`queue "${name}" retryDelayMax`, q.retryDelayMax, 1, 1),
      timeout: count(`queue "${name}" timeout`, q.timeout, 900, 1),
    }
  })
  if (queues.length === 0) fail('`jobs.queues` declares no queue')

  const names = new Set(queues.map(q => q.name))
  const seen = new Set<string>()
  const schedules = (raw.schedules ?? []).map((s, i): ResolvedSchedule => {
    if (!names.has(s.queue)) fail(`schedules[${i}] names the queue "${s.queue}", which is not declared in \`queues\``)
    if (typeof s.cron !== 'string' || s.cron.trim().split(/\s+/).length !== 5) fail(`schedules[${i}] cron must be a five-field cron expression`)
    const key = s.key ?? ''
    if (key && !NAME.test(key)) fail(`schedules[${i}] key can only hold letters, digits, "_", "-", "." and "/"`)
    if (seen.has(`${s.queue}\0${key}`)) fail(`schedules[${i}] repeats the queue "${s.queue}" without a distinct \`key\``)
    seen.add(`${s.queue}\0${key}`)
    return { queue: s.queue, key, cron: s.cron.trim(), tz: s.tz, data: s.data ?? {} }
  })

  return { schema, shutdownTimeout: count('shutdownTimeout', raw.shutdownTimeout, 30, 0), queues, schedules }
}
