'use client'

import { icons, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

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
  // Get the icon component from lucide-react icons object
  const IconComponent = (icons[name as keyof typeof icons] || icons[fallback as keyof typeof icons] || icons.LayoutGrid) as LucideIcon

  return <IconComponent className={cn('h-4 w-4', className)} />
}
