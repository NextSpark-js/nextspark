'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { RefreshCcw } from 'lucide-react'
import { useTraces } from '../../hooks/observability/useTraces'
import { TracesTable } from './TracesTable'
import { FiltersPanel } from './FiltersPanel'
import type { Trace } from '../../types/observability.types'

interface ObservabilityDashboardProps {
  /** Base path for trace detail navigation (e.g., '/superadmin/ai-observability') */
  basePath?: string
}

export function ObservabilityDashboard({ basePath = '/superadmin/ai-observability' }: ObservabilityDashboardProps) {
  const t = useTranslations('observability')
  const router = useRouter()
  const [period, setPeriod] = useState('24h')
  const [statusFilter, setStatusFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [allTraces, setAllTraces] = useState<Trace[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Calculate date range based on period (refreshKey forces recalculation)
  const dateRange = useMemo(() => {
    const now = new Date()
    const periods: Record<string, number> = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30,
    }

    const hoursAgo = periods[period] || 24
    const from = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)

    return {
      from: from.toISOString(),
      to: now.toISOString(),
    }
  }, [period, refreshKey])

  // Reset pagination when filters change
  const resetPagination = useCallback(() => {
    setAllTraces([])
    setCursor(undefined)
  }, [])

  // Fetch traces with filters
  const tracesQuery = useTraces({
    status: statusFilter === 'all' ? undefined : statusFilter,
    agent: agentFilter === 'all' ? undefined : agentFilter,
    from: dateRange.from,
    to: dateRange.to,
    limit: 50,
    cursor,
  })

  // Update allTraces when data changes
  useEffect(() => {
    if (tracesQuery.data?.traces) {
      if (cursor) {
        // Append to existing traces (load more)
        setAllTraces((prev) => [...prev, ...tracesQuery.data.traces])
      } else if (isReloading) {
        // Reload: prepend new traces without duplicates
        setAllTraces((prev) => {
          const existingIds = new Set(prev.map((t) => t.traceId))
          const newTraces = tracesQuery.data.traces.filter(
            (t) => !existingIds.has(t.traceId)
          )
          return [...newTraces, ...prev]
        })
        setIsReloading(false)
      } else {
        // Replace traces (new filter/period)
        setAllTraces(tracesQuery.data.traces)
      }
      setIsLoadingMore(false)
    }
  }, [tracesQuery.data, cursor, isReloading])

  // Extract unique agent names for filter
  const availableAgents = useMemo(() => {
    if (allTraces.length === 0) return []
    const agents = new Set(allTraces.map((t) => t.agentName))
    return Array.from(agents).sort()
  }, [allTraces])

  // Filter traces by search
  const filteredTraces = useMemo(() => {
    if (allTraces.length === 0) return []
    if (!searchFilter) return allTraces

    const lowerSearch = searchFilter.toLowerCase()
    return allTraces.filter(
      (trace) =>
        trace.traceId.toLowerCase().includes(lowerSearch) ||
        trace.agentName.toLowerCase().includes(lowerSearch) ||
        trace.input.toLowerCase().includes(lowerSearch)
    )
  }, [allTraces, searchFilter])

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (tracesQuery.data?.nextCursor) {
      setIsLoadingMore(true)
      setCursor(tracesQuery.data.nextCursor)
    }
  }, [tracesQuery.data?.nextCursor])

  // Handle trace selection - navigate to detail page
  const handleSelectTrace = useCallback((traceId: string) => {
    router.push(`${basePath}/${traceId}`)
  }, [router, basePath])

  // Handle filter changes - reset pagination
  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value)
    resetPagination()
  }, [resetPagination])

  const handleAgentChange = useCallback((value: string) => {
    setAgentFilter(value)
    resetPagination()
  }, [resetPagination])

  const handlePeriodChange = useCallback((value: string) => {
    setPeriod(value)
    resetPagination()
  }, [resetPagination])

  // Handle reload - fetch new traces and prepend them
  const handleReload = useCallback(() => {
    setIsReloading(true)
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="space-y-6" data-cy="observability-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleReload}
            disabled={tracesQuery.isFetching}
            data-cy="reload-traces"
            title={t('reload')}
          >
            <RefreshCcw className={`h-4 w-4 ${tracesQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <div className="w-[150px]">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger data-cy="period-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">{t('period.1h')}</SelectItem>
                <SelectItem value="24h">{t('period.24h')}</SelectItem>
                <SelectItem value="7d">{t('period.7d')}</SelectItem>
                <SelectItem value="30d">{t('period.30d')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <FiltersPanel
        status={statusFilter}
        agent={agentFilter}
        search={searchFilter}
        onStatusChange={handleStatusChange}
        onAgentChange={handleAgentChange}
        onSearchChange={setSearchFilter}
        availableAgents={availableAgents}
      />

      {tracesQuery.isLoading && (
        <div className="text-center py-12" data-cy="loading">
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      )}

      {tracesQuery.isError && (
        <div className="text-center py-12" data-cy="error">
          <p className="text-destructive">{t('error')}</p>
        </div>
      )}

      {(tracesQuery.data || allTraces.length > 0) && (
        <>
          <TracesTable traces={filteredTraces} onSelect={handleSelectTrace} />

          {tracesQuery.data?.hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                data-cy="load-more"
              >
                {isLoadingMore ? t('loadingMore') : t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
