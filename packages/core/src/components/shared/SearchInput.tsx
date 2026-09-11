'use client'

import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Search, X } from 'lucide-react'
import type { ReactNode, InputHTMLAttributes } from 'react'
import { forwardRef, useImperativeHandle, useRef } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Custom icon element (defaults to Search icon) */
  icon?: ReactNode
  /** Container class name */
  containerClassName?: string
  /** Accessible name for the clear button */
  clearLabel?: string
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
    {
      className,
      containerClassName,
      icon,
      clearLabel = 'Clear search',
      'data-cy': dataCy = 'search-input',
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

    const hasValue = props.value !== undefined && props.value !== null && String(props.value) !== ''
    const showClear = hasValue && !props.disabled && !props.readOnly

    /**
     * Clear through the input itself rather than by calling onChange with a
     * hand-made event: setting the value with the native setter and dispatching
     * a real `input` event is what React's own change handling listens for, so
     * this works for a controlled value and for react-hook-form alike.
     */
    const handleClear = () => {
      const input = innerRef.current
      if (!input) return

      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      setValue?.call(input, '')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.focus()
    }

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
          ref={innerRef}
          type="search"
          className={cn(
            'pl-10 h-10 rounded-lg',
            // The browser draws its own clear affordance on type="search", which
            // carries no test hook and would sit on top of the button below.
            '[&::-webkit-search-cancel-button]:appearance-none',
            showClear && 'pr-10',
            className
          )}
          data-cy={`${dataCy}-input`}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={clearLabel}
            title={clearLabel}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-cy={`${dataCy}-clear`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'
