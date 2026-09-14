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
import { useForm } from 'react-hook-form'

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

/** A consumer that registers the field with react-hook-form. */
function WithReactHookForm({ initial = '' }: { initial?: string }) {
  const { register } = useForm({ defaultValues: { q: initial } })
  return <SearchInput {...register('q')} data-cy="tasks-search" />
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

  it('offers the clear button to an uncontrolled field too', () => {
    render(<SearchInput defaultValue="abc" data-cy="tasks-search" />)

    expect(byCy('tasks-search-clear')).not.toBeNull()
  })

  it('an uncontrolled field gains the clear button as soon as it is typed in', () => {
    render(<SearchInput data-cy="tasks-search" />)
    expect(byCy('tasks-search-clear')).toBeNull()

    fireEvent.change(byCy('tasks-search-input') as HTMLInputElement, { target: { value: 'ab' } })

    expect(byCy('tasks-search-clear')).not.toBeNull()
  })

  it('clearing an uncontrolled field empties it and takes the button away', () => {
    render(<SearchInput defaultValue="abc" data-cy="tasks-search" />)

    fireEvent.click(byCy('tasks-search-clear') as HTMLElement)

    expect((byCy('tasks-search-input') as HTMLInputElement).value).toBe('')
    expect(byCy('tasks-search-clear')).toBeNull()
  })

  it('does not submit a form it happens to sit in', () => {
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <SearchInput defaultValue="abc" data-cy="tasks-search" />
      </form>
    )

    fireEvent.click(byCy('tasks-search-clear') as HTMLElement)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('stays out of the way when the field cannot be edited', () => {
    const { rerender } = render(<SearchInput value="x" onChange={() => {}} disabled data-cy="tasks-search" />)
    expect(byCy('tasks-search-clear')).not.toBeInTheDocument()

    rerender(<SearchInput value="x" onChange={() => {}} readOnly data-cy="tasks-search" />)
    expect(byCy('tasks-search-clear')).not.toBeInTheDocument()
  })
})

// react-hook-form owns the value through the ref, so it reaches the field
// without ever passing through props or a change event.
describe('SearchInput with react-hook-form', () => {
  it('offers the clear button for a value that came from the form defaults', () => {
    render(<WithReactHookForm initial="preloaded" />)

    expect((byCy('tasks-search-input') as HTMLInputElement).value).toBe('preloaded')
    expect(byCy('tasks-search-clear')).not.toBeNull()
  })

  it('offers it as soon as the field is typed in', () => {
    render(<WithReactHookForm />)
    expect(byCy('tasks-search-clear')).toBeNull()

    fireEvent.change(byCy('tasks-search-input') as HTMLInputElement, { target: { value: 'ab' } })

    expect(byCy('tasks-search-clear')).not.toBeNull()
  })
})
