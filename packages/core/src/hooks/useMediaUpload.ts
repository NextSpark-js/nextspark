/**
 * Media Upload Hook
 *
 * TanStack Query mutation for uploading files to the media library.
 * Uses the direct upload flow (presign, PUT to the storage, confirm) when the active
 * storage driver supports it, and the enhanced upload endpoint otherwise.
 */

'use client'

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { Media } from '../lib/media/types'
import { withBasePath } from '../lib/base-path'
import { MAX_MEDIA_BATCH } from '../lib/media/schemas'

/** next-intl's translator for the `media` namespace */
type Translate = (key: string, values?: Record<string, string | number>) => string

interface UploadResult {
  urls: string[]
  media: Media[]
  count: number
  storage: string
}

/** What `GET /api/v1/media/upload` answers about the active storage driver. */
export interface UploadCapabilities {
  directUpload: boolean
  storage?: string
  supportedTypes?: string[]
  /** e.g. "10MB" */
  maxFileSize?: string
  maxImageSize?: string
  maxVideoSize?: string
}

/** Variables of the mutation: the files, or the files plus progress reporting and cancellation. */
export interface MediaUploadRequest {
  files: File[]
  /** Fraction of the bytes sent, 0 to 1. Intermediate values only on the direct path (a `fetch` body reports none). */
  onProgress?: (fraction: number) => void
  /** Aborting it cancels the presign and the PUT; once the PUT is done the confirm runs to completion. The mutation rejects with an `AbortError`. */
  signal?: AbortSignal
}

const CAPABILITIES_KEY = ['media', 'upload-capabilities']

/** Asked once per QueryClient. null (no answer, e.g. no `media.read`) means the server upload, which checks everything itself. */
async function loadCapabilities(queryClient: QueryClient): Promise<UploadCapabilities | null> {
  try {
    return await queryClient.fetchQuery({
      queryKey: CAPABILITIES_KEY,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      queryFn: async () => {
        const res = await fetch(withBasePath('/api/v1/media/upload'))
        if (!res.ok) throw new Error(`Upload capabilities failed with status ${res.status}`)
        return (await res.json()).data as UploadCapabilities
      },
    })
  } catch {
    return null
  }
}

const megabytes = (value?: string) => (value ? parseFloat(value) : undefined)

/** The server's size and type rules, applied before any byte is sent (both paths). */
function checkFile(file: File, caps: UploadCapabilities | null, t: Translate) {
  if (!caps) return
  if (caps.supportedTypes && !caps.supportedTypes.includes(file.type)) {
    throw new Error(t('upload.typeNotAllowed', { type: file.type || 'unknown' }))
  }
  const limit =
    (file.type.startsWith('image/') ? megabytes(caps.maxImageSize) : undefined) ??
    (file.type.startsWith('video/') ? megabytes(caps.maxVideoSize) : undefined) ??
    megabytes(caps.maxFileSize)
  if (limit != null && file.size > limit * 1024 * 1024) {
    throw new Error(t('upload.tooLargeNamed', { name: file.name, max: limit }))
  }
}

async function postJson<T>(path: string, body: unknown, failed: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(withBasePath(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: `${failed} (${res.status})` }))
    throw new Error(errorData.error || failed)
  }
  return (await res.json()).data as T
}

const FORBIDDEN_HEADERS = ['content-length', 'host']

