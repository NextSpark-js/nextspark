'use client'

import { cn } from '../../lib/utils'
import { createCyId } from '../../lib/test'

interface LastUsedBadgeProps {
  children: React.ReactNode
  text: string
  className?: string
  'data-cy'?: string
}

export function LastUsedBadge({ children, text, className, 'data-cy': dataCy }: LastUsedBadgeProps) {
  return (
    <div
      className={cn("relative", className)}
      {...dataCy && { 'data-cy': dataCy }}
    >
      {children}
      <div
        className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full shadow-lg border-2 border-background z-10 animate-in fade-in-0 zoom-in-95 duration-300"
        {...createCyId('badge', 'text') && { 'data-cy': createCyId('badge', 'text') }}
      >
        {text}
      </div>
    </div>
  )
}