/**
 * Scheduled Actions Filters Component
 */

'use client'

import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { sel } from '../../../lib/test'
import type { ScheduledActionsFilters } from './types'
import type { ScheduledActionStatus } from '../../../lib/scheduled-actions/types'

interface FiltersProps {
  filters: ScheduledActionsFilters
  onFiltersChange: (filters: ScheduledActionsFilters) => void
  registeredActionTypes: string[]
}

export function Filters({ filters, onFiltersChange, registeredActionTypes }: FiltersProps) {
  const t = useTranslations('dev.scheduledActions')

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value === 'all' ? undefined : (value as ScheduledActionStatus),
    })
  }

  const handleActionTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      actionType: value === 'all' ? undefined : value,
    })
  }

  const handleReset = () => {
    onFiltersChange({})
  }

  const hasActiveFilters = filters.status || filters.actionType

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {/* Status Filter */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">
          {t('filters.status')}
        </label>
        <Select
          value={filters.status || 'all'}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger
            className="w-[180px]"
            data-cy={sel('devtools.scheduledActions.filterStatus')}
          >
            <SelectValue placeholder={t('filters.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            <SelectItem value="pending">{t('status.pending')}</SelectItem>
            <SelectItem value="running">{t('status.running')}</SelectItem>
            <SelectItem value="completed">{t('status.completed')}</SelectItem>
            <SelectItem value="failed">{t('status.failed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Type Filter */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">
          {t('filters.actionType')}
        </label>
        <Select
          value={filters.actionType || 'all'}
          onValueChange={handleActionTypeChange}
        >
          <SelectTrigger
            className="w-[200px]"
            data-cy={sel('devtools.scheduledActions.filterType')}
          >
            <SelectValue placeholder={t('filters.allTypes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
            {registeredActionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={handleReset}
            data-cy={sel('devtools.scheduledActions.filterReset')}
          >
            {t('filters.reset')}
          </Button>
        </div>
      )}
    </div>
  )
}
