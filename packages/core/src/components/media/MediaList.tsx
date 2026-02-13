/**
 * MediaList Component
 *
 * Table/list view of media items with columns for metadata.
 *
 * Performance: Images use lazy loading + async decoding.
 * Row hover highlights for better visual feedback.
 */

'use client'

import { useTranslations } from 'next-intl'
import { MoreVerticalIcon, Edit2Icon, Trash2Icon, ImageIcon } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Skeleton } from '../ui/skeleton'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import type { Media } from '../../lib/media/types'

interface MediaListProps {
  items: Media[]
  isLoading: boolean
  selectedIds: Set<string>
  onSelect?: (media: Media, options?: { shiftKey?: boolean }) => void
  onEdit?: (media: Media) => void
  onDelete?: (media: Media) => void
  mode?: 'single' | 'multiple'
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function MediaList({
  items,
  isLoading,
  selectedIds,
  onSelect,
  onEdit,
  onDelete,
  mode = 'single',
  className,
}: MediaListProps) {
  const t = useTranslations('media')

  if (isLoading) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {mode === 'multiple' && <TableHead className="w-12"></TableHead>}
              <TableHead className="w-16"></TableHead>
              <TableHead>{t('list.filename')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('list.type')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('list.size')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('list.dimensions')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('list.uploaded')}</TableHead>
              {(onEdit || onDelete) && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {mode === 'multiple' && (
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                )}
                <TableCell>
                  <Skeleton className="h-10 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                {(onEdit || onDelete) && (
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
      data-cy={sel('media.list.container')}
      className={cn('rounded-md border', className)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {mode === 'multiple' && <TableHead className="w-12"></TableHead>}
            <TableHead className="w-16"></TableHead>
            <TableHead>{t('list.filename')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('list.type')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('list.size')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('list.dimensions')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('list.uploaded')}</TableHead>
            {(onEdit || onDelete) && <TableHead className="w-12">{t('list.actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((media) => {
            const isSelected = selectedIds.has(media.id)
            const isImage = media.mimeType.startsWith('image/')

            return (
              <TableRow
                key={media.id}
                data-cy={sel('media.list.row', { id: media.id })}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  isSelected && 'bg-muted'
                )}
                onClick={() => onEdit ? onEdit(media) : onSelect?.(media)}
              >
                {mode === 'multiple' && onSelect && (
                  <TableCell onClick={(e) => {
                    e.stopPropagation()
                    onSelect(media, { shiftKey: e.shiftKey })
                  }}>
                    <Checkbox
                      data-cy={sel('media.list.checkbox', { id: media.id })}
                      checked={isSelected}
                      aria-label={`${t('actions.select')} ${media.filename}`}
                      className="pointer-events-none"
                    />
                  </TableCell>
                )}
                <TableCell>
                  {isImage ? (
                    <img
                      src={media.url}
                      alt={media.alt || media.filename}
                      className="h-10 w-10 rounded object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{media.title || media.filename}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {media.mimeType}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {formatFileSize(media.fileSize)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {media.width && media.height
                    ? `${media.width} × ${media.height}`
                    : '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {formatDate(media.createdAt)}
                </TableCell>
                {(onEdit || onDelete) && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t('list.actions')}
                        >
                          <MoreVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(media)}>
                            <Edit2Icon className="mr-2 h-4 w-4" />
                            {t('actions.edit')}
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(media)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2Icon className="mr-2 h-4 w-4" />
                            {t('actions.delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
