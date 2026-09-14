'use client'

import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Search, X } from 'lucide-react'
import type { ReactNode, InputHTMLAttributes } from 'react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

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

    /**
     * The native clear affordance is hidden below, so this button has to appear
     * whenever the field has text — including uncontrolled use, where the value
     * lives in the DOM and never reaches props.
     */
    const isControlled = props.value !== undefined
    const [typedValue, setTypedValue] = useState(() => String(props.defaultValue ?? ''))
    const currentValue = isControlled ? props.value : typedValue

    const hasValue = currentValue !== null && currentValue !== undefined && String(currentValue) !== ''
    const showClear = hasValue && !props.disabled && !props.readOnly

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setTypedValue(event.target.value)
      props.onChange?.(event)
    }

    /**
     * A value can reach the field without passing through props or an event:
     * react-hook-form writes it straight to the input through the ref. Reading
     * the DOM back on every render is what keeps the button honest about what
     * is actually in the field.
     */
    useEffect(() => {
      if (isControlled) return
      const inDom = innerRef.current?.value ?? ''
      setTypedValue(current => (current === inDom ? current : inDom))
    })

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
      if (!isControlled) setTypedValue('')
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
          onChange={handleChange}
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
