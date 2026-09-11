/**
 * SearchInput — the clear button.
 *
 * Clearing is the part worth testing: the button sets the input's value with
 * the native setter and dispatches a real `input` event, rather than calling
 * onChange with a hand-made object. That is what makes it work for a controlled
 * value and for react-hook-form alike, and it is easy to break into something
 * that silently stops notifying the consumer.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'

import { SearchInput } from '@/core/components/shared/SearchInput'

const byCy = (value: string) => document.querySelector(`[data-cy="${value}"]`) as HTMLElement | null

/** A consumer that owns the value, the way the entity list does. */
function Controlled({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <SearchInput
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        onChange?.(e.target.value)
      }}
      data-cy="tasks-search"
    />
  )
}

describe('SearchInput', () => {
  it('derives its test hooks from the data-cy it is given', () => {
    render(<Controlled />)
    expect(byCy('tasks-search')).toBeInTheDocument()
    expect(byCy('tasks-search-input')).toBeInTheDocument()
    expect(byCy('tasks-search-icon')).toBeInTheDocument()
  })

  it('offers no clear button while the field is empty', () => {
    render(<Controlled />)
    expect(byCy('tasks-search-clear')).not.toBeInTheDocument()
  })

  it('offers one once there is something to clear', () => {
    render(<Controlled initial="something" />)
    expect(byCy('tasks-search-clear')).toBeInTheDocument()
  })

  it('clearing empties the field and tells the consumer', () => {
    const onChange = jest.fn<(v: string) => void>()
    render(<Controlled initial="something" onChange={onChange} />)

    fireEvent.click(byCy('tasks-search-clear')!)

    expect(onChange).toHaveBeenCalledWith('')
    expect((byCy('tasks-search-input') as HTMLInputElement).value).toBe('')
    // and the button goes away with the value it was there to clear
    expect(byCy('tasks-search-clear')).not.toBeInTheDocument()
  })

  it('names the clear button for screen readers, overridably', () => {
    const { rerender } = render(<SearchInput value="x" onChange={() => {}} data-cy="tasks-search" />)
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()

    rerender(
      <SearchInput value="x" onChange={() => {}} clearLabel="Limpiar búsqueda" data-cy="tasks-search" />
    )
    expect(screen.getByRole('button', { name: 'Limpiar búsqueda' })).toBeInTheDocument()
  })

  it('stays out of the way when the field cannot be edited', () => {
    const { rerender } = render(<SearchInput value="x" onChange={() => {}} disabled data-cy="tasks-search" />)
    expect(byCy('tasks-search-clear')).not.toBeInTheDocument()

    rerender(<SearchInput value="x" onChange={() => {}} readOnly data-cy="tasks-search" />)
    expect(byCy('tasks-search-clear')).not.toBeInTheDocument()
  })
})
