/**
 * @jest-environment jsdom
 */
// #361: with a private bucket the screens that render a stored URL (entity image and video fields, the
// block editor preview) show a signed one; the stored value is never replaced, and with the mode off
// nothing is asked and nothing changes.
import * as React from 'react'
import { render, renderHook, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDisplayUrls, useSignedProps } from '@/core/hooks/useDisplayUrls'
import { ImageUpload } from '@/core/components/ui/image-upload'
import { VideoUpload } from '@/core/components/ui/video-upload'
import { ArrayField } from '@/core/components/dashboard/block-editor/array-field'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }) }))
// eslint-disable-next-line @next/next/no-img-element
jest.mock('next/image', () => ({ __esModule: true, default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
jest.mock('@/core/components/ui/rich-text-editor', () => ({ RichTextEditor: () => null }))
jest.mock('@/core/components/media/MediaLibrary', () => ({ MediaLibrary: () => null }))

const stored = 'https://s3.example.org/shared/uploads/1700000000000_0123456789abcdef0123456789abcdef.png'
const thumb = 'https://s3.example.org/shared/uploads/1700000000001_0123456789abcdef0123456789abcdef.png'
const video = 'https://s3.example.org/shared/uploads/1700000000002_0123456789abcdef0123456789abcdef.mp4'
const external = 'https://elsewhere.example.org/photo.png'
const signedOf = (url: string) => `${url}?X-Amz-Signature=abc`

const fetchMock = jest.fn()
function serve({ privateReads, status = 200 }: { privateReads: boolean; status?: number }) {
  fetchMock.mockImplementation(async (input: string, init?: { body?: string }) => {
    if (String(input).endsWith('/api/v1/media/upload')) return { ok: true, json: async () => ({ data: { directUpload: false, privateReads } }) }
    if (String(input).endsWith('/api/v1/media/sign')) {
      if (status !== 200) return { ok: false, status, json: async () => ({}) }
      const urls: string[] = JSON.parse(init!.body!).urls
      // the server signs only its own files: the external one is left out
      return { ok: true, json: async () => ({ data: { signed: Object.fromEntries(urls.filter(u => u.includes('s3.example.org')).map(u => [u, signedOf(u)])) } }) }
    }
    throw new Error(`unexpected request ${input}`)
  })
}
const signCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/v1/media/sign'))

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('useDisplayUrls', () => {
  it('returns the stored URL and makes no signing request with the mode off', async () => {
    serve({ privateReads: false })
    const { result } = renderHook(() => useDisplayUrls([stored]), { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current(stored)).toBe(stored)
    expect(signCalls()).toHaveLength(0)
  })

  it('swaps the stored URL for the signed one with the mode on, and passes any other through', async () => {
    serve({ privateReads: true })
    const { result } = renderHook(() => useDisplayUrls([stored, external]), { wrapper })
    expect(result.current(stored)).toBe(stored)
    await waitFor(() => expect(result.current(stored)).toBe(signedOf(stored)))
    expect(result.current(external)).toBe(external)
    expect(result.current(undefined)).toBeUndefined()
    // one request for the set, carrying the stored URLs and nothing else
    expect(signCalls()).toHaveLength(1)
    expect(JSON.parse(signCalls()[0][1].body)).toEqual({ urls: [external, stored].sort() })
  })

  it('keeps the stored URL when signing fails', async () => {
    serve({ privateReads: true, status: 500 })
    const { result } = renderHook(() => useDisplayUrls([stored]), { wrapper })
    await waitFor(() => expect(signCalls()).toHaveLength(1))
    await act(async () => { await Promise.resolve() })
    expect(result.current(stored)).toBe(stored)
  })
})

describe('useSignedProps', () => {
  it('signs URLs at any depth of block props without touching the original', async () => {
    serve({ privateReads: true })
    const props = { image: { mediaId: 'm1', url: stored }, items: [{ src: thumb }], title: 'x' }
    const { result } = renderHook(() => useSignedProps(props), { wrapper })
    await waitFor(() => expect(result.current.image.url).toBe(signedOf(stored)))
    expect(result.current.items[0].src).toBe(signedOf(thumb))
    expect(result.current.title).toBe('x')
    expect(props.image.url).toBe(stored)
  })

  it('is the same object with the mode off', async () => {
    serve({ privateReads: false })
    const props = { image: stored }
    const { result } = renderHook(() => useSignedProps(props), { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current).toBe(props)
  })
})

describe('the field components', () => {
  const images = [{ id: 'm1', name: 'a.png', size: 3, url: stored }]
  const srcs = () => Array.from(document.querySelectorAll('img')).map(img => img.getAttribute('src'))

  it('ImageUpload shows the signed URL and still holds the stored one', async () => {
    serve({ privateReads: true })
    render(<ImageUpload value={images} onChange={jest.fn()} />, { wrapper })
    await waitFor(() => expect(srcs()).toContain(signedOf(stored)))
    expect(images[0].url).toBe(stored)
  })

  it('ImageUpload renders the stored URL as before with the mode off', async () => {
    serve({ privateReads: false })
    render(<ImageUpload value={images} onChange={jest.fn()} />, { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(srcs()).toEqual([stored])
    expect(signCalls()).toHaveLength(0)
  })

  it('VideoUpload opens the signed video URL and shows the signed thumbnail', async () => {
    serve({ privateReads: true })
    const open = jest.spyOn(window, 'open').mockImplementation(() => null)
    const onChange = jest.fn()
    render(<VideoUpload value={[{ id: 'v1', name: 'a.mp4', size: 3, url: video, thumbnail: thumb }]} onChange={onChange} />, { wrapper })
    await waitFor(() => expect(srcs()).toContain(signedOf(thumb)))
    screen.getAllByRole('button')[0].click()
    expect(open).toHaveBeenCalledWith(signedOf(video), '_blank')
    expect(onChange).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it('the block editor array field previews the signed URL and emits the stored one', async () => {
    serve({ privateReads: true })
    const onChange = jest.fn()
    render(
      <ArrayField
        field={{ name: 'items', type: 'array', label: 'Items', itemFields: [{ name: 'image', type: 'media-library', label: 'Image' }] } as never}
        value={[{ image: stored }]}
        onChange={onChange}
      />,
      { wrapper }
    )
    await waitFor(() => expect(srcs()).toContain(signedOf(stored)))
    expect(onChange).not.toHaveBeenCalled()
  })
})
