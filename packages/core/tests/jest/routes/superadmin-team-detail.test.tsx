/**
 * /superadmin/teams/[teamId]: "back" is a breadcrumb, the debug footer is the tooltip of Refresh (#530).
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const data = {
  team: { id: 't1', name: 'Acme', owner: { id: 'u1', name: 'Ann', email: 'ann@example.com' }, memberCount: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
  members: [],
  subscription: null,
  billingHistory: [],
  usage: {},
  metadata: { requestedBy: 'sa-1', requestedAt: '2026-11-10T12:00:00Z', source: 'superadmin-api' },
}

jest.mock('next/navigation', () => ({ useParams: () => ({ teamId: 't1' }) }))
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string, values?: Record<string, unknown>) => (values ? `${key}${JSON.stringify(values)}` : key), { has: () => false }),
}))
const query = { data, isLoading: false, error: null, refetch: jest.fn() }
jest.mock('@tanstack/react-query', () => ({ useQuery: () => query }))

import TeamDetailPage from '../../../src/routes/superadmin/teams/[teamId]/page'

beforeEach(() => {
  query.data = data
  query.isLoading = false
})

it('has a breadcrumb to the team list and no "back" button or debug footer', () => {
  render(<TeamDetailPage />)
  const nav = screen.getByRole('navigation')
  expect(nav).toHaveTextContent('teamsPage.title')
  expect(nav).toHaveTextContent('Acme')
  expect(screen.getByRole('link', { name: 'teamsPage.title' })).toHaveAttribute('href', '/superadmin/teams')
  expect(screen.queryByText('teamDetail.backToTeams')).not.toBeInTheDocument()
  expect(screen.queryByText(/footer\.source/)).not.toBeInTheDocument()
})

it('puts "last updated / requested by / source" in the tooltip of Refresh', async () => {
  render(<TeamDetailPage />)
  fireEvent.focus(screen.getByRole('button', { name: 'refresh' }))
  expect((await screen.findAllByText(/footer\.source\{"source":"superadmin-api"\}/)).length).toBeGreaterThan(0)
})
