/**
 * MediaDetailPanel Component
 *
 * Side panel for editing media metadata (alt text and caption).
 * Shows preview and file information.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon, LoaderIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import { useUpdateMedia } from '../../hooks/useMedia'
import { useToast } from '../../hooks/useToast'
import type { Media } from '../../lib/media/types'

interface MediaDetailPanelProps {
  media: Media | null
  onClose?: () => void
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaDetailPanel({ media, onClose, className }: MediaDetailPanelProps) {
  const t = useTranslations('media')
  const { toast } = useToast()
  const updateMutation = useUpdateMedia()

  const [alt, setAlt] = React.useState(media?.alt || '')
  const [caption, setCaption] = React.useState(media?.caption || '')

  // Update local state when media changes
  React.useEffect(() => {
    if (media) {
      setAlt(media.alt || '')
      setCaption(media.caption || '')
    }
  }, [media])

  if (!media) return null

  const isImage = media.mimeType.startsWith('image/')
  const hasChanges = alt !== (media.alt || '') || caption !== (media.caption || '')

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: media.id,
        data: {
          alt: alt || null,
          caption: caption || null,
        },
      })

      toast({
        title: t('detail.saved'),
        description: t('detail.saved'),
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
    setAlt(media.alt || '')
    setCaption(media.caption || '')
    onClose?.()
  }

  return (
    <div
      data-cy={sel('media.detail.panel')}
      className={cn('flex flex-col gap-4', className)}
    >
      {/* Preview */}
      <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center">
        {isImage ? (
          <img
            src={media.url}
            alt={media.alt || media.filename}
            className="w-full h-full object-contain"
          />
        ) : (
          <ImageIcon className="h-16 w-16 text-muted-foreground" />
        )}
      </div>

      {/* File info */}
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">{t('detail.info.filename')}:</span>{' '}
          <span className="text-muted-foreground">{media.filename}</span>
        </div>
        <div>
          <span className="font-medium">{t('detail.info.fileSize')}:</span>{' '}
          <span className="text-muted-foreground">{formatFileSize(media.fileSize)}</span>
        </div>
        <div>
          <span className="font-medium">{t('detail.info.mimeType')}:</span>{' '}
          <span className="text-muted-foreground">{media.mimeType}</span>
        </div>
        {media.width && media.height && (
          <div>
            <span className="font-medium">{t('detail.info.dimensions')}:</span>{' '}
            <span className="text-muted-foreground">
              {media.width} × {media.height}
            </span>
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="alt-text">{t('detail.altLabel')}</Label>
          <Input
            id="alt-text"
            data-cy={sel('media.detail.altInput')}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder={t('detail.altPlaceholder')}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            {t('detail.altDescription')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="caption">{t('detail.captionLabel')}</Label>
          <Textarea
            id="caption"
            data-cy={sel('media.detail.captionInput')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t('detail.captionPlaceholder')}
            maxLength={1000}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {t('detail.captionDescription')}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          data-cy={sel('media.detail.saveBtn')}
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className="flex-1"
        >
          {updateMutation.isPending && (
            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
          )}
          {updateMutation.isPending ? t('detail.saving') : t('detail.save')}
        </Button>
        <Button
          data-cy={sel('media.detail.cancelBtn')}
          onClick={handleCancel}
          variant="outline"
          disabled={updateMutation.isPending}
        >
          {t('detail.cancel')}
        </Button>
      </div>
    </div>
  )
}
