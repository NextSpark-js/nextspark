/**
 * TeamProvider hands the signed-in user's app role to the permission hooks, which decide with it whether
 * teams.appRoleBypass lets that role skip team permissions (#457).
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TeamProvider, useTeamContext } from '@/core/contexts/TeamContext'

let authUser: { id: string; role?: string } | null = null
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser, isLoading: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

function Probe() {
  return <div data-testid="app-role">{String(useTeamContext().appRole)}</div>
}

function renderProvider() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TeamProvider>
        <Probe />
      </TeamProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })) as unknown as typeof fetch
})

it.each(['developer', 'superadmin', 'member'])('exposes the app role %s', async (role) => {
  authUser = { id: 'u1', role }
  renderProvider()
  await waitFor(() => expect(screen.getByTestId('app-role').textContent).toBe(role))
})

it('is null while no user is signed in', () => {
  authUser = null
  renderProvider()
  expect(screen.getByTestId('app-role').textContent).toBe('null')
})
