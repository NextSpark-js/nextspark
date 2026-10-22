/**
 * @jest-environment jsdom
 */

// #355: a top-level image field stores the URL string (what resolveMediaUrl reads), and still shows data
// saved as an upload object or a list of them.

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DynamicForm } from '@/core/components/dashboard/block-editor/dynamic-form'
import { resolveMediaUrl, type FieldDefinition } from '@/core/types/blocks'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path }))
// Shows what the field was given and lets the test pick, replace or clear an upload
jest.mock('@/core/components/ui/image-upload', () => ({
  ImageUpload: ({ value, onChange }: { value: { url: string }[]; onChange: (v: unknown[]) => void }) => (
    <div>
      <span data-testid="shown">{value.map((image) => image.url).join(',')}</span>
      <button onClick={() => onChange([{ id: 'm1', name: 'a.png', size: 3, url: '/api/v1/media/files/a.png' }])}>pick</button>
      <button onClick={() => onChange([])}>clear</button>
    </div>
  ),
}))
jest.mock('@/core/components/ui/rich-text-editor', () => ({ RichTextEditor: () => null }))
jest.mock('@/core/components/media/MediaLibrary', () => ({ MediaLibrary: () => null }))
jest.mock('@/core/components/dashboard/block-editor/array-field', () => ({ ArrayField: () => null }))
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: jest.fn() }))

const fields = [{ name: 'backgroundImage', type: 'image', label: 'Background' }] as FieldDefinition[]

function setup(backgroundImage?: unknown) {
  const onChange = jest.fn<(values: Record<string, unknown>) => void>()
  const flushRef: { current: (() => void) | null } = { current: null }
  render(<DynamicForm fieldDefinitions={fields} values={{ backgroundImage }} onChange={onChange} flushRef={flushRef} />)
  act(() => { jest.advanceTimersByTime(20) })
  return onChange
}
const settle = () => act(() => { jest.advanceTimersByTime(600) })

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('dynamic-form top-level image field', () => {
  test('pick stores the URL string, which resolveMediaUrl reads', () => {
    const onChange = setup()
    fireEvent.click(screen.getByText('pick'))
    settle()
    const stored = onChange.mock.calls.at(-1)![0].backgroundImage
    expect(stored).toBe('/api/v1/media/files/a.png')
    expect(resolveMediaUrl(stored as string)).toBe('/api/v1/media/files/a.png')
  })

  test('replace stores the new URL over a stored one', () => {
    const onChange = setup('/old.png')
    expect(screen.getByTestId('shown')).toHaveTextContent('/old.png')
    fireEvent.click(screen.getByText('pick'))
    settle()
    expect(onChange.mock.calls.at(-1)![0].backgroundImage).toBe('/api/v1/media/files/a.png')
  })

  test('clear stores an empty string, which resolves to no image', () => {
    const onChange = setup('/old.png')
    fireEvent.click(screen.getByText('clear'))
    settle()
    const stored = onChange.mock.calls.at(-1)![0].backgroundImage
    expect(stored).toBe('')
    expect(resolveMediaUrl(stored as string)).toBeUndefined()
  })

  test('a stored URL is shown when the editor reopens', () => {
    setup('/stored.png')
    expect(screen.getByTestId('shown')).toHaveTextContent('/stored.png')
  })

  test('data saved as an upload object, or a list of them, still shows', () => {
    const upload = { id: 'm1', name: 'a.png', size: 3, url: '/legacy.png' }
    setup({ mediaId: 'm1', url: '/legacy.png' })
    expect(screen.getByTestId('shown')).toHaveTextContent('/legacy.png')
    setup([upload])
    expect(screen.getAllByTestId('shown')[1]).toHaveTextContent('/legacy.png')
  })
})
