/**
 * MediaCard Component
 *
 * Individual media thumbnail card for grid view.
 * Shows image preview, filename, selection state, and actions menu.
 *
 * Performance: Wrapped with React.memo to prevent re-renders when sibling cards change.
 * Uses content-visibility: auto for off-screen rendering optimization.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon, VideoIcon, FileIcon, MoreVerticalIcon, Edit2Icon, Trash2Icon } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import type { Media } from '../../lib/media/types'

interface MediaCardProps {
  media: Media
  isSelected: boolean
  onSelect: (media: Media, options?: { shiftKey?: boolean }) => void
  onEdit?: (media: Media) => void
  onDelete?: (media: Media) => void
  mode?: 'single' | 'multiple'
}

export const MediaCard = React.memo(function MediaCard({
  media,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  mode = 'single',
}: MediaCardProps) {
  const t = useTranslations('media')

  const isImage = media.mimeType.startsWith('image/')
  const isVideo = media.mimeType.startsWith('video/')

  const handleCardClick = React.useCallback((e: React.MouseEvent) => {
    if (e.shiftKey && mode === 'multiple') {
      // Shift+click = range selection (Google Photos pattern)
      onSelect(media, { shiftKey: true })
    } else if (onEdit) {
      // Normal click = open detail/edit (dashboard manager mode)
      onEdit(media)
    } else {
      // No onEdit handler = picker mode, click selects
      onSelect(media)
    }
  }, [media, onSelect, onEdit, mode])

  const handleCheckboxClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(media, { shiftKey: e.shiftKey })
  }, [media, onSelect])

  const handleMenuClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const handleEditClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(media)
  }, [media, onEdit])

  const handleDeleteClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(media)
  }, [media, onDelete])

  return (
    <Card
      data-cy={sel('media.grid.item', { id: media.id })}
      className={cn(
        'group relative overflow-hidden transition-shadow cursor-pointer hover:shadow-md select-none',
        '[content-visibility:auto] [contain-intrinsic-size:auto_200px]',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        {/* Thumbnail */}
        <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden">
          {isImage ? (
            <img
              data-cy={sel('media.grid.thumbnail', { id: media.id })}
              src={media.url}
              alt={media.alt || media.filename}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : isVideo ? (
            <VideoIcon className="w-12 h-12 text-muted-foreground" />
          ) : (
            <FileIcon className="w-12 h-12 text-muted-foreground" />
          )}

          {/* Selection overlay */}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/10 z-[1] pointer-events-none" />
          )}

          {/* Checkbox for multi-select */}
          {mode === 'multiple' && (
            <div
              className={cn(
                'absolute top-2 left-2 z-10 transition-all duration-150',
                isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'
              )}
              onClick={handleCheckboxClick}
            >
              <Checkbox
                data-cy={sel('media.grid.checkbox', { id: media.id })}
                checked={isSelected}
                aria-label={`${t('actions.select')} ${media.filename}`}
                className={cn(
                  'h-5 w-5 rounded-md shadow-md border-2 transition-colors pointer-events-none',
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-white/90 border-white/60 backdrop-blur-sm'
                )}
              />
            </div>
          )}

          {/* Actions menu - visible on hover, hidden in picker mode (no onEdit/onDelete) */}
          {(onEdit || onDelete) && (
            <div
              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleMenuClick}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-cy={sel('media.grid.menuBtn', { id: media.id })}
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t('list.actions')}
                  >
                    <MoreVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem
                      data-cy={sel('media.grid.menuEdit', { id: media.id })}
                      onClick={handleEditClick}
                    >
                      <Edit2Icon className="mr-2 h-4 w-4" />
                      {t('actions.edit')}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      data-cy={sel('media.grid.menuDelete', { id: media.id })}
                      onClick={handleDeleteClick}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2Icon className="mr-2 h-4 w-4" />
                      {t('actions.delete')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Title / Filename */}
        <div className="p-2">
          <p className="text-sm truncate" title={media.title || media.filename}>
            {media.title || media.filename}
          </p>
          {media.width && media.height && (
            <p className="text-xs text-muted-foreground">
              {t('grid.dimensions', { width: media.width, height: media.height })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
