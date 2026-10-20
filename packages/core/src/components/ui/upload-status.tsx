"use client"

import { X } from "lucide-react"
import { useTranslations } from 'next-intl'
import { Button } from './button'
import { Progress } from './progress'
import type { PendingUpload } from '../../hooks/useFieldUpload'

interface UploadStatusProps {
  pending: PendingUpload[]
  error: string | null
  onCancel: (id: string) => void
}

/** Uploads in flight (progress, cancel) and the error of the last upload, for the entity upload fields. */
export function UploadStatus({ pending, error, onCancel }: UploadStatusProps) {
  const t = useTranslations('media')
  if (pending.length === 0 && !error) return null

  return (
    <div className="space-y-2">
      {pending.map((upload) => (
        <div key={upload.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{upload.name}</p>
            <Progress value={upload.progress} className="mt-2" aria-label={t('upload.uploadingName', { name: upload.name })} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('upload.cancelUpload', { name: upload.name })}
            onClick={(e) => {
              e.stopPropagation()
              onCancel(upload.id)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
