/**
 * The archive grid of a public entity asks the API as a visitor, so a signed-in visitor gets the published items
 * instead of a 400 TEAM_CONTEXT_REQUIRED (#570).
 */
import { render, waitFor } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/entities/registry.client', () => ({ getAllEntityConfigs: () => [] }))
jest.mock('@/core/lib/entities/client-entity-meta', () => ({ getClientEntityApiPath: () => 'posts', getClientEntityConfigs: () => [] }))

import { PublicEntityGrid } from '@/core/components/public/entities/PublicEntityGrid'

test('the grid requests the list without the session cookie and without a team', async () => {
  localStorage.setItem('activeTeamId', 'team-1')
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [], info: { total: 0, totalPages: 0 } }) }))
  ;(globalThis as { fetch: unknown }).fetch = fetchMock

  render(<PublicEntityGrid entityType="posts" entitySlug="posts" searchParams={{}} />)

  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toContain('/api/v1/posts')
  expect(init.credentials).toBe('omit')
  expect(Object.keys((init.headers ?? {}) as object).map(h => h.toLowerCase())).not.toContain('x-team-id')
})
