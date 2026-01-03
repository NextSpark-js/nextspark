'use client'

import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Search } from 'lucide-react'
import type { ReactNode, InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Custom icon element (defaults to Search icon) */
  icon?: ReactNode
  /** Container class name */
  containerClassName?: string
  /** data-cy attribute for E2E testing */
  'data-cy'?: string
}

// ============================================================================
// Component
// ============================================================================

/**
 * SearchInput - Input field with search icon
 *
 * @example
 * <SearchInput
 *   placeholder="Search..."
 *   value={search}
 *   onChange={(e) => setSearch(e.target.value)}
 *   data-cy="search-people"
 * />
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    { className, containerClassName, icon, 'data-cy': dataCy = 'search-input', ...props },
    ref
  ) => {
    return (
      <div
        className={cn('relative w-full', containerClassName)}
        data-cy={dataCy}
      >
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          data-cy={`${dataCy}-icon`}
        >
          {icon || <Search className="h-4 w-4" />}
        </span>
        <Input
          ref={ref}
          type="search"
          className={cn('pl-10 h-10 rounded-lg', className)}
          data-cy={`${dataCy}-input`}
          {...props}
        />
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'
