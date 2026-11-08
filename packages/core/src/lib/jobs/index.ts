/**
 * Jobs - public API of the optional pg-boss worker (`nextspark worker`)
 *
 * @module core/lib/jobs
 */

export type { JobsConfig, JobQueueConfig, JobScheduleConfig } from './types'
export { resolveJobsConfig } from './config'
export type { ResolvedJobsConfig } from './config'
export { startJobsWorker } from './worker'
export type { JobsWorker, JobsWorkerOptions } from './worker'
