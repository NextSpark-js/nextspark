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
import { useMediaUpload } from './useMediaUpload'

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
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [error, setError] = useState<string | null>(null)
  const controllers = useRef(new Map<string, AbortController>())

  // Leaving the form cancels what is still in flight
  useEffect(() => {
    const active = controllers.current
    return () => active.forEach((controller) => controller.abort())
  }, [])

  const cancel = (id: string) => controllers.current.get(id)?.abort()

  /**
   * Uploads the files; `rejected` are messages for files the caller already refused (limits).
   * Resolves with the files that were stored. The error state holds the rejections and failures.
   */
  const uploadFiles = async (files: File[], rejected: string[] = []): Promise<FieldUploadResult[]> => {
    const failures = [...rejected]
    const stored: FieldUploadResult[] = []
    setError(failures.length > 0 ? failures.join(' ') : null)

    for (const file of files) {
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
        if (!url) throw new Error('The upload returned no file')
        stored.push({ file, id: media?.id ?? url, url })
      } catch (uploadError) {
        // A cancelled upload is the user's choice, not an error to show
        if (!controller.signal.aborted) {
          failures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : 'Upload failed'}`)
        }
      } finally {
        controllers.current.delete(id)
        setPending((list) => list.filter((entry) => entry.id !== id))
      }
    }

    setError(failures.length > 0 ? failures.join(' ') : null)
    return stored
  }

  return { pending, error, uploadFiles, cancel }
}
