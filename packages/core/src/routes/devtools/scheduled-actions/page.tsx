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

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon, Clock, RefreshCw } from 'lucide-react'
import { sel } from '@nextsparkjs/core/lib/selectors'
import { Filters } from '@nextsparkjs/core/components/devtools/scheduled-actions/filters'
import { ActionsTable } from '@nextsparkjs/core/components/devtools/scheduled-actions/actions-table'
import type { ScheduledActionsFilters, ScheduledActionsResponse } from '@nextsparkjs/core/components/devtools/scheduled-actions/types'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'
import { useAreaUrlState } from '@nextsparkjs/core/hooks/useAreaUrlState'
import { formatLocaleRelative } from '@nextsparkjs/core/lib/i18n/format'

/** What the screen keeps in the URL (#519): the filters and the page. */
const URL_STATE = {
  status: { default: '', allowed: ['pending', 'running', 'completed', 'failed'] },
  type: { default: '' },
  page: { default: '1', allowed: (v: string) => /^[1-9]\d{0,5}$/.test(v) },
} as const

async function fetchScheduledActions(
  filters: ScheduledActionsFilters,
  page: number,
  limit: number,
  fetchError: string
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

  const response = await fetch(withBasePath(`/api/v1/devtools/scheduled-actions?${params.toString()}`))

  if (!response.ok) {
    throw new Error(fetchError)
  }

  return response.json()
}

export default function ScheduledActionsPage() {
  const t = useTranslations('devtools.scheduledActions')
  const locale = useLocale()
  const [url, setUrl] = useAreaUrlState(URL_STATE)
  const filters = useMemo<ScheduledActionsFilters>(
    () => ({ status: (url.status || undefined) as ScheduledActionsFilters['status'], actionType: url.type || undefined }),
    [url.status, url.type],
  )
  const page = Number(url.page)
  const setPage = (update: (prev: number) => number) => setUrl({ page: String(update(page)) })
  const limit = 20

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['scheduled-actions', filters, page, limit],
    queryFn: () => fetchScheduledActions(filters, page, limit, t('fetchFailed')),
  })

  // "Updated 12 seconds ago", ticking, so the list says how stale it is instead of passing for live.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // The action a "Retried" / "retry of" link points at: shown straight away when it is on this page, else the
  // filters are cleared and the first page (the newest, where a retry is) is loaded to find it.
  const [focusId, setFocusId] = useState<string | null>(null)
  const handleViewRelated = (id: string) => {
    setFocusId(id)
    if (!data?.data.actions.some((action) => action.id === id)) {
      setUrl({ status: '', type: '', page: '1' })
    }
  }
  // The focus is a moment, not a state: cleared so a refresh later does not scroll back to it.
  useEffect(() => {
    if (!focusId) return
    const timer = setTimeout(() => setFocusId(null), 5000)
    return () => clearTimeout(timer)
  }, [focusId])

  const handleFiltersChange = (newFilters: ScheduledActionsFilters) => {
    // Back to the first page when the filters change
    setUrl({ status: newFilters.status ?? '', type: newFilters.actionType ?? '', page: '1' })
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
      className="space-y-6"
      data-cy={sel('devtools.scheduledActions.page')}
    >
      {/* Header: the same icon, title and description as the other devtools pages */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg shrink-0">
          <Clock className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {dataUpdatedAt > 0 && (
            <span className="text-sm text-muted-foreground" data-cy="scheduled-actions-updated">
              {t('updated', { when: formatLocaleRelative(dataUpdatedAt, locale, now) })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-cy="scheduled-actions-refresh">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Filters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        registeredActionTypes={data?.data.meta.registeredActionTypes || []}
        statusCounts={data?.data.meta.statusCounts}
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
          <p>{t('errorMessage', { message: error.message })}</p>
        </div>
      )}

      {/* Actions Table */}
      {data && !isLoading && (
        <>
          <ActionsTable actions={data.data.actions} focusId={focusId} onViewRelated={handleViewRelated} />

          {/* Pagination */}
          {data.data.pagination.totalPages > 1 && (
            <div
              className="flex items-center justify-between"
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
