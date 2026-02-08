/**
 * Scheduled Actions DevTools - TypeScript Types
 */

import type { ScheduledAction, ScheduledActionStatus } from '../../../lib/scheduled-actions/types'

export interface ScheduledActionsFilters {
  status?: ScheduledActionStatus
  actionType?: string
}

export interface ScheduledActionsResponse {
  success: boolean
  data: {
    actions: ScheduledAction[]
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
