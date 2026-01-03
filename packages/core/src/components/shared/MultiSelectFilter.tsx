'use client'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover'
import { ChevronDown, Check, X } from 'lucide-react'
import { useState } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface FilterOption {
  value: string
  label: string
}

export interface MultiSelectFilterProps {
  /** Button label when no selection */
  label: string
  /** Available filter options */
  options: FilterOption[]
  /** Currently selected values */
  values: string[]
  /** Callback when selection changes */
  onChange: (values: string[]) => void
  /** Additional class names for the trigger button */
  className?: string
  /** data-cy attribute for E2E testing */
  'data-cy'?: string
}

// ============================================================================
// Component
// ============================================================================

/**
 * MultiSelectFilter - Multi-select dropdown for filtering data
 *
 * Features:
 * - Multiple selection with checkboxes
 * - Selected items shown as badges
 * - Individual badge removal with X button
 * - No filter applied when empty (no "All" option needed)
 *
 * @example
 * <MultiSelectFilter
 *   label="Status"
 *   options={[
 *     { value: 'active', label: 'Active' },
 *     { value: 'inactive', label: 'Inactive' },
 *   ]}
 *   values={selectedStatuses}
 *   onChange={setSelectedStatuses}
 *   data-cy="filter-status"
 * />
 */
export function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
  className,
  'data-cy': dataCy = 'multi-select-filter',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const selectedOptions = options.filter((opt) => values.includes(opt.value))
  const hasSelection = selectedOptions.length > 0

  const handleToggle = (optionValue: string) => {
    if (values.includes(optionValue)) {
      onChange(values.filter((v) => v !== optionValue))
    } else {
      onChange([...values, optionValue])
    }
  }

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(values.filter((v) => v !== optionValue))
  }

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  return (
    <div className="flex items-center gap-2" data-cy={dataCy}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-10 gap-2 justify-between min-w-[120px]',
              hasSelection && 'text-foreground',
              className
            )}
            data-cy={`${dataCy}-trigger`}
          >
            <span className="truncate">
              {hasSelection ? `${label} (${selectedOptions.length})` : label}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                open && 'rotate-180'
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-48 p-1"
          align="start"
          data-cy={`${dataCy}-content`}
        >
          <div className="flex flex-col">
            {options.map((option) => {
              const isSelected = values.includes(option.value)
              return (
                <button
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm rounded-md',
                    'flex items-center justify-between gap-2',
                    'hover:bg-muted transition-colors',
                    isSelected && 'bg-muted font-medium'
                  )}
                  data-cy={`${dataCy}-option-${option.value}`}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected badges */}
      {hasSelection && (
        <div className="flex items-center gap-1 flex-wrap">
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1',
                'text-xs font-medium rounded-md',
                'bg-primary/10 text-primary'
              )}
              data-cy={`${dataCy}-badge-${option.value}`}
            >
              {option.label}
              <button
                onClick={(e) => handleRemove(option.value, e)}
                className="hover:bg-primary/20 rounded-sm p-0.5 transition-colors"
                aria-label={`Remove ${option.label}`}
                data-cy={`${dataCy}-remove-${option.value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedOptions.length > 1 && (
            <button
              onClick={handleClearAll}
              className={cn(
                'text-xs text-muted-foreground hover:text-foreground',
                'px-1.5 py-1 transition-colors'
              )}
              aria-label="Clear all filters"
              data-cy={`${dataCy}-clear-all`}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
