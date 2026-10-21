/**
 * @jest-environment jsdom
 */

// #340: DynamicForm and ArrayField consult a registry of renderers per field type before their built-in
// switch. A project can add a type, replace a built-in one, or supply them from the theme configuration.

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { readFileSync } from 'fs'
import path from 'path'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DynamicForm } from '@/core/components/dashboard/block-editor/dynamic-form'
import { ArrayField } from '@/core/components/dashboard/block-editor/array-field'
import { registerFieldRenderer, type FieldRendererProps } from '@/core/components/dashboard/block-editor/editor-extensions'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry.client'
import type { FieldDefinition } from '@/core/types/blocks'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path }))
jest.mock('@/core/components/ui/image-upload', () => ({ ImageUpload: () => null }))
jest.mock('@/core/components/ui/rich-text-editor', () => ({ RichTextEditor: () => null }))
jest.mock('@/core/components/media/MediaLibrary', () => ({ MediaLibrary: () => null }))
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: jest.fn() }))

const rating = ({ field, value, onChange, context, compact, parent, dataCy }: FieldRendererProps) => (
  <button
    data-testid="rating"
    data-context={context}
    data-compact={String(compact)}
    data-name={field.name}
    data-value={String(value)}
    data-cy={dataCy}
    data-parent={parent ? `${parent.field.name}:${parent.index}` : ''}
    onClick={() => onChange(Number(value) + 1)}
  />
)
const shout = ({ value, onChange }: FieldRendererProps) => (
  <input data-testid="shout" value={String(value).toUpperCase()} onChange={(e) => onChange(e.target.value)} />
)

const cleanups: Array<() => void> = []
const register = (type: string, renderer: Parameters<typeof registerFieldRenderer>[1]) => { cleanups.push(registerFieldRenderer(type, renderer)) }
const themeComponents = () => THEME_REGISTRY.default.components as Record<string, unknown>

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  cleanups.splice(0).forEach((fn) => fn())
  delete themeComponents().builder
})

const formFields = [
  { name: 'title', type: 'text', label: 'Title' },
  { name: 'body', type: 'textarea', label: 'Body' },
  { name: 'kind', type: 'select', label: 'Kind', options: [{ label: 'A', value: 'a' }] },
  { name: 'on', type: 'checkbox', label: 'On' },
  { name: 'tint', type: 'color', label: 'Tint' },
  { name: 'odd', type: 'not-registered', label: 'Odd' },
] as FieldDefinition[]

function form(fields: FieldDefinition[], values: Record<string, unknown> = {}) {
  const onChange = jest.fn<(values: Record<string, unknown>) => void>()
  const view = render(<DynamicForm fieldDefinitions={fields} values={values} onChange={onChange} />)
  act(() => { jest.advanceTimersByTime(20) })
  return { onChange, view }
}

