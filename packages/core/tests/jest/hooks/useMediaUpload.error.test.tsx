import { describe, expect, it, jest } from '@jest/globals'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMediaUpload } from '../../../src/hooks/useMediaUpload'

describe('useMediaUpload', () => {
  it('surfaces the upload error message (MediaUploadZone shows it in a toast)', async () => {
    const message = 'Media storage is not configured: set BLOB_READ_WRITE_TOKEN'
    global.fetch = jest.fn().mockResolvedValue(
      Response.json({ success: false, error: message, code: 'STORAGE_NOT_CONFIGURED' }, { status: 503 })
    ) as never
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useMediaUpload(), { wrapper })

    result.current.mutate([new File(['x'], 'x.png', { type: 'image/png' })])

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe(message)
  })
})
