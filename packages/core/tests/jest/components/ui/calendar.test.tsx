/**
 * @jest-environment jsdom
 *
 * Calendar day-grid identity regression (#205):
 * Root/Chevron/WeekNumber used to be defined inline inside Calendar's render,
 * giving them a new type identity on every render. React treats a changed
 * component type as "different component" and remounts the subtree, so the
 * whole day grid (and its focus state) was torn down and rebuilt on every
 * parent re-render, not just when Calendar's own props changed.
 */
import { describe, test, expect } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { Calendar } from '@/core/components/ui/calendar'

const FIXED_MONTH = new Date(2024, 0, 1)

function ParentWithRerenders() {
  const [tick, setTick] = useState(0)
  return (
    <div>
      <button onClick={() => setTick((t) => t + 1)}>rerender ({tick})</button>
      <Calendar mode="single" defaultMonth={FIXED_MONTH} showOutsideDays={false} />
    </div>
  )
}

describe('Calendar (#205)', () => {
  test('day button DOM node identity survives a parent re-render', () => {
    render(<ParentWithRerenders />)

    const dayButtonBefore = screen.getByText('15').closest('button')
    expect(dayButtonBefore).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /rerender/i }))

    const dayButtonAfter = screen.getByText('15').closest('button')
    expect(dayButtonAfter).toBe(dayButtonBefore)
    expect(dayButtonBefore?.isConnected).toBe(true)
  })
})
