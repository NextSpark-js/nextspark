/**
 * Media Dashboard Page
 *
 * Full-page media library for browsing, uploading, and managing media.
 * Follows the same layout pattern as EntityListWrapper for consistency.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  UploadIcon,
  Trash2Icon,
  SearchIcon,
  GridIcon,
  ListIcon,
  XIcon,
  ChevronUpIcon,
  ImageIcon,
} from 'lucide-react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@nextsparkjs/core/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nextsparkjs/core/components/ui/alert-dialog'
import { MediaGrid } from '@nextsparkjs/core/components/media/MediaGrid'
import { MediaList } from '@nextsparkjs/core/components/media/MediaList'
import { MediaUploadZone } from '@nextsparkjs/core/components/media/MediaUploadZone'
import { MediaDetailPanel } from '@nextsparkjs/core/components/media/MediaDetailPanel'
import { MediaTagFilter } from '@nextsparkjs/core/components/media/MediaTagFilter'
import { useMediaList, useDeleteMedia } from '@nextsparkjs/core/hooks/useMedia'
import { useDebounce } from '@nextsparkjs/core/hooks/useDebounce'
import { useToast } from '@nextsparkjs/core/hooks/useToast'
import { sel } from '@nextsparkjs/core/lib/selectors'
import type { Media, MediaListOptions } from '@nextsparkjs/core/lib/media/types'

type ViewMode = 'grid' | 'list'

const PAGE_SIZE = 40

export default function MediaDashboardPage() {
  const t = useTranslations('media')
  const { toast } = useToast()
  const deleteMutation = useDeleteMedia()

  // State
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'image' | 'video'>('all')
  const [sortBy, setSortBy] = React.useState<MediaListOptions['orderBy']>('createdAt')
  const [sortDir, setSortDir] = React.useState<MediaListOptions['orderDir']>('desc')
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [editingMedia, setEditingMedia] = React.useState<Media | null>(null)
  const [deletingMedia, setDeletingMedia] = React.useState<Media | null>(null)
  const [page, setPage] = React.useState(0)
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([])
  const [showUpload, setShowUpload] = React.useState(false)
  const [columns, setColumns] = React.useState(6)

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Reset pagination when filters change
  React.useEffect(() => {
    setPage(0)
  }, [debouncedSearch, typeFilter, sortBy, sortDir, selectedTagIds])

  // Fetch media
  const { data, isLoading, refetch } = useMediaList({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    orderBy: sortBy,
    orderDir: sortDir,
    type: typeFilter,
    search: debouncedSearch || undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
  })

  const items = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasNextPage = page < totalPages - 1
  const hasPrevPage = page > 0

  const sortOptions: { value: string; label: string; orderBy: MediaListOptions['orderBy']; orderDir: 'asc' | 'desc' }[] = [
    { value: 'createdAt:desc', label: t('toolbar.sort.newest'), orderBy: 'createdAt', orderDir: 'desc' },
    { value: 'createdAt:asc', label: t('toolbar.sort.oldest'), orderBy: 'createdAt', orderDir: 'asc' },
    { value: 'filename:asc', label: t('toolbar.sort.nameAsc'), orderBy: 'filename', orderDir: 'asc' },
    { value: 'filename:desc', label: t('toolbar.sort.nameDesc'), orderBy: 'filename', orderDir: 'desc' },
    { value: 'fileSize:desc', label: t('toolbar.sort.sizeDesc'), orderBy: 'fileSize', orderDir: 'desc' },
    { value: 'fileSize:asc', label: t('toolbar.sort.sizeAsc'), orderBy: 'fileSize', orderDir: 'asc' },
  ]
  const currentSortValue = `${sortBy}:${sortDir}`

  const handleSortChange = (value: string) => {
    const option = sortOptions.find(opt => opt.value === value)
    if (option) {
      setSortBy(option.orderBy)
      setSortDir(option.orderDir)
    }
  }

  const handleSelect = (media: Media) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(media.id)) {
        newSet.delete(media.id)
      } else {
        newSet.add(media.id)
      }
      return newSet
    })
  }

  const handleDelete = async () => {
    if (!deletingMedia) return
    try {
      await deleteMutation.mutateAsync(deletingMedia.id)
      toast({ title: t('delete.success') })
      setDeletingMedia(null)
      setSelectedIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(deletingMedia.id)
        return newSet
      })
      refetch()
    } catch (error) {
      toast({
        title: t('delete.error'),
        description: error instanceof Error ? error.message : t('delete.error'),
        variant: 'destructive',
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    let successCount = 0
    for (const id of selectedIds) {
      try {
        await deleteMutation.mutateAsync(id)
        successCount++
      } catch { /* continue */ }
    }
    if (successCount > 0) {
      toast({
        title: t('delete.success'),
        description: t('dashboard.bulkDeleteSuccess', { count: successCount }),
      })
      setSelectedIds(new Set())
      refetch()
    }
  }

  const handleUploadComplete = (uploadedMedia: Media[]) => {
    setShowUpload(false)
    refetch()

    // Auto-open edit panel for single file uploads
    if (uploadedMedia.length === 1) {
      setEditingMedia(uploadedMedia[0])
    }
  }

  const selectedCount = selectedIds.size

  return (
    <div
      data-cy={sel('media.dashboard.container')}
      className="p-6 space-y-6"
    >
      {/* Row 1: Title + Actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1
            data-cy={sel('media.dashboard.title')}
            className="text-2xl font-bold tracking-tight"
          >
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('dashboard.subtitle', { count: total })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk actions */}
          {selectedCount > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {t('dashboard.selected', { count: selectedCount })}
              </span>
              <Button
                data-cy={sel('media.dashboard.bulkDeleteBtn')}
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2Icon className="mr-1.5 h-4 w-4" />
                {t('dashboard.bulkDelete')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? (
              <>
                <ChevronUpIcon className="mr-2 h-4 w-4" />
                {t('dashboard.hideUpload')}
              </>
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                {t('toolbar.upload')}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Upload zone (collapsible) */}
      {showUpload && (
        <MediaUploadZone onUploadComplete={handleUploadComplete} />
      )}

      {/* Row 2: Search + Filters + Sort + View toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            data-cy={sel('media.toolbar.searchInput')}
            type="text"
            placeholder={t('toolbar.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
          <SelectTrigger
            data-cy={sel('media.toolbar.typeFilter')}
            className="w-[140px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('toolbar.typeFilter.all')}</SelectItem>
            <SelectItem value="image">{t('toolbar.typeFilter.images')}</SelectItem>
            <SelectItem value="video">{t('toolbar.typeFilter.videos')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Tag filter */}
        <MediaTagFilter
          selectedTagIds={selectedTagIds}
          onTagsChange={setSelectedTagIds}
        />

        {/* Sort */}
        <Select value={currentSortValue} onValueChange={handleSortChange}>
          <SelectTrigger
            data-cy={sel('media.toolbar.sortSelect')}
            className="w-[180px]"
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

        {/* Column selector + View toggle */}
        <div className="sm:ml-auto flex items-center gap-2">
          {viewMode === 'grid' && (
            <Select
              value={String(columns)}
              onValueChange={(v) => setColumns(Number(v))}
            >
              <SelectTrigger
                data-cy={sel('media.toolbar.columnSelect')}
                className="w-[70px] h-9"
                aria-label={t('toolbar.columns')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[4, 5, 6, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              data-cy={sel('media.toolbar.viewToggle.grid')}
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('grid')}
              aria-label={t('toolbar.viewGrid')}
            >
              <GridIcon className="h-4 w-4" />
            </Button>
            <Button
              data-cy={sel('media.toolbar.viewToggle.list')}
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('list')}
              aria-label={t('toolbar.viewList')}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Row 3: Content */}
      {viewMode === 'grid' ? (
        <MediaGrid
          items={items}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onEdit={setEditingMedia}
          onDelete={setDeletingMedia}
          mode="multiple"
          columns={columns}
        />
      ) : (
        <MediaList
          items={items}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onEdit={setEditingMedia}
          onDelete={setDeletingMedia}
          mode="multiple"
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          data-cy={sel('media.dashboard.pagination')}
          className="flex items-center justify-between pt-4 border-t"
        >
          <p className="text-sm text-muted-foreground">
            {t('dashboard.pagination', {
              from: page * PAGE_SIZE + 1,
              to: Math.min((page + 1) * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              data-cy={sel('media.dashboard.prevPageBtn')}
              variant="outline"
              size="sm"
              disabled={!hasPrevPage}
              onClick={() => setPage(page - 1)}
            >
              {t('dashboard.prevPage')}
            </Button>
            <Button
              data-cy={sel('media.dashboard.nextPageBtn')}
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => setPage(page + 1)}
            >
              {t('dashboard.nextPage')}
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog (centered modal) */}
      <Dialog open={!!editingMedia} onOpenChange={(open) => !open && setEditingMedia(null)}>
        <DialogContent
          data-cy={sel('media.detail.dialog')}
          className="sm:max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden"
        >
          <div className="grid md:grid-cols-[1.4fr_1fr] md:h-[80vh]">
            {/* Left: Image preview - Dark canvas */}
            <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden h-[250px] md:h-auto">
              {editingMedia?.mimeType.startsWith('image/') ? (
                <img
                  src={editingMedia.url}
                  alt={editingMedia.alt || editingMedia.filename}
                  className="max-w-[90%] max-h-[90%] object-contain select-none"
                  draggable={false}
                />
              ) : (
                <ImageIcon className="h-20 w-20 text-neutral-700" />
              )}
            </div>
            {/* Right: Details panel */}
            <div className="flex flex-col min-h-0 border-l max-h-[55vh] md:max-h-none overflow-hidden">
              <div className="px-5 py-3.5 border-b shrink-0">
                <DialogTitle className="text-sm font-semibold">{t('detail.title')}</DialogTitle>
                <DialogDescription className="sr-only">{editingMedia?.filename}</DialogDescription>
              </div>
              <MediaDetailPanel
                media={editingMedia}
                onClose={() => setEditingMedia(null)}
                showPreview={false}
                className="flex-1 min-h-0"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingMedia}
        onOpenChange={(open) => !open && setDeletingMedia(null)}
      >
        <AlertDialogContent data-cy={sel('media.deleteConfirm.dialog')}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.message')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-cy={sel('media.deleteConfirm.cancelBtn')}>
              {t('delete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-cy={sel('media.deleteConfirm.confirmBtn')}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
