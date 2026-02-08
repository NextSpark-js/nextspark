/**
 * MediaLibrary Component
 *
 * Main modal for browsing, uploading, and selecting media.
 * Manages state for search, filtering, sorting, selection, and view mode.
 *
 * Performance: Stable callbacks with useCallback + functional setState.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { XIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog'
import { MediaToolbar } from './MediaToolbar'
import { MediaGrid } from './MediaGrid'
import { MediaList } from './MediaList'
import { MediaUploadZone } from './MediaUploadZone'
import { MediaDetailPanel } from './MediaDetailPanel'
import { MediaTagFilter } from './MediaTagFilter'
import { useMediaList, useDeleteMedia } from '../../hooks/useMedia'
import { useDebounce } from '../../hooks/useDebounce'
import { useToast } from '../../hooks/useToast'
import { sel } from '../../lib/selectors'
import type { Media, MediaListOptions } from '../../lib/media/types'

interface MediaLibraryProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (media: Media | Media[]) => void
  mode?: 'single' | 'multiple'
  allowedTypes?: ('image' | 'video')[]
  maxSelections?: number
}

type ViewMode = 'grid' | 'list'

export function MediaLibrary({
  isOpen,
  onClose,
  onSelect,
  mode = 'single',
  allowedTypes,
  maxSelections,
}: MediaLibraryProps) {
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
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([])
  const [showUploadZone, setShowUploadZone] = React.useState(false)
  const [editingMedia, setEditingMedia] = React.useState<Media | null>(null)
  const [deletingMedia, setDeletingMedia] = React.useState<Media | null>(null)

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch media
  const { data, isLoading, refetch } = useMediaList({
    limit: 100,
    offset: 0,
    orderBy: sortBy,
    orderDir: sortDir,
    type: typeFilter,
    search: debouncedSearch || undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
  })

  const items = data?.data || []

  // Reset selection when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      setSelectedTagIds([])
      setEditingMedia(null)
      setShowUploadZone(false)
    }
  }, [isOpen])

  const handleSelect = React.useCallback((media: Media) => {
    if (mode === 'single') {
      setSelectedIds(new Set([media.id]))
    } else {
      setSelectedIds((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(media.id)) {
          newSet.delete(media.id)
        } else {
          if (maxSelections && newSet.size >= maxSelections) {
            toast({
              title: t('upload.error'),
              description: t('upload.maxSelectionsReached', { maxSelections }),
              variant: 'destructive',
            })
            return prev
          }
          newSet.add(media.id)
        }
        return newSet
      })
    }
  }, [mode, maxSelections, toast, t])

  const handleConfirmSelection = () => {
    if (selectedIds.size === 0) return

    const selectedMedia = items.filter((m) => selectedIds.has(m.id))
    if (selectedMedia.length === 0) return

    if (mode === 'single') {
      onSelect?.(selectedMedia[0])
    } else {
      onSelect?.(selectedMedia)
    }

    onClose()
  }

  const handleDelete = async () => {
    if (!deletingMedia) return

    try {
      await deleteMutation.mutateAsync(deletingMedia.id)

      toast({
        title: t('delete.success'),
      })

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

  const handleUploadComplete = React.useCallback(() => {
    setShowUploadZone(false)
    refetch()
  }, [refetch])

  const handleSortChange = React.useCallback((orderBy: MediaListOptions['orderBy'], orderDir: MediaListOptions['orderDir']) => {
    setSortBy(orderBy)
    setSortDir(orderDir)
  }, [])

  const handleToggleUpload = React.useCallback(() => {
    setShowUploadZone(prev => !prev)
  }, [])

  const handleCloseDetail = React.useCallback(() => {
    setEditingMedia(null)
  }, [])

  const selectedCount = selectedIds.size
  const canSelect = selectedCount > 0

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          data-cy={sel('media.library.dialog')}
          className="sm:max-w-[90vw] lg:max-w-6xl h-[90vh] overflow-hidden flex flex-col"
          showCloseButton={false}
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle data-cy={sel('media.library.title')}>
                  {t('title')}
                </DialogTitle>
                <DialogDescription>{t('subtitle')}</DialogDescription>
              </div>
              <Button
                data-cy={sel('media.library.closeBtn')}
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={t('actions.cancel')}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Toolbar */}
            <MediaToolbar
              onUploadClick={handleToggleUpload}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* Tag filter */}
            <MediaTagFilter
              selectedTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
            />

            {/* Upload zone */}
            {showUploadZone && (
              <MediaUploadZone onUploadComplete={handleUploadComplete} />
            )}

            {/* Grid or List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={editingMedia ? 'lg:col-span-2' : 'lg:col-span-3'}>
                {viewMode === 'grid' ? (
                  <MediaGrid
                    items={items}
                    isLoading={isLoading}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onEdit={setEditingMedia}
                    onDelete={setDeletingMedia}
                    mode={mode}
                  />
                ) : (
                  <MediaList
                    items={items}
                    isLoading={isLoading}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onEdit={setEditingMedia}
                    onDelete={setDeletingMedia}
                    mode={mode}
                  />
                )}
              </div>

              {/* Detail panel */}
              {editingMedia && (
                <div className="hidden lg:block">
                  <MediaDetailPanel
                    media={editingMedia}
                    onClose={handleCloseDetail}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter data-cy={sel('media.footer.container')}>
            <div className="flex items-center justify-between w-full">
              <div data-cy={sel('media.footer.selectionCount')}>
                {selectedCount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedCount === 1
                      ? t('footer.itemsSelected', { count: selectedCount })
                      : t('footer.itemsSelectedPlural', { count: selectedCount })}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  data-cy={sel('media.footer.cancelBtn')}
                  variant="outline"
                  onClick={onClose}
                >
                  {t('footer.cancel')}
                </Button>
                <Button
                  data-cy={sel('media.footer.selectBtn')}
                  onClick={handleConfirmSelection}
                  disabled={!canSelect}
                >
                  {t('footer.select')}
                </Button>
              </div>
            </div>
          </DialogFooter>
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
    </>
  )
}
