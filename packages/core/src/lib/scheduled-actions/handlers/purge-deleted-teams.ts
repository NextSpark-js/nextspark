/**
 * Scheduled Action Handler: teams:purge-deleted
 *
 * Physically removes the teams deleted (TeamService.delete) more than the retention ago
 * (`teams.options.deletedRetentionDays`, 30 days by default). TeamService.delete schedules
 * the first run for the end of the retention; while teams are still waiting, each run
 * schedules the next one for the earliest expiry, so a longer retention never strands a team.
 *
 * @module core/lib/scheduled-actions/handlers/purge-deleted-teams
 */

import { registerScheduledAction } from '../registry'
import { scheduleAction } from '../scheduler'
import { queryOneWithRLS } from '../../db'
import { TeamService, PURGE_DELETED_TEAMS_ACTION } from '../../services/team.service'

export function registerPurgeDeletedTeamsAction(): void {
  registerScheduledAction(
    PURGE_DELETED_TEAMS_ACTION,
    async (): Promise<void> => {
      const purged = await TeamService.purgeDeleted()
      console.info(`[ScheduledAction:${PURGE_DELETED_TEAMS_ACTION}] Purged ${purged} deleted team(s)`)

      const nextPurgeAt = await TeamService.getNextPurgeAt()
      if (!nextPurgeAt) return

      // This run is 'running', so a pending one is another run already waiting for the next expiry.
      const waiting = await queryOneWithRLS<{ id: string }>(
        `SELECT id FROM "scheduled_actions" WHERE "actionType" = $1 AND status = 'pending' LIMIT 1`,
        [PURGE_DELETED_TEAMS_ACTION]
      )
      if (!waiting) {
        await scheduleAction(PURGE_DELETED_TEAMS_ACTION, {}, { scheduledAt: nextPurgeAt })
      }
    },
    { description: 'Remove teams deleted longer ago than the retention', timeout: 60000 }
  )
}
