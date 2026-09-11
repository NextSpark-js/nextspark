'use client'

import { LayoutGrid } from 'lucide-react'
import { cn } from '../../lib/utils'
import { resolveIcon } from '../../lib/icons'

interface DynamicIconProps {
  name: string
  className?: string
  fallback?: string
}

/**
 * Renders a Lucide icon dynamically by name.
 * Falls back to 'LayoutGrid' if icon name is not found.
 */
export function DynamicIcon({ name, className, fallback = 'LayoutGrid' }: DynamicIconProps) {
  const IconComponent = resolveIcon(name, resolveIcon(fallback, LayoutGrid))

  return <IconComponent className={cn('h-4 w-4', className)} />
}
