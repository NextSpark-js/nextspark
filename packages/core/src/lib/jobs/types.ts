/**
 * Jobs - configuration types
 *
 * The optional pg-boss worker (`nextspark worker`) reads this from the project's app config (`jobs`).
 * It is off unless `enabled` is true.
 */

/** One pg-boss queue. Its jobs run the Scheduled Actions handler named by `handler`. */
export interface JobQueueConfig {
  /**
   * Scheduled Actions handler (the name passed to `registerScheduledAction`) that runs each job.
   * pg-boss queue names allow only letters, digits, `_`, `-`, `.` and `/`, while action types usually hold a `:`,
   * so the queue name is free and this names the handler. Without it, the queue name is the action type.
   */
  handler?: string
  /** Jobs of this queue the worker runs at the same time. Default 1. */
  concurrency?: number
  /** Times a failed job is tried again before it is marked failed (attempts = retryLimit + 1). Default 2. */
  retryLimit?: number
  /** Seconds before a failed job is tried again. Default 0. */
  retryDelay?: number
  /** Double `retryDelay` on each retry (with jitter) instead of waiting the same time. Default false. */
  retryBackoff?: boolean
  /** Longest wait between retries, in seconds, when `retryBackoff` is on. Default: no limit. */
  retryDelayMax?: number
  /** Seconds a job may run before pg-boss fails it (and retries it if retries are left). It does not cancel the handler. The handler's own `timeout` option of registerScheduledAction is ignored here. Default 900. */
  timeout?: number
}

/** A cron schedule that enqueues a job on a queue. */
export interface JobScheduleConfig {
  /** A queue declared in `queues`. */
  queue: string
  /** Cron expression with five fields, for example every five minutes. */
  cron: string
  /** IANA time zone the cron is read in. Default UTC. */
  tz?: string
  /** Payload of each job the schedule enqueues. */
  data?: Record<string, unknown>
  /** Tells apart several schedules on one queue. Default: the queue name alone. */
  key?: string
}

export interface JobsConfig {
  /** Off by default: `nextspark worker` refuses to start unless this is true. */
  enabled?: boolean
  /** Postgres schema pg-boss creates for its tables. Default `pgboss`. */
  schema?: string
  /**
   * Seconds `nextspark worker` waits for running jobs on SIGTERM. A job still running then is marked failed by pg-boss
   * and retried only if its queue has `retryLimit` left (with `retryLimit: 0` it is lost). Set the supervisor's grace
   * period (Docker `stop_grace_period`, systemd `TimeoutStopSec`) above this. Default 30.
   */
  shutdownTimeout?: number
  queues: Record<string, JobQueueConfig>
  schedules?: JobScheduleConfig[]
}
