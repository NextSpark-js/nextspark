/**
 * @jest-environment jsdom
 *
 * The file, image, video and audio fields upload through useMediaUpload: the value holds what the
 * API returned, limits come from the field config, and a failed or refused file leaves nothing (never a blob: URL).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mutateAsync = jest.fn<(input: { files: File[]; signal?: AbortSignal; onProgress?: (f: number) => void }) => Promise<unknown>>()
jest.mock('@/core/hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({ mutateAsync }),
}))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }) }))
jest.mock('next-intl', () => {
  // the real English messages, so the assertions read what a user would
  const media = require('../../../../src/messages/en/media.json')
  return {
    useTranslations: () => (key: string, values: Record<string, unknown> = {}) =>
      (key.split('.').reduce((node: any, part) => node[part], media) as string).replace(/\{(\w+)\}/g, (_, name) => String(values[name])),
  }
})
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

import { EntityFieldRenderer } from '@/core/components/entities/EntityFieldRenderer'
import type { EntityField } from '@/core/lib/entities/types'

const field = (type: string, extra: Partial<EntityField> = {}) =>
  ({ name: 'attachment', type, required: false, display: { label: 'Attachment', showInForm: true }, api: {}, ...extra }) as unknown as EntityField

const file = (name: string, type: string, bytes = 8) => new File([new Uint8Array(bytes)], name, { type })
const MB = 1024 * 1024

const CASES = [
  { type: 'file', file: () => file('doc.pdf', 'application/pdf') },
  { type: 'image', file: () => file('pic.png', 'image/png') },
  { type: 'video', file: () => file('clip.mp4', 'video/mp4') },
  { type: 'audio', file: () => file('song.mp3', 'audio/mpeg') },
] as const

function setup(f: EntityField, value: unknown = []) {
  const onChange = jest.fn()
  const view = render(<EntityFieldRenderer field={f} value={value} onChange={onChange} mode="form" />)
  const choose = (...files: File[]) => {
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    return act(async () => { fireEvent.change(input, { target: { files } }) })
  }
  return { onChange, choose, unmount: view.unmount, input: () => view.container.querySelector('input[type="file"]') as HTMLInputElement }
}

const stored = (id: string, url: string) => ({ urls: [url], media: [{ id, url }], count: 1, storage: 'local' })

beforeEach(() => {
  mutateAsync.mockReset()
  // jsdom loads no media: answer the component's local checks (image load, video thumbnail, audio duration)
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    set() { setTimeout(() => (this as HTMLImageElement).onload?.(new Event('load')), 0) },
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    set() { setTimeout(() => (this as HTMLMediaElement).onerror?.(new Event('error')), 0) },
  })
  global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/local-only')
})

describe.each(CASES)('$type field', ({ type, file: make }) => {
  it('uploads and stores the id and URL the API returns, not a blob: URL', async () => {
    mutateAsync.mockResolvedValue(stored('media-1', '/api/v1/media/files/abc.bin'))
    const { onChange, choose } = setup(field(type))

    await choose(make())

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    const value = onChange.mock.calls[0][0] as Array<{ id: string; url: string; name: string }>
    expect(value).toHaveLength(1)
    expect(value[0]).toMatchObject({ id: 'media-1', url: '/api/v1/media/files/abc.bin', name: make().name })
    expect(JSON.stringify(value)).not.toContain('blob:')
    expect(mutateAsync).toHaveBeenCalledTimes(1)
  })

  it('shows the error and stores nothing when the upload fails', async () => {
    mutateAsync.mockRejectedValue(new Error('Storage is down'))
    const { onChange, choose } = setup(field(type))

    await choose(make())

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is down')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows progress while uploading and cancels without error or value', async () => {
    let signal: AbortSignal | undefined
    mutateAsync.mockImplementation(({ onProgress, signal: s }) => new Promise((_, reject) => {
      signal = s
      onProgress?.(0.5)
      s?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))
    }))
    const { onChange, choose } = setup(field(type))

    await choose(make())
    expect(await screen.findByRole('progressbar')).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /cancel upload/i })) })

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses a file over the field maxSize without uploading it', async () => {
    const { onChange, choose } = setup(field(type, { maxSize: 1 }))

    await choose(file(make().name, make().type, 2 * MB))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses a file over maxFiles', async () => {
    const present = [{ id: 'old', name: 'old', size: 1, url: '/api/v1/media/files/old.bin', type: make().type }]
    const { onChange, choose } = setup(field(type, { maxFiles: 1 }), present)

    await choose(make())

    expect(await screen.findByRole('alert')).toHaveTextContent(/maximum 1/i)
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses a type outside the field acceptedTypes', async () => {
    const { onChange, choose } = setup(field(type, { acceptedTypes: ['application/x-nothing'] }))

    await choose(make())

    expect(await screen.findByRole('alert')).toHaveTextContent(/not allowed|unsupported/i)
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps the files that uploaded when another one fails', async () => {
    mutateAsync
      .mockResolvedValueOnce(stored('media-1', '/api/v1/media/files/one.bin'))
      .mockRejectedValueOnce(new Error('Second failed'))
    const { onChange, choose } = setup(field(type))
    const first = make()
    const second = new File([new Uint8Array(8)], 'second-' + first.name, { type: first.type })

    await choose(first, second)

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect((onChange.mock.calls[0][0] as unknown[])).toHaveLength(1)
    expect(await screen.findByRole('alert')).toHaveTextContent('Second failed')
  })
})

const hang = ({ signal }: { signal?: AbortSignal }) => new Promise((_, reject) => {
  signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))
})

describe('leaving the form', () => {
  it('stops a batch: files still waiting are not uploaded and the value is not touched', async () => {
    mutateAsync.mockImplementation(hang)
    const { onChange, choose, unmount } = setup(field('file'))

    await choose(file('a.pdf', 'application/pdf'), file('b.pdf', 'application/pdf'), file('c.pdf', 'application/pdf'))
    expect(mutateAsync).toHaveBeenCalledTimes(1)
    await act(async () => { unmount() })

    await new Promise(resolve => setTimeout(resolve, 20))
    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('files still uploading count toward the limit', () => {
  it('multiple: false - a second file picked before the first finishes is refused', async () => {
    mutateAsync.mockImplementation(hang)
    const { onChange, choose } = setup(field('file', { multiple: false }))

    await choose(file('a.pdf', 'application/pdf'))
    await choose(file('b.pdf', 'application/pdf'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/maximum 1/i)
    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('slots are taken at pick time', () => {
  it('multiple: false - a second pick while the first file is still being checked is refused', async () => {
    // the image never finishes loading: the first pick is stuck in validation
    Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, set() { /* never loads */ } })
    mutateAsync.mockResolvedValue(stored('media-1', '/api/v1/media/files/a.png'))
    const { onChange, choose } = setup(field('image', { multiple: false }))

    await choose(file('a.png', 'image/png'))
    await choose(file('b.png', 'image/png'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/maximum 1/i)
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('multiple', () => {
  it('false limits the field to one file (the input takes one)', () => {
    const { input } = setup(field('file', { multiple: false }))
    expect(input().multiple).toBe(false)
  })

  it('is on when the field does not say otherwise', () => {
    const { input } = setup(field('file'))
    expect(input().multiple).toBe(true)
  })
})
