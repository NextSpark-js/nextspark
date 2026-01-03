/**
 * DevTools Scheduled Actions Page
 *
 * Displays all scheduled background actions with:
 * - Status filtering (pending, running, completed, failed)
 * - Action type filtering
 * - Action details (type, status, scheduled time, team, payload)
 * - Error messages for failed actions
 * - Pagination
 *
 * Session: 2025-12-30-scheduled-actions-v1
 * Phase: Frontend (Phase 11)
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { sel } from '@nextsparkjs/core/lib/test'
import { Filters } from '@nextsparkjs/core/components/devtools/scheduled-actions/filters'
import { ActionsTable } from '@nextsparkjs/core/components/devtools/scheduled-actions/actions-table'
import type { ScheduledActionsFilters, ScheduledActionsResponse } from '@nextsparkjs/core/components/devtools/scheduled-actions/types'

async function fetchScheduledActions(
  filters: ScheduledActionsFilters,
  page: number,
  limit: number
): Promise<ScheduledActionsResponse> {
  const params = new URLSearchParams()

  if (filters.status) {
    params.append('status', filters.status)
  }

  if (filters.actionType) {
    params.append('action_type', filters.actionType)
  }

  params.append('page', page.toString())
  params.append('limit', limit.toString())

  const response = await fetch(`/api/v1/devtools/scheduled-actions?${params.toString()}`)

  if (!response.ok) {
    throw new Error('Failed to fetch scheduled actions')
  }

  return response.json()
}

export default function ScheduledActionsPage() {
  const t = useTranslations('dev.scheduledActions')
  const [filters, setFilters] = useState<ScheduledActionsFilters>({})
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ['scheduled-actions', filters, page, limit],
    queryFn: () => fetchScheduledActions(filters, page, limit),
  })

  const handleFiltersChange = (newFilters: ScheduledActionsFilters) => {
    setFilters(newFilters)
    setPage(1) // Reset to first page when filters change
  }

  const handlePreviousPage = () => {
    setPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    if (data?.data.pagination.totalPages) {
      setPage((prev) => Math.min(data.data.pagination.totalPages, prev + 1))
    }
  }

  return (
    <div
      className="container mx-auto p-6 max-w-7xl"
      data-cy={sel('devtools.scheduledActions.page')}
    >
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {/* Filters */}
      <Filters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        registeredActionTypes={data?.data.meta.registeredActionTypes || []}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('loading')}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12 text-destructive">
          <p>Error: {error.message}</p>
        </div>
      )}

      {/* Actions Table */}
      {data && !isLoading && (
        <>
          <ActionsTable actions={data.data.actions} />

          {/* Pagination */}
          {data.data.pagination.totalPages > 1 && (
            <div
              className="flex items-center justify-between mt-6"
              data-cy={sel('devtools.scheduledActions.pagination')}
            >
              <p className="text-sm text-muted-foreground">
                {t('pagination.page', {
                  page: data.data.pagination.page,
                  total: data.data.pagination.totalPages,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                  data-cy={sel('devtools.scheduledActions.paginationPrev')}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  {t('pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={page === data.data.pagination.totalPages}
                  data-cy={sel('devtools.scheduledActions.paginationNext')}
                >
                  {t('pagination.next')}
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
