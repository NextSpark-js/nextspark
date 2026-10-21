/**
 * @jest-environment jsdom
 */

// #327: the form debounces edits by 500 ms; the pending edit must still reach the parent when the form
// goes away, loses focus, is given other values or is flushed on demand.

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DynamicForm } from '@/core/components/dashboard/block-editor/dynamic-form'
import type { FieldDefinition } from '@/core/types/blocks'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path }))
// Field widgets and data hooks the text field does not use (they pull in the media library and the auth client)
jest.mock('@/core/components/ui/image-upload', () => ({ ImageUpload: () => null }))
jest.mock('@/core/components/ui/rich-text-editor', () => ({ RichTextEditor: () => null }))
jest.mock('@/core/components/media/MediaLibrary', () => ({ MediaLibrary: () => null }))
jest.mock('@/core/components/dashboard/block-editor/array-field', () => ({ ArrayField: () => null }))
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: jest.fn() }))

const fields = [{ name: 'title', type: 'text', label: 'Title' }] as FieldDefinition[]
const input = () => screen.getByRole('textbox') as HTMLInputElement
const type = (value: string) => fireEvent.change(input(), { target: { value } })

function setup(values: Record<string, unknown> = { title: 'a' }) {
  const onChange = jest.fn<(values: Record<string, unknown>) => void>()
  const flushRef: { current: (() => void) | null } = { current: null }
  const ui = (v: Record<string, unknown>, cb = onChange) => (
    <DynamicForm fieldDefinitions={fields} values={v} onChange={cb} flushRef={flushRef} />
  )
  const view = render(ui(values))
  act(() => { jest.advanceTimersByTime(20) }) // lets the mount-time parent sync settle (animation frame)
  return { onChange, flushRef, view, ui }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('DynamicForm debounce and flush', () => {
  test('keeps the debounce: one call 500 ms after the last change', () => {
    const { onChange } = setup()
    type('ab')
    act(() => { jest.advanceTimersByTime(300) })
    type('abc')
    act(() => { jest.advanceTimersByTime(499) })
    expect(onChange).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(1) })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ title: 'abc' })
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('unmount sends the pending change once, without waiting', () => {
    const { onChange, view } = setup()
    type('ab')
    view.unmount()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ title: 'ab' })
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('blur of the container sends the pending change once', () => {
    const { onChange } = setup()
    type('ab')
    fireEvent.blur(input())
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ title: 'ab' })
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('new parent values send the pending change first, with the callback of the previous render, and are not echoed back', () => {
    const { onChange, view, ui } = setup()
    const forOtherBlock = jest.fn<(values: Record<string, unknown>) => void>()
    type('ab')
    view.rerender(ui({ title: 'other' }, forOtherBlock))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ title: 'ab' })
    expect(forOtherBlock).not.toHaveBeenCalled()
    expect(input().value).toBe('other')
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(forOtherBlock).not.toHaveBeenCalled()
  })

  test('flushRef.current() sends the pending change once, without waiting', () => {
    const { onChange, flushRef } = setup()
    type('ab')
    act(() => flushRef.current?.())
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ title: 'ab' })
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('with nothing pending, flush, blur, unmount and a parent change send nothing', () => {
    const { onChange, flushRef, view, ui } = setup()
    act(() => flushRef.current?.())
    fireEvent.blur(input())
    view.rerender(ui({ title: 'b' }))
    act(() => { jest.advanceTimersByTime(2000) })
    view.unmount()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('a flushed change is not sent again by the timer, by a later blur or by the echo of the parent', () => {
    const { onChange, flushRef, view, ui } = setup()
    type('ab')
    act(() => flushRef.current?.())
    view.rerender(ui({ title: 'ab' })) // the parent stores what it got and hands it back
    fireEvent.blur(input())
    act(() => { jest.advanceTimersByTime(2000) })
    view.unmount()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('a keystroke right after the parent echo is delivered', () => {
    const { onChange, view, ui } = setup()
    type('ab')
    act(() => { jest.advanceTimersByTime(500) })
    view.rerender(ui({ title: 'ab' })) // echo, and the next keystroke before any animation frame
    type('abc')
    view.unmount()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith({ title: 'abc' })
  })

  test('a new callback identity alone does not send anything', () => {
    const { onChange, view, ui } = setup()
    view.rerender(ui({ title: 'a' }, jest.fn()))
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onChange).not.toHaveBeenCalled()
  })
})
