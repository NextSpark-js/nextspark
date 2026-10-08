/**
 * MultiSelectFilter — the trigger's accessible name.
 *
 * The trigger is a button with role="combobox", and a combobox takes its name from aria-label or a label, not from
 * its text: without aria-label axe reports it as an unnamed button (critical) and a screen reader announces only
 * "combobox". The name has to carry the visible text, including the selection count.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

import { MultiSelectFilter } from '@/core/components/shared/MultiSelectFilter'

const options = [
  { value: 'todo', label: 'To Do' },
  { value: 'done', label: 'Done' },
]

describe('MultiSelectFilter accessibility', () => {
  it('names the combobox trigger after its label', () => {
    render(<MultiSelectFilter label="Status" options={options} values={[]} onChange={jest.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeTruthy()
  })

  it('keeps the selection count in the name, as the visible text shows it', () => {
    render(<MultiSelectFilter label="Status" options={options} values={['todo', 'done']} onChange={jest.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Status (2)' })).toBeTruthy()
  })
})
