/**
 * The page of scheduled actions the devtools list shows, with what the list needs beside each row: the team's name and
 * the retry links. Kept out of the route so a test can run it against a real PostgreSQL.
 *
 * `retryOf` is a column (migration 048), and "retriedBy" is the action whose `retryOf` is this one's id: a join over a
 * unique index, so the page costs its own rows and not a lookup per row of the table.
 */
import { queryWithRLS } from '../db'
import type { ScheduledActionRow } from '../../components/devtools/scheduled-actions/types'
import type { ScheduledActionStatus } from './types'

export interface ListScheduledActionsInput {
  status?: ScheduledActionStatus | null
  actionType?: string | null
  limit: number
  offset: number
}

export async function listScheduledActions({ status, actionType, limit, offset }: ListScheduledActionsInput): Promise<{
  actions: ScheduledActionRow[]
  total: number
}> {
  const conditions: string[] = []
  const params: unknown[] = []
  if (status) {
    params.push(status)
    conditions.push(`sa.status = $${params.length}`)
  }
  if (actionType) {
    params.push(actionType)
    conditions.push(`sa."actionType" = $${params.length}`)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const count = await queryWithRLS<{ count: string }>(`SELECT COUNT(*) AS count FROM "scheduled_actions" sa ${where}`, params, null)

  const actions = await queryWithRLS<ScheduledActionRow>(
    `SELECT
       sa.id,
       sa."actionType",
       sa.status,
       sa.payload,
       sa."teamId",
       t.name AS "teamName",
       sa."scheduledAt",
       sa."startedAt",
       sa."completedAt",
       sa."errorMessage",
       sa.attempts,
       sa."maxRetries",
       sa."recurringInterval",
       sa."createdAt",
       sa."updatedAt",
       sa."retryOf",
       r.id AS "retriedBy"
     FROM "scheduled_actions" sa
     LEFT JOIN "teams" t ON t.id = sa."teamId"
     LEFT JOIN "scheduled_actions" r ON r."retryOf" = sa.id
     ${where}
     ORDER BY sa."createdAt" DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
    null
  )

  return { actions, total: parseInt(count[0]?.count || '0', 10) }
}
