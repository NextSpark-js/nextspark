/**
 * MediaUploadZone Component
 *
 * Drag-and-drop file upload area with progress indicators.
 * Uses useMediaUpload hook for upload mutations.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { UploadCloudIcon, LoaderIcon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import { useMediaUpload } from '../../hooks/useMediaUpload'
import { useToast } from '../../hooks/useToast'

interface MediaUploadZoneProps {
  onUploadComplete?: () => void
  maxSizeMB?: number
  acceptedTypes?: string[]
  className?: string
}

export function MediaUploadZone({
  onUploadComplete,
  maxSizeMB = 10,
  acceptedTypes = ['image/*', 'video/*'],
  className,
}: MediaUploadZoneProps) {
  const t = useTranslations('media')
  const { toast } = useToast()
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const uploadMutation = useMediaUpload()

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)

    // Validate file sizes
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    const oversizedFiles = fileArray.filter(f => f.size > maxSizeBytes)
    if (oversizedFiles.length > 0) {
      toast({
        title: t('upload.error'),
        description: t('upload.tooLarge'),
        variant: 'destructive',
      })
      return
    }

    try {
      await uploadMutation.mutateAsync(fileArray)

      toast({
        title: t('upload.success'),
        description: fileArray.length === 1
          ? t('upload.success')
          : t('upload.successMultiple', { count: fileArray.length }),
      })

      onUploadComplete?.()
    } catch (error) {
      toast({
        title: t('upload.error'),
        description: error instanceof Error ? error.message : t('upload.error'),
        variant: 'destructive',
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        data-cy={sel('media.upload.dropzone')}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          uploadMutation.isPending && 'opacity-50 pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-4">
            <LoaderIcon className="h-12 w-12 animate-spin text-primary" />
            <div className="w-full max-w-xs">
              <p className="text-sm text-muted-foreground mb-2">
                {t('upload.uploading')}
              </p>
              <Progress
                data-cy={sel('media.upload.progressBar')}
                value={undefined}
                className="w-full"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <UploadCloudIcon className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">
                {t('upload.dragDrop')}{' '}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-primary"
                  onClick={handleBrowseClick}
                >
                  {t('upload.browse')}
                </Button>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('upload.maxSize', { maxSize: maxSizeMB })}
              </p>
            </div>
          </div>
        )}

        <input
          data-cy={sel('media.upload.fileInput')}
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          aria-label={t('toolbar.upload')}
        />
      </div>
    </div>
  )
}
