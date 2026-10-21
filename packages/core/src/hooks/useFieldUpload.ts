/**
 * Field Upload Hook
 *
 * What the entity upload fields (file, image, video, audio) share: upload each file through
 * `useMediaUpload`, one at a time, keeping the pending entries (with progress and a way to
 * cancel them) and the error to show. A file that fails is not returned, so the caller never
 * stores anything for it.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMediaUpload } from './useMediaUpload'

/** How long a video or audio file may take to report its metadata before it uploads without a thumbnail or duration. */
export const MEDIA_PROBE_TIMEOUT_MS = 10_000

export interface PendingUpload {
  id: string
  name: string
  /** 0 to 100 */
  progress: number
}

export interface FieldUploadResult {
  file: File
  /** Media id returned by the API (the URL when the API sends no record). */
  id: string
  /** URL returned by the API, never a blob: URL. */
  url: string
}

/** Whether a file fits an `accept`-style list: "image/*", "image/png" or ".pdf"; "*" or an empty list takes everything. */
export function matchesAcceptedType(file: File, acceptedTypes?: string[]): boolean {
  if (!acceptedTypes || acceptedTypes.length === 0 || acceptedTypes.includes('*')) return true
  const extension = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
  return acceptedTypes.some(
    (type) =>
      type === file.type ||
      type.toLowerCase() === extension ||
      (type.endsWith('/*') && file.type.startsWith(type.slice(0, -1)))
  )
}

export function useFieldUpload() {
  const upload = useMediaUpload()
  const t = useTranslations('media')
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [error, setError] = useState<string | null>(null)
  const controllers = useRef(new Map<string, AbortController>())
  const unmounted = useRef(false)
  // Slots of the field's maximum taken by files chosen and not yet settled (being checked, queued or uploading)
  const reserved = useRef(0)

  // Leaving the form cancels what is in flight and stops the files still waiting in a batch
  useEffect(() => {
    const active = controllers.current
    unmounted.current = false
    return () => {
      unmounted.current = true
      active.forEach((controller) => controller.abort())
    }
  }, [])

  const cancel = (id: string) => controllers.current.get(id)?.abort()

  /**
   * Uploads the files, whose slots the caller took with `claim`; `rejected` are messages for files already refused (limits).
   * Resolves with the files that were stored. The error state holds the rejections and failures.
   */
  const uploadFiles = async (files: File[], rejected: string[] = []): Promise<FieldUploadResult[]> => {
    const failures = [...rejected]
    const stored: FieldUploadResult[] = []
    setError(failures.length > 0 ? failures.join(' ') : null)
    for (const file of files) {
      if (unmounted.current) break
      const id = `${Date.now()}-${Math.random()}`
      const controller = new AbortController()
      controllers.current.set(id, controller)
      setPending((list) => [...list, { id, name: file.name, progress: 0 }])
      try {
        const result = await upload.mutateAsync({
          files: [file],
          signal: controller.signal,
          onProgress: (fraction) =>
            setPending((list) => list.map((entry) => (entry.id === id ? { ...entry, progress: Math.round(fraction * 100) } : entry))),
        })
        const media = result.media?.[0]
        const url = media?.url ?? result.urls?.[0]
        if (!url) throw new Error(t('upload.noFileReturned'))
        stored.push({ file, id: media?.id ?? url, url })
      } catch (uploadError) {
        // A cancelled upload is the user's choice, not an error to show
        if (!controller.signal.aborted) {
          failures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : t('upload.failed')}`)
        }
      } finally {
        controllers.current.delete(id)
        setPending((list) => list.filter((entry) => entry.id !== id))
      }
    }

    // The slots go back when the batch ends: the caller adds the stored files to the value right after
    reserved.current -= files.length
    // Nothing is reported to a form that is gone
    if (unmounted.current) return []
    setError(failures.length > 0 ? failures.join(' ') : null)
    return stored
  }

  /**
   * Takes slots for the files just chosen, before anything is awaited, so a second pick sees them.
   * Returns how many of `requested` fit under `max` given the `current` value length; each slot is
   * given back by `release` (a file refused by validation) or by the end of its upload.
   */
  const claim = (requested: number, max: number, current: number): number => {
    const granted = Math.max(0, Math.min(requested, max - current - reserved.current))
    reserved.current += granted
    return granted
  }
  const release = (count = 1) => { reserved.current -= count }

  /** Message for a file outside the field's `acceptedTypes`. */
  const typeNotAccepted = (acceptedTypes: string[] = []) => t('upload.typeNotAccepted', { types: acceptedTypes.join(', ') })

  return { pending, error, uploadFiles, cancel, claim, release, typeNotAccepted }
}
