/**
 * UsageBar: a limit of -1 is unlimited; a limit of 0 (a plan that allows none of it) is an empty or full bar,
 * never "NaN% used".
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const useQuota = jest.fn()

jest.mock('../../../../src/hooks/useQuota', () => ({ useQuota: (slug: string) => useQuota(slug) }))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, v?: Record<string, number>) => (v ? `${key} ${JSON.stringify(v)}` : key),
}))

import { UsageBar } from '../../../../src/components/billing/UsageBar'

const quota = (current: number, max: number) => useQuota.mockReturnValue({ current, max, isLoading: false })

test('limit 0 and no usage: 0% used, not NaN', () => {
  quota(0, 0)
  const { container } = render(<UsageBar limitSlug="tasks" />)
  expect(container.textContent).not.toContain('NaN')
  expect(screen.getByText('percentUsed {"percent":0}')).toBeInTheDocument()
})

test('limit 0 with some usage: full bar', () => {
  quota(2, 0)
  const { container } = render(<UsageBar limitSlug="tasks" />)
  expect(container.textContent).not.toContain('NaN')
  expect(screen.getByText('percentUsed {"percent":100}')).toBeInTheDocument()
})

test('unlimited (-1) and a normal limit are unchanged', () => {
  quota(5, -1)
  const { unmount } = render(<UsageBar limitSlug="tasks" />)
  expect(screen.getByText('unlimited')).toBeInTheDocument()
  unmount()
  quota(5, 10)
  render(<UsageBar limitSlug="tasks" />)
  expect(screen.getByText('percentUsed {"percent":50}')).toBeInTheDocument()
})
