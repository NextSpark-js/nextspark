/**
 * MediaToolbar Component
 *
 * Toolbar with upload button, search input, filters, sort, and view toggle.
 *
 * Performance: Wrapped with memo. Sort options memoized.
 */

'use client'

import { memo, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { UploadIcon, SearchIcon, GridIcon, ListIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import type { MediaListOptions } from '../../lib/media/types'

type ViewMode = 'grid' | 'list'

interface MediaToolbarProps {
  onUploadClick?: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  typeFilter: 'all' | 'image' | 'video'
  onTypeFilterChange: (type: 'all' | 'image' | 'video') => void
  sortBy: MediaListOptions['orderBy']
  sortDir: MediaListOptions['orderDir']
  onSortChange: (orderBy: MediaListOptions['orderBy'], orderDir: MediaListOptions['orderDir']) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  className?: string
}

export const MediaToolbar = memo(function MediaToolbar({
  onUploadClick,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  sortBy = 'createdAt',
  sortDir = 'desc',
  onSortChange,
  viewMode,
  onViewModeChange,
  className,
}: MediaToolbarProps) {
  const t = useTranslations('media')

  const sortOptions = useMemo(() => [
    { value: 'createdAt:desc', label: t('toolbar.sort.newest'), orderBy: 'createdAt' as const, orderDir: 'desc' as const },
    { value: 'createdAt:asc', label: t('toolbar.sort.oldest'), orderBy: 'createdAt' as const, orderDir: 'asc' as const },
    { value: 'filename:asc', label: t('toolbar.sort.nameAsc'), orderBy: 'filename' as const, orderDir: 'asc' as const },
    { value: 'filename:desc', label: t('toolbar.sort.nameDesc'), orderBy: 'filename' as const, orderDir: 'desc' as const },
    { value: 'fileSize:desc', label: t('toolbar.sort.sizeDesc'), orderBy: 'fileSize' as const, orderDir: 'desc' as const },
    { value: 'fileSize:asc', label: t('toolbar.sort.sizeAsc'), orderBy: 'fileSize' as const, orderDir: 'asc' as const },
  ], [t])

  const currentSortValue = `${sortBy}:${sortDir}`

  const handleSortChange = useCallback((value: string) => {
    const option = sortOptions.find(opt => opt.value === value)
    if (option) {
      onSortChange(option.orderBy, option.orderDir)
    }
  }, [sortOptions, onSortChange])

  return (
    <div
      data-cy={sel('media.toolbar.container')}
      className={cn('flex flex-col sm:flex-row gap-2 sm:items-center', className)}
    >
      {/* Upload button */}
      {onUploadClick && (
        <Button
          data-cy={sel('media.toolbar.uploadBtn')}
          onClick={onUploadClick}
          className="shrink-0"
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          {t('toolbar.upload')}
        </Button>
      )}

      {/* Search input */}
      <div className="relative flex-1 min-w-[200px]">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          data-cy={sel('media.toolbar.searchInput')}
          type="text"
          placeholder={t('toolbar.search')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Type filter */}
      <Select value={typeFilter} onValueChange={(value) => onTypeFilterChange(value as typeof typeFilter)}>
        <SelectTrigger
          data-cy={sel('media.toolbar.typeFilter')}
          className="w-full sm:w-[150px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('toolbar.typeFilter.all')}</SelectItem>
          <SelectItem value="image">{t('toolbar.typeFilter.images')}</SelectItem>
          <SelectItem value="video">{t('toolbar.typeFilter.videos')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort select */}
      <Select value={currentSortValue} onValueChange={handleSortChange}>
        <SelectTrigger
          data-cy={sel('media.toolbar.sortSelect')}
          className="w-full sm:w-[180px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* View toggle */}
      <div className="flex gap-1 shrink-0">
        <Button
          data-cy={sel('media.toolbar.viewToggle.grid')}
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewModeChange('grid')}
          aria-label={t('toolbar.viewGrid')}
          title={t('toolbar.viewGrid')}
        >
          <GridIcon className="h-4 w-4" />
        </Button>
        <Button
          data-cy={sel('media.toolbar.viewToggle.list')}
          variant={viewMode === 'list' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewModeChange('list')}
          aria-label={t('toolbar.viewList')}
          title={t('toolbar.viewList')}
        >
          <ListIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
})
