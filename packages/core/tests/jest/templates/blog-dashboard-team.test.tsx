/**
 * @jest-environment jsdom
 *
 * Blog dashboard home and posts list: the posts request carries the team the team provider resolved. The provider
 * resolves it after the first render, so a request sent from the mount effect without it has no team and the API
 * answers 400 "Team context required" (#403).
 */
import { render, waitFor } from '@testing-library/react'

let mockTeamId: string | undefined
jest.mock('@nextsparkjs/core/contexts/TeamContext', () => ({
  useTeamContext: () => ({ currentTeam: mockTeamId ? { id: mockTeamId } : null }),
}))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ user: { id: 'u1' }, isLoading: false }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

import Home from '../../../templates/projects/blog/templates/dashboard/(main)/page'
import PostsList from '../../../templates/projects/blog/templates/dashboard/(main)/posts/page'

const fetchMock = jest.fn()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
  global.fetch = fetchMock as unknown as typeof fetch
})

describe.each([['dashboard home', Home], ['posts list', PostsList]] as const)('blog %s', (_name, Page) => {
  test('sends no posts request until the team is known', async () => {
    mockTeamId = undefined
    render(<Page />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('sends the resolved team, even when it is not in localStorage yet', async () => {
    mockTeamId = 'team-1'
    render(<Page />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/v1/posts')
    expect((init as { headers: Record<string, string> }).headers['x-team-id']).toBe('team-1')
  })
})
