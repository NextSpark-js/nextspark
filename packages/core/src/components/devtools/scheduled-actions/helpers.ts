import type { ScheduledActionRow } from './types'

/**
 * How late a pending action has to be before it is called overdue. The processor picks pending actions up on its
 * own cron tick, so one that is a few seconds past its time is only waiting for it; a minute past is stuck or the
 * processor is not running.
 */
export const OVERDUE_GRACE_MS = 60_000

/** A pending action whose time has passed by more than the grace. Running, done and failed actions are never overdue. */
export function isOverdue(action: Pick<ScheduledActionRow, 'status' | 'scheduledAt'>, now: number = Date.now()): boolean {
  return action.status === 'pending' && now - new Date(action.scheduledAt).getTime() > OVERDUE_GRACE_MS
}
