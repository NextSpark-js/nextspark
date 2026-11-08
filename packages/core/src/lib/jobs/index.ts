/**
 * Jobs - public API of the optional pg-boss worker (`nextspark worker`)
 *
 * Only the cron schedules declared in `jobs.schedules`, or code that opens its own `PgBoss` with the migration role
 * (`MIGRATE_DATABASE_URL`), put jobs in a queue: the app role has no permission on the `pgboss` schema.
 *
 * @module core/lib/jobs
 */

export type { JobsConfig, JobQueueConfig, JobScheduleConfig } from './types'
export { resolveJobsConfig } from './config'
export type { ResolvedJobsConfig } from './config'
export { startJobsWorker } from './worker'
export type { JobsWorker, JobsWorkerOptions } from './worker'
