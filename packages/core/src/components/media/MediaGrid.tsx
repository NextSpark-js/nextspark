/**
 * MediaGrid Component
 *
 * Grid view of media items using MediaCard components.
 * Responsive: 6 cols desktop, 4 cols tablet, 2 cols mobile.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon } from 'lucide-react'
import { MediaCard } from './MediaCard'
import { Skeleton } from '../ui/skeleton'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import type { Media } from '../../lib/media/types'

interface MediaGridProps {
  items: Media[]
  isLoading: boolean
  selectedIds: Set<string>
  onSelect: (media: Media) => void
  onEdit?: (media: Media) => void
  onDelete?: (media: Media) => void
  mode?: 'single' | 'multiple'
  columns?: number
  className?: string
}

export function MediaGrid({
  items,
  isLoading,
  selectedIds,
  onSelect,
  onEdit,
  onDelete,
  mode = 'single',
  columns = 6,
  className,
}: MediaGridProps) {
  const t = useTranslations('media')
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }

  if (isLoading) {
    return (
      <div
        data-cy={sel('media.grid.container')}
        className={cn('grid gap-3', className)}
        style={gridStyle}
      >
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        data-cy={sel('media.empty.container')}
        className="flex flex-col items-center justify-center py-12 text-center"
      >
        <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('grid.noResults')}</p>
      </div>
    )
  }

  return (
    <div
      data-cy={sel('media.grid.container')}
      className={cn('grid gap-3', className)}
      style={gridStyle}
    >
      {items.map((media) => (
        <MediaCard
          key={media.id}
          media={media}
          isSelected={selectedIds.has(media.id)}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          mode={mode}
        />
      ))}
    </div>
  )
}