/** PUT of the file to the presigned URL. XHR, because `fetch` reports no upload progress. */
function putToStorage(
  target: { url: string; method?: string; headers?: Record<string, string> },
  file: File,
  onProgress: (loaded: number) => void,
  t: Translate,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancelled = () => new DOMException(t('upload.cancelled'), 'AbortError')
    if (signal?.aborted) return reject(cancelled())
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', target.url) // the presign route only issues PUT URLs
    for (const [name, value] of Object.entries(target.headers ?? {})) {
      if (!FORBIDDEN_HEADERS.includes(name.toLowerCase())) xhr.setRequestHeader(name, value)
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(t('upload.storageFailedStatus', { status: xhr.status })))
    xhr.onerror = () => reject(new Error(t('upload.storageFailed')))
    xhr.onabort = () => reject(cancelled())
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

/** Direct upload (S3): presign, PUT to the storage, confirm. The file never reaches the app server. */
async function uploadDirect(files: File[], { onProgress, signal }: MediaUploadRequest, t: Translate, storage?: string): Promise<UploadResult> {
  const total = files.reduce((sum, file) => sum + file.size, 0) || 1
  let sent = 0
  const media: Media[] = []
  onProgress?.(0)
  for (const file of files) {
    signal?.throwIfAborted()
    const { upload, token } = await postJson<{
      upload: { url: string; method?: string; headers?: Record<string, string> }
      token: string
    }>('/api/v1/media/upload/presign', { filename: file.name, mimeType: file.type, size: file.size }, t('upload.failed'), signal)
    // A failed PUT stops here: no confirm, so no record (the unconfirmed object expires with the bucket's lifecycle rule)
    await putToStorage(upload, file, (loaded) => onProgress?.((sent + loaded) / total), t, signal)
    sent += file.size
    // The confirm is not cancellable: once the bytes are stored, finishing it is what keeps them from being orphaned.
    // A rejected confirm leaves no record: the server discards the object it refused.
    const confirmed = await postJson<{ media: Media }>('/api/v1/media/upload/confirm', { token }, t('upload.failed'))
    media.push(confirmed.media)
    onProgress?.(sent / total)
  }
  return { urls: media.map((m) => m.url), media, count: media.length, storage: storage ?? 's3' }
}

/** Server upload (local, Vercel Blob): one multipart POST to /api/v1/media/upload. */
async function uploadThroughServer(files: File[], { onProgress, signal }: MediaUploadRequest, t: Translate): Promise<UploadResult> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  onProgress?.(0)

  const res = await fetch(withBasePath('/api/v1/media/upload'), {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({
      error: `${t('upload.failed')} (${res.status})`
    }))
    throw new Error(errorData.error || t('upload.failed'))
  }

  const json = await res.json()
  onProgress?.(1)
  return json.data
}

/**
 * Upload files to media library
 *
 * Returns a mutation that accepts File[] (or { files, onProgress, signal }). It asks
 * GET /api/v1/media/upload once per QueryClient which driver is active: with direct upload (s3)
 * each file goes presign -> PUT to the storage -> confirm; otherwise the files are posted to
 * /api/v1/media/upload, which creates the database records and returns the full media objects.
 * The server's type and size limits are checked before sending, on both paths.
 */
export function useMediaUpload() {
  const queryClient = useQueryClient()
  const t = useTranslations('media') as Translate

  return useMutation({
    mutationFn: async (input: File[] | MediaUploadRequest): Promise<UploadResult> => {
      const request = Array.isArray(input) ? { files: input } : input
      const { files } = request
      if (!files || files.length === 0) {
        throw new Error('No files provided')
      }

      // Same limit as POST /api/v1/media/upload, whichever path the files take
      if (files.length > MAX_MEDIA_BATCH) {
        throw new Error(t('upload.tooManyFiles', { max: MAX_MEDIA_BATCH }))
      }

      const caps = await loadCapabilities(queryClient)
      files.forEach((file) => checkFile(file, caps, t))

      return caps?.directUpload ? uploadDirect(files, request, t, caps.storage) : uploadThroughServer(files, request, t)
    },
    onSuccess: () => {
      // Invalidate media list queries to show new uploads
      queryClient.invalidateQueries({ queryKey: ['media', 'list'] })
    },
  })
}

/**
 * Hook for tracking upload progress (client-side state)
 * Superseded by the `onProgress` option of `useMediaUpload` - kept for compatibility.
 */
export function useUploadProgress() {
  return null
}
