/**
 * The business metrics of /superadmin (#267): the numbers render for a superadmin, and a session without the role is
 * redirected before the page, and so the service, runs.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const redirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const getTypedSession = jest.fn()
const getBusinessMetrics = jest.fn()

jest.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))
jest.mock('next/headers', () => ({ headers: async () => new Headers() }))
jest.mock('@nextsparkjs/core/lib/auth', () => ({
  getTypedSession: (h: Headers) => getTypedSession(h),
  auth: { api: { getSession: ({ headers }: { headers: Headers }) => getTypedSession(headers) } },
}))
jest.mock('next-intl/server', () => ({
  getLocale: async () => 'en',
  getTranslations: async () => (key: string, values?: { count?: number }) => (values ? `${key}:${values.count}` : key),
}))
jest.mock('../../../src/lib/services/business-metrics.service', () => ({ getBusinessMetrics: () => getBusinessMetrics() }))

import { withSuperadminAccess } from '../../../src/routes/_internal/area-access'
import { BusinessMetrics } from '../../../src/components/superadmin/misc/BusinessMetrics'
import SuperadminDashboard from '../../../src/routes/superadmin/page'

const days = Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, '0')}`, count: i === 29 ? 5 : 0 }))

beforeEach(() => {
  jest.clearAllMocks()
  getBusinessMetrics.mockResolvedValue({
    totalUsers: 1234,
    signupsPerDay: days,
    payingUsers: 12,
    payingTeams: 9,
    mrr: [{ currency: 'usd', cents: 499900 }, { currency: 'eur', cents: 366700 }],
  })
})

it('renders every metric, with MRR per currency and a bar for each of the 30 days', async () => {
  render(await BusinessMetrics())
  expect(screen.getByText('1,234')).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('9')).toBeInTheDocument()
  expect(screen.getByText('$4,999.00')).toBeInTheDocument()
  expect(screen.getByText('€3,667.00')).toBeInTheDocument()
  expect(screen.getByText('signups.description:5')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(30)
})

it('shows a zero MRR when nothing is paying', async () => {
  getBusinessMetrics.mockResolvedValue({ totalUsers: 0, signupsPerDay: days.map(d => ({ ...d, count: 0 })), payingUsers: 0, payingTeams: 0, mrr: [] })
  render(await BusinessMetrics())
  expect(screen.getByText('$0.00')).toBeInTheDocument()
})

it('renders a muted card, logs the error and does not throw when the service fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  const failure = new Error('statement timeout')
  getBusinessMetrics.mockRejectedValue(failure)
  render(await BusinessMetrics())
  expect(screen.getByText('unavailable')).toBeInTheDocument()
  expect(error).toHaveBeenCalledWith('[superadmin] business metrics', failure)
  error.mockRestore()
})

/** The page with its async metrics component run (react-dom cannot render async components here). */
async function renderPage() {
  const expand = async (node: React.ReactNode): Promise<React.ReactNode> => {
    if (Array.isArray(node)) return Promise.all(node.map(expand))
    if (!React.isValidElement(node)) return node
    if (node.type === BusinessMetrics) return BusinessMetrics()
    const children = (node.props as { children?: React.ReactNode }).children
    return children === undefined ? node : React.cloneElement(node, undefined, await expand(children))
  }
  render(<>{await expand((SuperadminDashboard as () => React.ReactElement)())}</>)
}

it('keeps the rest of the page when the metrics fail', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  getBusinessMetrics.mockRejectedValue(new Error('down'))
  await renderPage()
  expect(screen.getByText('unavailable')).toBeInTheDocument()
  expect(screen.getByText('Super Admin Panel')).toBeInTheDocument()
  expect(screen.getByText('User Management')).toBeInTheDocument()
})

describe('access to the page', () => {
  const Page = withSuperadminAccess(SuperadminDashboard)

  it.each(['member', 'admin', 'user'])('redirects a %s before the page or the service run', async role => {
    getTypedSession.mockResolvedValue({ session: { id: 's' }, user: { id: 'u', role } })
    await expect(Page({})).rejects.toThrow('NEXT_REDIRECT:/dashboard?error=access_denied')
    expect(getBusinessMetrics).not.toHaveBeenCalled()
  })

  it('redirects a request without a session to the login', async () => {
    getTypedSession.mockResolvedValue(null)
    await expect(Page({})).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(getBusinessMetrics).not.toHaveBeenCalled()
  })

  it.each(['superadmin', 'developer'])('renders the page, with the metrics, for a %s', async role => {
    getTypedSession.mockResolvedValue({ session: { id: 's' }, user: { id: 'u', role } })
    const page = (await Page({})) as React.ReactElement
    expect(page.type).toBe(SuperadminDashboard)
  })

  it('puts the metrics before the quick actions', async () => {
    await renderPage()
    const metrics = document.querySelector('[data-cy="superadmin-metrics"]')!
    expect(metrics).not.toBeNull()
    expect(metrics.compareDocumentPosition(screen.getByText('User Management')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
