'use client'

import { useState, useCallback, useMemo, useRef, useEffect, startTransition, type ChangeEvent } from 'react'
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
  LoaderIcon,
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
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import type { Media, MediaListOptions } from '@nextsparkjs/core/lib/media/types'

type ViewMode = 'grid' | 'list'

const PAGE_SIZE = 40

function DefaultMediaDashboardPage() {
  const t = useTranslations('media')
  const { toast } = useToast()
  const deleteMutation = useDeleteMedia()

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all')
  const [sortBy, setSortBy] = useState<MediaListOptions['orderBy']>('createdAt')
  const [sortDir, setSortDir] = useState<MediaListOptions['orderDir']>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingMedia, setEditingMedia] = useState<Media | null>(null)
  const [deletingMedia, setDeletingMedia] = useState<Media | null>(null)
  const [page, setPage] = useState(0)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [columns, setColumns] = useState(6)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 })
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const lastSelectedIndexRef = useRef<number | null>(null)

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Reset pagination when filters change
  useEffect(() => {
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

  // Memoize sort options to prevent array recreation
  const sortOptions = useMemo(() => [
    { value: 'createdAt:desc', label: t('toolbar.sort.newest'), orderBy: 'createdAt' as const, orderDir: 'desc' as const },
    { value: 'createdAt:asc', label: t('toolbar.sort.oldest'), orderBy: 'createdAt' as const, orderDir: 'asc' as const },
    { value: 'filename:asc', label: t('toolbar.sort.nameAsc'), orderBy: 'filename' as const, orderDir: 'asc' as const },
    { value: 'filename:desc', label: t('toolbar.sort.nameDesc'), orderBy: 'filename' as const, orderDir: 'desc' as const },
    { value: 'fileSize:desc', label: t('toolbar.sort.sizeDesc'), orderBy: 'fileSize' as const, orderDir: 'desc' as const },
    { value: 'fileSize:asc', label: t('toolbar.sort.sizeAsc'), orderBy: 'fileSize' as const, orderDir: 'asc' as const },
  ], [t])

  const currentSortValue = `${sortBy}:${sortDir}`

  // Stable callbacks with useCallback + functional setState
  const handleSortChange = useCallback((value: string) => {
    const option = sortOptions.find(opt => opt.value === value)
    if (option) {
      startTransition(() => {
        setSortBy(option.orderBy)
        setSortDir(option.orderDir)
      })
    }
  }, [sortOptions])

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleTypeFilterChange = useCallback((value: string) => {
    startTransition(() => {
      setTypeFilter(value as 'all' | 'image' | 'video')
    })
  }, [])

  const handleTagsChange = useCallback((tagIds: string[]) => {
    startTransition(() => {
      setSelectedTagIds(tagIds)
    })
  }, [])

  const handleSelect = useCallback((media: Media, options?: { shiftKey?: boolean }) => {
    const currentIndex = items.findIndex(m => m.id === media.id)
    if (currentIndex === -1) return

    const lastIndex = lastSelectedIndexRef.current
    if (options?.shiftKey && lastIndex !== null && lastIndex >= 0 && lastIndex < items.length) {
      // Range selection: select all items between last selected and current
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        for (let i = start; i <= end; i++) {
          newSet.add(items[i].id)
        }
        return newSet
      })
    } else {
      // Toggle single selection
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

    lastSelectedIndexRef.current = currentIndex
  }, [items])

  const handleDelete = useCallback(async () => {
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
  }, [deletingMedia, deleteMutation, toast, t, refetch])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    setShowBulkDeleteConfirm(false)
    setIsBulkDeleting(true)
    const idsArray = Array.from(selectedIds)
    const totalCount = idsArray.length
    setBulkDeleteProgress({ current: 0, total: totalCount })

    let successCount = 0
    for (let i = 0; i < idsArray.length; i++) {
      setBulkDeleteProgress({ current: i + 1, total: totalCount })
      try {
        await deleteMutation.mutateAsync(idsArray[i])
        successCount++
      } catch { /* continue */ }
    }

    setIsBulkDeleting(false)
    setBulkDeleteProgress({ current: 0, total: 0 })

    if (successCount > 0) {
      toast({
        title: t('delete.success'),
        description: t('dashboard.bulkDeleteSuccess', { count: successCount }),
      })
      setSelectedIds(new Set())
      lastSelectedIndexRef.current = null
      refetch()
    }
  }, [selectedIds, deleteMutation, toast, t, refetch])

  const handleUploadComplete = useCallback((uploadedMedia: Media[]) => {
    setShowUpload(false)
    refetch()

    // Auto-open edit panel for single file uploads
    if (uploadedMedia.length === 1) {
      setEditingMedia(uploadedMedia[0])
    }
  }, [refetch])

  const handleToggleUpload = useCallback(() => {
    setShowUpload(prev => !prev)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setEditingMedia(null)
  }, [])

  const handleCloseDeletingMedia = useCallback((open: boolean) => {
    if (!open) setDeletingMedia(null)
  }, [])

  const handlePrevPage = useCallback(() => {
    setPage(prev => prev - 1)
  }, [])

  const handleNextPage = useCallback(() => {
    setPage(prev => prev + 1)
  }, [])

  const handleColumnsChange = useCallback((v: string) => {
    setColumns(Number(v))
  }, [])

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

        <Button onClick={handleToggleUpload}>
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
            onChange={handleSearchChange}
            className="pl-8"
          />
        </div>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
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
          onTagsChange={handleTagsChange}
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
              onValueChange={handleColumnsChange}
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
      <div className={isBulkDeleting ? 'pointer-events-none opacity-50' : ''}>
        {viewMode === 'grid' ? (
          <MediaGrid
            items={items}
            isLoading={isLoading}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onEdit={isBulkDeleting ? undefined : setEditingMedia}
            onDelete={isBulkDeleting ? undefined : setDeletingMedia}
            mode="multiple"
            columns={columns}
          />
        ) : (
          <MediaList
            items={items}
            isLoading={isLoading}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onEdit={isBulkDeleting ? undefined : setEditingMedia}
            onDelete={isBulkDeleting ? undefined : setDeletingMedia}
            mode="multiple"
          />
        )}
      </div>

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
              onClick={handlePrevPage}
            >
              {t('dashboard.prevPage')}
            </Button>
            <Button
              data-cy={sel('media.dashboard.nextPageBtn')}
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={handleNextPage}
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
                  decoding="async"
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
                onClose={handleCloseDetail}
                showPreview={false}
                className="flex-1 min-h-0"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single delete confirmation dialog */}
      <AlertDialog
        open={!!deletingMedia}
        onOpenChange={handleCloseDeletingMedia}
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

      {/* Bulk delete confirmation dialog */}
      <AlertDialog
        open={showBulkDeleteConfirm}
        onOpenChange={(open) => !open && setShowBulkDeleteConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('dashboard.bulkDeleteConfirm', { count: selectedCount })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.bulkDeleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2Icon className="mr-1.5 h-4 w-4" />
              {t('dashboard.bulkDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating action bar */}
      {(selectedCount > 0 || isBulkDeleting) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-3 bg-background border border-border rounded-xl shadow-lg px-4 py-2.5">
            {isBulkDeleting ? (
              <>
                <LoaderIcon className="h-4 w-4 animate-spin text-destructive" />
                <span className="text-sm font-medium">
                  {t('dashboard.bulkDeleting', {
                    current: bulkDeleteProgress.current,
                    total: bulkDeleteProgress.total,
                  })}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">
                  {t('dashboard.selected', { count: selectedCount })}
                </span>
                <div className="h-4 w-px bg-border" />
                <Button
                  data-cy={sel('media.dashboard.bulkDeleteBtn')}
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                >
                  <Trash2Icon className="mr-1.5 h-4 w-4" />
                  {t('dashboard.bulkDelete')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedIds(new Set())
                    lastSelectedIndexRef.current = null
                  }}
                  className="text-muted-foreground"
                >
                  <XIcon className="mr-1 h-3.5 w-3.5" />
                  {t('dashboard.deselectAll')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Export the resolved component (theme override or default)
export default getTemplateOrDefaultClient('app/dashboard/(main)/media/page.tsx', DefaultMediaDashboardPage)
