'use client'

import { Badge } from '../../ui/badge'
import { cn } from '../../../lib/utils'
import type { HttpMethod } from './types'

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900',
  PATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900',
  PUT: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900',
  OPTIONS: 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-900',
}

interface MethodSelectorProps {
  methods: string[]
  selected: HttpMethod
  onSelect: (method: HttpMethod) => void
}

export function MethodSelector({ methods, selected, onSelect }: MethodSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap" data-cy="api-tester-method-selector">
      {methods.map((method) => (
        <Badge
          key={method}
          variant="secondary"
          className={cn(
            'cursor-pointer font-mono text-sm px-3 py-1 transition-all',
            methodColors[method] || '',
            selected === method && 'ring-2 ring-offset-2 ring-primary'
          )}
          onClick={() => onSelect(method as HttpMethod)}
          data-cy={`api-tester-method-${method.toLowerCase()}`}
        >
          {method}
        </Badge>
      ))}
    </div>
  )
}
