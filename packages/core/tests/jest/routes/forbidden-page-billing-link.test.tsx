/**
 * The 403 page shows "View plans" only to a role with `settings.billing`. It reads the role through the real team
 * providers, which it mounts only for an upgrade 403: any other 403 makes no request.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

let search = ''
let role = 'owner'

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('sonner', () => ({ Toaster: () => null, toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}))
const mockAuth = { user: { id: 'user-1', email: 'a@x.com', role: 'member' }, session: null, isLoading: false }
jest.mock('@/core/lib/permissions/init', () => ({
  permissionRegistry: { hasPermission: (r: string, p: string) => r === 'owner' && p === 'settings.billing' },
}))

import ForbiddenPage from '@/core/routes/403/page'

const TEAM = { id: 'team-a', name: 'Team A', slug: 'team-a', description: null, owner_id: 'user-1', avatar_url: null, settings: {}, created_at: '2026-01-01', updated_at: '2026-01-01' }
let fetchMock: jest.Mock

beforeEach(() => {
  localStorage.clear()
  fetchMock = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => (url === '/api/v1/teams' ? { data: [{ ...TEAM, userRole: role, joinedAt: '2026-01-01T00:00:00Z' }] } : {}),
    }),
  )
  global.fetch = fetchMock as unknown as typeof fetch
})

const plansLink = () => screen.queryAllByRole('link').find(a => a.getAttribute('href') === '/dashboard/settings/billing')

it('without upgrade: no link and no request', async () => {
  search = ''
  render(<ForbiddenPage />)
  await new Promise(r => setTimeout(r, 100))
  expect(plansLink()).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('upgrade, owner: "View plans" is shown', async () => {
  search = 'upgrade=true'
  role = 'owner'
  render(<ForbiddenPage />)
  await waitFor(() => expect(plansLink()).toBeDefined())
})

it('upgrade, member: "View plans" is not shown', async () => {
  search = 'upgrade=true'
  role = 'member'
  render(<ForbiddenPage />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/teams'))
  await new Promise(r => setTimeout(r, 200))
  expect(plansLink()).toBeUndefined()
})
