/**
 * @jest-environment jsdom
 *
 * A video or audio file whose element never reports metadata still uploads (without a thumbnail or
 * duration) once the probe times out, so it does not hold its upload slot.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react'

const mutateAsync = jest.fn<(input: { files: File[] }) => Promise<unknown>>()
jest.mock('@/core/hooks/useMediaUpload', () => ({ useMediaUpload: () => ({ mutateAsync }) }))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

import { EntityFieldRenderer } from '@/core/components/entities/EntityFieldRenderer'
import { MEDIA_PROBE_TIMEOUT_MS } from '@/core/hooks/useFieldUpload'
import type { EntityField } from '@/core/lib/entities/types'

const field = (type: string) =>
  ({ name: 'attachment', type, required: false, display: { label: 'Attachment', showInForm: true }, api: {} }) as unknown as EntityField

const CASES = [
  { type: 'video', file: new File([new Uint8Array(8)], 'clip.mp4', { type: 'video/mp4' }), extra: 'thumbnail' },
  { type: 'audio', file: new File([new Uint8Array(8)], 'song.mp3', { type: 'audio/mpeg' }), extra: 'duration' },
] as const

beforeEach(() => {
  jest.useFakeTimers()
  mutateAsync.mockReset()
  // the element never fires loadedmetadata, seeked or error
  Object.defineProperty(HTMLMediaElement.prototype, 'src', { configurable: true, set() {} })
  global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/local-only')
  global.URL.revokeObjectURL = jest.fn()
  HTMLMediaElement.prototype.load = jest.fn()
})
afterEach(() => jest.useRealTimers())

describe.each(CASES)('$type field', ({ type, file, extra }) => {
  it(`uploads without a ${extra} when the element never reports`, async () => {
    mutateAsync.mockResolvedValue({ urls: ['/f/x'], media: [{ id: 'm1', url: '/f/x' }], count: 1, storage: 'local' })
    const onChange = jest.fn()
    const { container } = render(<EntityFieldRenderer field={field(type)} value={[]} onChange={onChange} mode="form" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
    expect(mutateAsync).not.toHaveBeenCalled()

    await act(async () => { jest.advanceTimersByTime(MEDIA_PROBE_TIMEOUT_MS) })

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    const [item] = onChange.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(item).toMatchObject({ id: 'm1', url: '/f/x' })
    expect(item.thumbnail || item.duration).toBeFalsy()
    // the object URL made for the check is released
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/local-only')
  })
})

describe('audio field', () => {
  it('still stores the duration of a file that loads, and releases the object URL', async () => {
    // the element reports its metadata as soon as it gets a source
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true,
      set() {
        Object.defineProperty(this, 'duration', { value: 42, configurable: true })
        setTimeout(() => (this as HTMLMediaElement).onloadedmetadata?.(new Event('loadedmetadata')), 0)
      },
    })
    mutateAsync.mockResolvedValue({ urls: ['/f/x'], media: [{ id: 'm1', url: '/f/x' }], count: 1, storage: 'local' })
    const onChange = jest.fn()
    const { container } = render(<EntityFieldRenderer field={field('audio')} value={[]} onChange={onChange} mode="form" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await act(async () => { fireEvent.change(input, { target: { files: [CASES[1].file] } }) })
    await act(async () => { jest.advanceTimersByTime(1) })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0][0] as Array<Record<string, unknown>>)[0].duration).toBe(42)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/local-only')
  })
})