describe('empty registry', () => {
  // field-switch-output.html is the output of the `switch` before the registry existed (captured from the code
  // of the previous commit): the form for 15 field types with an array of the same, then an ArrayField on its own
  test('the output of the switch is the one captured before the registry existed', () => {
    const types = ['text', 'textarea', 'rich-text', 'url', 'number', 'select', 'image', 'media-library', 'checkbox', 'radio', 'color', 'date', 'time', 'datetime', 'weird']
    const options = [{ label: 'A', value: 'a' }]
    const fields = types.map((t) => ({ name: `f_${t}`, type: t, label: t, options })) as FieldDefinition[]
    const arrayField = { name: 'arr', type: 'array', label: 'Arr', itemFields: types.filter((t) => t !== 'checkbox').map((t) => ({ name: `i_${t}`, type: t, label: t, options })) } as FieldDefinition
    fields.push(arrayField)
    const { view } = form(fields, { arr: [{ i_text: 'x' }], f_text: 'q' })
    const array = render(<ArrayField field={arrayField} value={[{ i_text: 'y' }, {}]} onChange={jest.fn()} />)
    const normalize = (html: string) => html.replace(/radix-_r_[a-z0-9]+_/g, 'radix')
    const expected = readFileSync(path.join(__dirname, 'fixtures', 'field-switch-output.html'), 'utf8')
    expect(`${normalize(view.container.innerHTML)}\n${normalize(array.container.innerHTML)}`).toBe(expected)
  })

  test('DynamicForm renders the same markup after a registration is removed again', () => {
    const html = (container: HTMLElement) => container.innerHTML.replace(/radix-_r_[a-z0-9]+_/g, 'radix')
    const { view } = form(formFields, { title: 'a' })
    const before = html(view.container)
    registerFieldRenderer('text', rating)()
    view.unmount()
    expect(html(form(formFields, { title: 'a' }).view.container)).toBe(before)
    // an unknown type still falls back to a text input
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(1)
    expect(before).not.toContain('data-testid="rating"')
  })

  test('ArrayField renders the built-in item fields', () => {
    const field = { name: 'items', type: 'array', label: 'Items', itemFields: [{ name: 'label', type: 'text', label: 'Label' }] } as FieldDefinition
    render(<ArrayField field={field} value={[{ label: 'x' }]} onChange={jest.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('x')
  })
})

describe('DynamicForm with registered renderers', () => {
  test('a new type gets its renderer, with the documented props, and its change reaches the form', () => {
    register('rating', rating)
    const { onChange } = form([{ name: 'stars', type: 'rating', label: 'Stars', default: 3 }] as FieldDefinition[])
    const el = screen.getByTestId('rating')
    expect(el).toHaveAttribute('data-context', 'form')
    expect(el).toHaveAttribute('data-compact', 'false')
    expect(el).toHaveAttribute('data-name', 'stars')
    expect(el).toHaveAttribute('data-value', '3')
    expect(el).toHaveAttribute('data-cy', 'blockEditor.blockPropertiesPanel.form.field')

    fireEvent.click(el)
    act(() => { jest.advanceTimersByTime(500) })
    expect(onChange).toHaveBeenCalledWith({ stars: 4 })
  })

  test('a field inside a group is rendered compact', () => {
    register('rating', rating)
    form([{ name: 'stars', type: 'rating', label: 'Stars', group: 'g' }] as FieldDefinition[])
    expect(screen.getByTestId('rating')).toHaveAttribute('data-compact', 'true')
  })

  test('a built-in type can be overridden, and the built-in comes back when it is removed', () => {
    const fields = [{ name: 'title', type: 'text', label: 'Title' }] as FieldDefinition[]
    const unregister = registerFieldRenderer('text', shout)
    const { onChange, view } = form(fields, { title: 'abc' })
    expect((screen.getByTestId('shout') as HTMLInputElement).value).toBe('ABC')
    fireEvent.change(screen.getByTestId('shout'), { target: { value: 'new' } })
    act(() => { jest.advanceTimersByTime(500) })
    expect(onChange).toHaveBeenCalledWith({ title: 'new' })

    unregister()
    view.unmount()
    form(fields, { title: 'abc' })
    expect(screen.queryByTestId('shout')).not.toBeInTheDocument()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('abc')
  })

  test('an unregister callback does not remove a renderer registered after it', () => {
    const first = registerFieldRenderer('rating', rating)
    register('rating', shout)
    first()
    form([{ name: 'stars', type: 'rating', label: 'Stars' }] as FieldDefinition[])
    expect(screen.getByTestId('shout')).toBeInTheDocument()
  })

  test('renderers of the theme configuration apply, and the registry wins over them', () => {
    themeComponents().builder = { fieldRenderers: { rating } }
    const fields = [{ name: 'stars', type: 'rating', label: 'Stars' }] as FieldDefinition[]
    const { view } = form(fields)
    expect(screen.getByTestId('rating')).toBeInTheDocument()

    view.unmount()
    register('rating', shout)
    form(fields)
    expect(screen.getByTestId('shout')).toBeInTheDocument()
    expect(screen.queryByTestId('rating')).not.toBeInTheDocument()
  })
})

describe('ArrayField items use the same registry', () => {
  const field = {
    name: 'items',
    type: 'array',
    label: 'Items',
    itemFields: [
      { name: 'score', type: 'rating', label: 'Score' },
      { name: 'label', type: 'text', label: 'Label' },
    ],
  } as FieldDefinition

  test('a new type in an item gets the item context and writes into its item', () => {
    register('rating', rating)
    const onChange = jest.fn()
    render(<ArrayField field={field} value={[{ score: 1, label: 'a' }, { score: 5, label: 'b' }]} onChange={onChange} />)
    const els = screen.getAllByTestId('rating')
    expect(els).toHaveLength(2)
    expect(els[1]).toHaveAttribute('data-context', 'array-item')
    expect(els[1]).toHaveAttribute('data-compact', 'false')
    expect(els[1]).toHaveAttribute('data-parent', 'items:1')
    expect(els[1]).toHaveAttribute('data-cy', 'blockEditor.blockPropertiesPanel.form.arrayField.itemField')

    fireEvent.click(els[1])
    expect(onChange).toHaveBeenCalledWith([{ score: 1, label: 'a' }, { score: 6, label: 'b' }])
  })

  test('a built-in type can be overridden for the items', () => {
    register('text', shout)
    const onChange = jest.fn()
    render(<ArrayField field={field} value={[{ score: 1, label: 'a' }]} onChange={onChange} />)
    expect((screen.getByTestId('shout') as HTMLInputElement).value).toBe('A')
    fireEvent.change(screen.getByTestId('shout'), { target: { value: 'z' } })
    expect(onChange).toHaveBeenCalledWith([{ score: 1, label: 'z' }])
  })

  test('DynamicForm passes the registry to the items of an array field', () => {
    register('rating', rating)
    form([field], { items: [{ score: 2, label: 'a' }] })
    expect(screen.getByTestId('rating')).toHaveAttribute('data-context', 'array-item')
  })
})
