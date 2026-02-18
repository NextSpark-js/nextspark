'use client'

import { useState, useEffect } from 'react'
import type { PreviewError } from '@/lib/types'

/**
 * Poll the preview server for compilation errors.
 * Returns an empty array when no slug is provided or no errors exist.
 */
export function usePreviewErrors(slug: string | null): PreviewError[] {
  const [errors, setErrors] = useState<PreviewError[]>([])

  useEffect(() => {
    if (!slug) {
      setErrors([])
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/preview/errors?slug=${encodeURIComponent(slug)}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setErrors(data.errors || [])
        }
      } catch {
        // Network error — skip this poll cycle
      }
    }

    poll()
    const interval = setInterval(poll, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [slug])

  return errors
}
