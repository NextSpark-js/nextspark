/**
 * Scheduled Actions DevTools - TypeScript Types
 */

import type { ScheduledAction, ScheduledActionStatus } from '../../../lib/scheduled-actions/types'

/** A listed action: the team's name comes with the row (read in the same query), so the table needs no lookup per row. */
export type ScheduledActionRow = ScheduledAction & { teamName?: string | null }

export interface ScheduledActionsFilters {
  status?: ScheduledActionStatus
  actionType?: string
}

export interface ScheduledActionsResponse {
  success: boolean
  data: {
    actions: ScheduledActionRow[]
    pagination: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
    meta: {
      registeredActionTypes: string[]
      failedCount: number
    }
  }
}
