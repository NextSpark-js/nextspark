/**
 * The detail of a public entity asks the API as a visitor, like the grid: with a session cookie and a stored team the API
 * answers 400 TEAM_CONTEXT_REQUIRED (#573).
 */
import { render, waitFor } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('@/core/lib/entities/registry.client', () => ({ getAllEntityConfigs: () => [] }))

import { PublicEntityDetail } from '@/core/components/public/entities/PublicEntityDetail'

test('the detail requests the item without the session cookie and without a team', async () => {
  localStorage.setItem('activeTeamId', 'team-1')
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { id: 'post-1', title: 'A post' } }) }))
  ;(globalThis as { fetch: unknown }).fetch = fetchMock

  render(<PublicEntityDetail entityType="posts" entitySlug="posts" id="post-1" />)

  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toContain('/api/v1/posts/post-1')
  expect(init.credentials).toBe('omit')
  expect(Object.keys((init.headers ?? {}) as object).map(h => h.toLowerCase())).not.toContain('x-team-id')
})
