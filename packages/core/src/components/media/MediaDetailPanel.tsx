/**
 * MediaDetailPanel Component
 *
 * Panel for editing media metadata (alt text, caption, tags).
 * Shows file info in a compact grid and provides a polished editing experience.
 * Used inside the media detail dialog (showPreview=false) or standalone.
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon, LoaderIcon, TagIcon, XIcon, PlusIcon, CopyIcon, CheckIcon, CalendarIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import { useUpdateMedia, useMediaTags, useMediaItemTags, useAddMediaTag, useRemoveMediaTag, useCreateMediaTag } from '../../hooks/useMedia'
import { useToast } from '../../hooks/useToast'
import type { Media, MediaTag } from '../../lib/media/types'

interface MediaDetailPanelProps {
  media: Media | null
  onClose?: () => void
  showPreview?: boolean
  readOnly?: boolean
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaDetailPanel({ media, onClose, showPreview = true, readOnly = false, className }: MediaDetailPanelProps) {
  const t = useTranslations('media')
  const { toast } = useToast()
  const updateMutation = useUpdateMedia()
  const addTagMutation = useAddMediaTag()
  const removeTagMutation = useRemoveMediaTag()
  const createTagMutation = useCreateMediaTag()

  const { data: allTags = [] } = useMediaTags()
  const { data: mediaTags = [] } = useMediaItemTags(media?.id || null)
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  const [title, setTitle] = useState(media?.title || '')
  const [alt, setAlt] = useState(media?.alt || '')
  const [caption, setCaption] = useState(media?.caption || '')
  const [urlCopied, setUrlCopied] = useState(false)

  // Update local state when media changes
  useEffect(() => {
    if (media) {
      setTitle(media.title || '')
      setAlt(media.alt || '')
      setCaption(media.caption || '')
    }
  }, [media])

  if (!media) return null

  const isImage = media.mimeType.startsWith('image/')
  const hasChanges = title !== (media.title || '') || alt !== (media.alt || '') || caption !== (media.caption || '')

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: media.id,
        data: {
          title: title || null,
          alt: alt || null,
          caption: caption || null,
        },
      })

      toast({
        title: t('detail.saved'),
      })

      onClose?.()
    } catch (error) {
      toast({
        title: t('upload.error'),
        description: error instanceof Error ? error.message : t('upload.error'),
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setTitle(media.title || '')
    setAlt(media.alt || '')
    setCaption(media.caption || '')
    onClose?.()
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(media.url)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  const mimeShort = media.mimeType.split('/')[1]?.toUpperCase() || media.mimeType

  return (
    <div
      data-cy={sel('media.detail.panel')}
      className={cn('flex flex-col', className)}
    >
      {/* Preview (standalone mode only) */}
      {showPreview && (
        <div className="aspect-video w-full bg-neutral-950 rounded-lg overflow-hidden flex items-center justify-center mb-4">
          {isImage ? (
            <img
              src={media.url}
              alt={media.alt || media.filename}
              className="w-full h-full object-contain"
            />
          ) : (
            <ImageIcon className="h-16 w-16 text-neutral-600" />
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* File Information - compact row */}
        <div className="px-5 py-2.5 bg-muted/30">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground truncate" title={media.filename}>
              {media.filename}
            </span>
            <span className="shrink-0">{mimeShort}</span>
            <span className="shrink-0">{formatFileSize(media.fileSize)}</span>
            {media.width && media.height && (
              <span className="shrink-0">{media.width}×{media.height}</span>
            )}
            <span className="shrink-0 flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {new Date(media.createdAt).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <code className="text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded truncate flex-1" title={media.url}>
              {media.url}
            </code>
            <button
              type="button"
              className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
              onClick={handleCopyUrl}
              aria-label={t('detail.info.url')}
            >
              {urlCopied ? (
                <CheckIcon className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Editable fields */}
        <div className="px-5 py-3 space-y-2.5">
          <div className="space-y-1">
            <Label htmlFor="media-title" className="text-xs font-medium">
              {t('detail.titleLabel')}
            </Label>
            <Input
              id="media-title"
              data-cy={sel('media.detail.titleInput')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('detail.titlePlaceholder')}
              maxLength={255}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="alt-text" className="text-xs font-medium">
              {t('detail.altLabel')}
            </Label>
            <Input
              id="alt-text"
              data-cy={sel('media.detail.altInput')}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder={t('detail.altPlaceholder')}
              maxLength={500}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="caption" className="text-xs font-medium">
              {t('detail.captionLabel')}
            </Label>
            <Textarea
              id="caption"
              data-cy={sel('media.detail.captionInput')}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('detail.captionPlaceholder')}
              maxLength={1000}
              rows={2}
              className="resize-none"
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Tags */}
        <div className="px-5 py-2.5 border-t" data-cy={sel('media.detail.tags')}>
          <Label className="flex items-center gap-1.5 text-xs font-medium mb-2">
            <TagIcon className="h-3 w-3" />
            {t('tags.title')}
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {mediaTags.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t('tags.empty')}</p>
            ) : (
              mediaTags.map((tag: MediaTag) => (
                <Badge
                  key={tag.id}
                  data-cy={sel('media.detail.tagBadge', { id: tag.id })}
                  variant="secondary"
                  className={cn('gap-1 text-xs', readOnly ? '' : 'pr-1')}
                  style={tag.color ? { borderColor: tag.color, borderLeftWidth: 3 } : undefined}
                >
                  {tag.name}
                  {!readOnly && (
                    <button
                      type="button"
                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={() => {
                        removeTagMutation.mutate({ mediaId: media.id, tagId: tag.id })
                      }}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))
            )}

            {/* Add tag button */}
            {!readOnly && <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  data-cy={sel('media.detail.addTagBtn')}
                  variant="outline"
                  size="sm"
                  className="h-[22px] px-2 text-xs gap-1 border-dashed"
                >
                  <PlusIcon className="h-3 w-3" />
                  {t('tags.add')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3" align="start">
                <div className="space-y-2">
                  {/* Existing tags to add */}
                  <div className="flex flex-wrap gap-1">
                    {allTags
                      .filter((tag: MediaTag) => !mediaTags.some((mt: MediaTag) => mt.id === tag.id))
                      .map((tag: MediaTag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="cursor-pointer text-xs hover:bg-secondary"
                          style={tag.color ? { borderColor: tag.color } : undefined}
                          onClick={() => {
                            addTagMutation.mutate({ mediaId: media.id, tagId: tag.id })
                            setTagPopoverOpen(false)
                          }}
                        >
                          {tag.name}
                        </Badge>
                      ))
                    }
                    {allTags.filter((tag: MediaTag) => !mediaTags.some((mt: MediaTag) => mt.id === tag.id)).length === 0 && (
                      <p className="text-xs text-muted-foreground p-1">{t('dashboard.noTags')}</p>
                    )}
                  </div>

                  {/* Create new tag */}
                  <div className="flex gap-1 pt-2 border-t">
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder={t('tags.createPlaceholder')}
                      className="h-7 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagName.trim()) {
                          e.preventDefault()
                          createTagMutation.mutate(newTagName.trim(), {
                            onSuccess: (tag) => {
                              if (tag?.id) {
                                addTagMutation.mutate({ mediaId: media.id, tagId: tag.id })
                              }
                              setNewTagName('')
                              setTagPopoverOpen(false)
                            },
                          })
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 shrink-0"
                      disabled={!newTagName.trim() || createTagMutation.isPending}
                      onClick={() => {
                        if (newTagName.trim()) {
                          createTagMutation.mutate(newTagName.trim(), {
                            onSuccess: (tag) => {
                              if (tag?.id) {
                                addTagMutation.mutate({ mediaId: media.id, tagId: tag.id })
                              }
                              setNewTagName('')
                              setTagPopoverOpen(false)
                            },
                          })
                        }
                      }}
                    >
                      <PlusIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>}
          </div>
        </div>
      </div>

      {/* Sticky action footer */}
      <div className="px-5 py-2.5 border-t bg-muted/20 shrink-0 flex items-center justify-end gap-2">
        {readOnly ? (
          <Button
            data-cy={sel('media.detail.cancelBtn')}
            onClick={onClose}
            variant="ghost"
            size="sm"
          >
            {t('detail.cancel')}
          </Button>
        ) : (
          <>
            <Button
              data-cy={sel('media.detail.cancelBtn')}
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              disabled={updateMutation.isPending}
            >
              {t('detail.cancel')}
            </Button>
            <Button
              data-cy={sel('media.detail.saveBtn')}
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              size="sm"
            >
              {updateMutation.isPending && (
                <LoaderIcon className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              {updateMutation.isPending ? t('detail.saving') : t('detail.save')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
