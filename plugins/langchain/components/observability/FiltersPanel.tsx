'use client'

import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { Input } from '@nextsparkjs/core/components/ui/input'

interface FiltersPanelProps {
  status: string
  agent: string
  search: string
  onStatusChange: (status: string) => void
  onAgentChange: (agent: string) => void
  onSearchChange: (search: string) => void
  availableAgents?: string[]
  className?: string
}

export function FiltersPanel({
  status,
  agent,
  search,
  onStatusChange,
  onAgentChange,
  onSearchChange,
  availableAgents = [],
  className = '',
}: FiltersPanelProps) {
  const t = useTranslations('observability')

  return (
    <div className={`flex items-center gap-4 ${className}`} data-cy="filters-panel">
      <div className="w-[200px]">
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger data-cy="filter-status">
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
            <SelectItem value="success">{t('status.success')}</SelectItem>
            <SelectItem value="error">{t('status.error')}</SelectItem>
            <SelectItem value="running">{t('status.running')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {availableAgents.length > 0 && (
        <div className="w-[200px]">
          <Select value={agent} onValueChange={onAgentChange}>
            <SelectTrigger data-cy="filter-agent">
              <SelectValue placeholder={t('filters.agent')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allAgents')}</SelectItem>
              {availableAgents.map((agentName) => (
                <SelectItem key={agentName} value={agentName}>
                  {agentName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex-1">
        <Input
          type="text"
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          data-cy="filter-search"
          className="max-w-md"
        />
      </div>
    </div>
  )
}
