/**
 * Quick Filters Component
 * Reusable filter pills for CRM views
 */

import React from 'react'
import '@/contents/themes/crm/styles/crm-theme.css'

export interface FilterOption {
    id: string
    label: string
    count?: number
}

interface QuickFiltersProps {
    filters: FilterOption[]
    activeFilter: string
    onFilterChange: (filterId: string) => void
    className?: string
}

export function QuickFilters({
    filters,
    activeFilter,
    onFilterChange,
    className = '',
}: QuickFiltersProps) {
    return (
        <div className={`crm-filters ${className}`} data-cy="quick-filters">
            {filters.map((filter) => (
                <button
                    key={filter.id}
                    className={`crm-filter-pill ${activeFilter === filter.id ? 'active' : ''}`}
                    onClick={() => onFilterChange(filter.id)}
                    data-cy={`quick-filter-${filter.id}`}
                >
                    {filter.label}
                    {filter.count !== undefined && (
                        <span className="ml-1.5 opacity-60">({filter.count})</span>
                    )}
                </button>
            ))}
        </div>
    )
}

export default QuickFilters
