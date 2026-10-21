/**
 * @jest-environment jsdom
 */

// #351: an image field inside an array item stores the URL string, and still reads data saved as an upload object.

import { describe, test, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArrayField } from '@/core/components/dashboard/block-editor/array-field'
import type { FieldDefinition } from '@/core/types/blocks'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path }))
jest.mock('@/core/components/ui/rich-text-editor', () => ({ RichTextEditor: () => null }))
jest.mock('@/core/components/media/MediaLibrary', () => ({ MediaLibrary: () => null }))
// Shows what the field was given and lets the test pick, replace or clear an upload
jest.mock('@/core/components/ui/image-upload', () => ({
  ImageUpload: ({ value, onChange }: { value: { url: string }[]; onChange: (v: unknown[]) => void }) => (
    <div>
      <span data-testid="shown">{value.map((image) => image.url).join(',')}</span>
      <button onClick={() => onChange([{ id: 'm1', name: 'a.png', size: 3, type: 'image/png', url: '/api/v1/media/files/a.png' }])}>pick</button>
      <button onClick={() => onChange([])}>clear</button>
    </div>
  ),
}))

const field = {
  name: 'items',
  type: 'array',
  label: 'Items',
  itemFields: [{ name: 'photo', type: 'image', label: 'Photo' }],
} as FieldDefinition

function setup(photo: unknown) {
  const onChange = jest.fn()
  render(<ArrayField field={field} value={[{ photo }]} onChange={onChange} />)
  return onChange
}

describe('array-field image item', () => {
  test('select stores the URL string', () => {
    const onChange = setup('')
    fireEvent.click(screen.getByText('pick'))
    expect(onChange).toHaveBeenCalledWith([{ photo: '/api/v1/media/files/a.png' }])
  })

  test('replace stores the new URL string over a stored one', () => {
    const onChange = setup('/old.png')
    expect(screen.getByTestId('shown')).toHaveTextContent('/old.png')
    fireEvent.click(screen.getByText('pick'))
    expect(onChange).toHaveBeenCalledWith([{ photo: '/api/v1/media/files/a.png' }])
  })

  test('clear stores an empty string', () => {
    const onChange = setup('/old.png')
    fireEvent.click(screen.getByText('clear'))
    expect(onChange).toHaveBeenCalledWith([{ photo: '' }])
  })

  test('a stored URL is shown when the editor reopens', () => {
    setup('/stored.png')
    expect(screen.getByTestId('shown')).toHaveTextContent('/stored.png')
  })

  test('data saved as an upload object, or a list of them, still shows', () => {
    const upload = { id: 'm1', name: 'a.png', size: 3, url: '/legacy.png' }
    setup(upload)
    expect(screen.getByTestId('shown')).toHaveTextContent('/legacy.png')
    setup([upload])
    expect(screen.getAllByTestId('shown')[1]).toHaveTextContent('/legacy.png')
  })
})
