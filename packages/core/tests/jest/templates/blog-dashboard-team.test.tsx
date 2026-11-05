/**
 * @jest-environment jsdom
 *
 * Blog dashboard home, posts list, and the edit and create pages: the posts request carries the team the team provider resolved. The provider
 * resolves it after the first render, so a request sent from the mount effect without it has no team and the API
 * answers 400 "Team context required" (#403).
 */
import { Suspense } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

let mockTeamId: string | undefined
jest.mock('@nextsparkjs/core/contexts/TeamContext', () => ({
  useTeamContext: () => ({ currentTeam: mockTeamId ? { id: mockTeamId } : null }),
}))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ user: { id: 'u1' }, isLoading: false }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
jest.mock('@/components/editor/WysiwygEditor', () => ({ WysiwygEditor: () => null }), { virtual: true })
jest.mock('@/components/editor/FeaturedImageUpload', () => ({ FeaturedImageUpload: () => null }), { virtual: true })
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

import Home from '../../../templates/projects/blog/templates/dashboard/(main)/page'
import Edit from '../../../templates/projects/blog/templates/dashboard/(main)/posts/[id]/edit/page'
import Create from '../../../templates/projects/blog/templates/dashboard/(main)/posts/create/page'
import PostsList from '../../../templates/projects/blog/templates/dashboard/(main)/posts/page'

const fetchMock = jest.fn()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
  global.fetch = fetchMock as unknown as typeof fetch
})

// one promise: `use` suspends for ever on a new one at each render
const editParams = Promise.resolve({ id: 'p1' })
const EditPage = () => (
  <Suspense fallback={null}>
    <Edit params={editParams} />
  </Suspense>
)

describe.each([['dashboard home', Home], ['posts list', PostsList], ['edit', EditPage]] as const)('blog %s', (_name, Page) => {
  test('sends no posts request until the team is known', async () => {
    mockTeamId = undefined
    render(<Page />)
    await act(async () => {
      await editParams
      await new Promise(resolve => setTimeout(resolve, 150))
    })
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

describe('blog create', () => {
  test('saves with the resolved team, even when it is not in localStorage yet', async () => {
    mockTeamId = 'team-1'
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'p2' } }) })
    render(<Create />)
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Hello' } })
    fireEvent.click(document.querySelector('[data-cy="post-create-save"]') as HTMLElement)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['x-team-id']).toBe('team-1')
  })
})
