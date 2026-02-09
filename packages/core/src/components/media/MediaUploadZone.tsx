/**
 * MediaUploadZone Component
 *
 * Drag-and-drop file upload area with progress indicators.
 * Uses useMediaUpload hook for upload mutations.
 *
 * Performance: Uses ref-based drag counter to avoid excessive setState
 * on dragEnter/dragLeave events from nested elements.
 */

'use client'

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { UploadCloudIcon, LoaderIcon, CheckCircle2Icon, XCircleIcon, AlertTriangleIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { Alert, AlertDescription } from '../ui/alert'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import { useMediaUpload } from '../../hooks/useMediaUpload'
import { useToast } from '../../hooks/useToast'
import type { Media } from '../../lib/media/types'

interface DuplicateInfo {
  filename: string
  fileSize: number
  existing: { id: string; url: string; createdAt: string }[]
}

interface MediaUploadZoneProps {
  onUploadComplete?: (uploadedMedia: Media[]) => void
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
  const [isDragging, setIsDragging] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const uploadMutation = useMediaUpload()

  const checkForDuplicates = async (files: File[]): Promise<DuplicateInfo[]> => {
    try {
      const res = await fetch('/api/v1/media/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map(f => ({ filename: f.name, fileSize: f.size })),
        }),
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.data?.duplicates || []
    } catch {
      return [] // On error, allow upload
    }
  }

  const doUpload = async (files: File[]) => {
    try {
      const result = await uploadMutation.mutateAsync(files)

      toast({
        title: t('upload.success'),
        description: files.length === 1
          ? t('upload.success')
          : t('upload.successMultiple', { count: files.length }),
      })

      onUploadComplete?.(result.media || [])
    } catch (error) {
      toast({
        title: t('upload.error'),
        description: error instanceof Error ? error.message : t('upload.error'),
        variant: 'destructive',
      })
    }
  }

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

    // Check for duplicates
    setIsChecking(true)
    const dupes = await checkForDuplicates(fileArray)
    setIsChecking(false)

    if (dupes.length > 0) {
      // Show duplicate warning, let user decide
      setDuplicates(dupes)
      setPendingFiles(fileArray)
      return
    }

    // No duplicates, upload directly
    await doUpload(fileArray)
  }

  const handleUploadAll = async () => {
    if (!pendingFiles) return
    setDuplicates([])
    const files = pendingFiles
    setPendingFiles(null)
    await doUpload(files)
  }

  const handleSkipDuplicates = async () => {
    if (!pendingFiles) return
    const dupeNames = new Set(duplicates.map(d => `${d.filename}:${d.fileSize}`))
    const nonDuplicates = pendingFiles.filter(f => !dupeNames.has(`${f.name}:${f.size}`))
    setDuplicates([])
    setPendingFiles(null)

    if (nonDuplicates.length > 0) {
      await doUpload(nonDuplicates)
    } else {
      toast({ title: t('upload.error'), description: t('upload.duplicateFound', { count: duplicates.length }) })
    }
  }

  const handleDismissDuplicates = () => {
    setDuplicates([])
    setPendingFiles(null)
  }

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    await handleFiles(e.dataTransfer.files)
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const isBusy = uploadMutation.isPending || isChecking

  return (
    <div className={cn('w-full space-y-3', className)}>
      {/* Duplicate warning */}
      {duplicates.length > 0 && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 [&>svg]:text-amber-600">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                {t('upload.duplicateFound', { count: duplicates.length })}
              </p>
              <p className="text-xs mt-0.5 opacity-80">
                {duplicates.map(d => d.filename).join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/50 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={handleSkipDuplicates}
              >
                {t('upload.duplicateSkip')}
              </Button>
              <Button
                size="sm"
                onClick={handleUploadAll}
              >
                {t('upload.duplicateUploadAll')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismissDuplicates}
              >
                <XCircleIcon className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div
        data-cy={sel('media.upload.dropzone')}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          isBusy && 'opacity-50 pointer-events-none'
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {(uploadMutation.isPending || isChecking) ? (
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
