'use client'

import { useState } from 'react'
import { usePatternUsages } from '@nextsparkjs/core/hooks/usePatternUsages'
import { PatternUsageStats } from './PatternUsageStats'
import { PatternUsageTable } from './PatternUsageTable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@nextsparkjs/core/components/ui/alert'
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react'

interface PatternUsageReportProps {
  /** Pattern ID to show usages for */
  patternId: string
  /** Initial page size (default: 20) */
  pageSize?: number
}

/**
 * PatternUsageReport
 *
 * Main component for displaying pattern usage reports.
 * Shows stats cards and a filterable table of usages.
 */
export function PatternUsageReport({
  patternId,
  pageSize = 20,
}: PatternUsageReportProps) {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  const {
    usages,
    counts,
    total,
    totalPages,
    isLoading,
    isError,
    error,
    refetch,
  } = usePatternUsages(patternId, {
    entityType: entityTypeFilter === 'all' ? undefined : entityTypeFilter,
    limit: pageSize,
    page,
  })

  // Handle filter change - reset to page 1
  const handleFilterChange = (value: string) => {
    setEntityTypeFilter(value)
    setPage(1)
  }

  // Pagination handlers
  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1))
  const handleNextPage = () => setPage((p) => Math.min(totalPages, p + 1))

  if (isError) {
    return (
      <Alert variant="destructive" data-cy="pattern-usage-report-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Usages</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof Error ? error.message : 'Failed to load pattern usages'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6" data-cy="pattern-usage-report">
      {/* Stats Section */}
      <PatternUsageStats
        counts={counts}
        total={total}
        isLoading={isLoading}
      />

      {/* Filter Section */}
      <div className="flex items-center justify-between" data-cy="pattern-usage-filters">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Filter by type:</span>
          <Select value={entityTypeFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[180px]" data-cy="pattern-usage-filter-select">
              <SelectValue placeholder="All entity types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entity types</SelectItem>
              {counts.map((item) => (
                <SelectItem key={item.entityType} value={item.entityType}>
                  {item.entityType.charAt(0).toUpperCase() + item.entityType.slice(1)} ({item.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2" data-cy="pattern-usage-pagination">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={page === 1 || isLoading}
              data-cy="pattern-usage-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page >= totalPages || isLoading}
              data-cy="pattern-usage-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Table Section */}
      <PatternUsageTable
        usages={usages}
        isLoading={isLoading}
        emptyMessage={
          entityTypeFilter !== 'all'
            ? `This pattern is not used in any ${entityTypeFilter}`
            : 'This pattern is not used in any entities yet'
        }
      />

      {/* Results Info */}
      {!isLoading && usages.length > 0 && (
        <p className="text-sm text-muted-foreground" data-cy="pattern-usage-results-info">
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} usages
        </p>
      )}
    </div>
  )
}
