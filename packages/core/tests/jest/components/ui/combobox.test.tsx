/**
 * @jest-environment jsdom
 *
 * Combobox accessibility contract (#90):
 * - the focusable trigger (role="combobox") carries the `id` so a <label for>
 *   resolves to a real element
 * - the clear control is a real <button> with an accessible name, rendered as
 *   a sibling of the trigger (not nested inside it), sized for touch (44px)
 */
import { describe, test, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { Combobox } from '@/core/components/ui/combobox'
import { TimezoneSelect } from '@/core/components/ui/timezone-select'

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
]

describe('Combobox (#90)', () => {
  test('applies the id to the combobox trigger so <label for> resolves', () => {
    render(
      <>
        <label htmlFor="field-tz">Timezone</label>
        <Combobox id="field-tz" options={options} value="a" onChange={() => {}} />
      </>
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('id', 'field-tz')
    expect(document.getElementById('field-tz')).toBe(trigger)
    expect(screen.getByLabelText('Timezone')).toBe(trigger)
  })

  test('renders the clear control as a labelled button outside the trigger with a 44px hit area', () => {
    const onChange = jest.fn()
    render(<Combobox options={options} value="a" onChange={onChange} clearable clearLabel="Clear timezone" />)

    const clear = screen.getByRole('button', { name: 'Clear timezone' })
    expect(clear.tagName).toBe('BUTTON')
    expect(clear).toHaveAttribute('type', 'button')
    expect(clear).toHaveClass('h-11', 'w-11')
    // Not nested inside the combobox trigger (interactive-in-interactive is invalid)
    expect(screen.getByRole('combobox').contains(clear)).toBe(false)

    fireEvent.click(clear)
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  test('does not render a clear control without a selection or when disabled', () => {
    const { rerender } = render(<Combobox options={options} value={undefined} onChange={() => {}} clearable />)
    expect(screen.queryByRole('button', { name: /limpiar|clear/i })).toBeNull()

    rerender(<Combobox options={options} value="a" onChange={() => {}} clearable disabled />)
    expect(screen.queryByRole('button', { name: /limpiar|clear/i })).toBeNull()
  })

  test('TimezoneSelect forwards the id to the trigger', () => {
    render(<TimezoneSelect id="field-timezone" value="UTC" onChange={() => {}} />)
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'field-timezone')
  })
})
