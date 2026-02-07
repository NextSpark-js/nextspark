/**
 * MediaCard Component
 *
 * Individual media thumbnail card for grid view.
 * Shows image preview, filename, selection state, and actions menu.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon, VideoIcon, FileIcon, MoreVerticalIcon, Edit2Icon, Trash2Icon, CheckCircle2Icon } from 'lucide-react'
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
  onSelect: (media: Media) => void
  onEdit?: (media: Media) => void
  onDelete?: (media: Media) => void
  mode?: 'single' | 'multiple'
}

export function MediaCard({
  media,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  mode = 'single',
}: MediaCardProps) {
  const t = useTranslations('media')
  const [isHovered, setIsHovered] = React.useState(false)

  const isImage = media.mimeType.startsWith('image/')
  const isVideo = media.mimeType.startsWith('video/')

  const handleCardClick = () => {
    onSelect(media)
  }

  const handleCheckboxChange = (checked: boolean) => {
    if (checked) {
      onSelect(media)
    }
  }

  return (
    <Card
      data-cy={sel('media.grid.item', { id: media.id })}
      className={cn(
        'group relative overflow-hidden transition-all cursor-pointer hover:shadow-lg',
        isSelected && 'ring-2 ring-primary'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
            />
          ) : isVideo ? (
            <VideoIcon className="w-12 h-12 text-muted-foreground" />
          ) : (
            <FileIcon className="w-12 h-12 text-muted-foreground" />
          )}

          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
              <CheckCircle2Icon className="w-12 h-12 text-primary" />
            </div>
          )}

          {/* Checkbox for multi-select */}
          {mode === 'multiple' && (
            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                data-cy={sel('media.grid.checkbox', { id: media.id })}
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                aria-label={`${t('actions.select')} ${media.filename}`}
                className="bg-background border-2"
              />
            </div>
          )}

          {/* Actions menu */}
          {(isHovered || isSelected) && (
            <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
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
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(media)
                      }}
                    >
                      <Edit2Icon className="mr-2 h-4 w-4" />
                      {t('actions.edit')}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      data-cy={sel('media.grid.menuDelete', { id: media.id })}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(media)
                      }}
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

        {/* Filename */}
        <div className="p-2">
          <p className="text-sm truncate" title={media.filename}>
            {media.filename}
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
}
