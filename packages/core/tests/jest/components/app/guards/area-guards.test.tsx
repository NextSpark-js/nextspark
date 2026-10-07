/**
 * The client guards of /superadmin and /devtools (#213).
 *
 * The server render never has the client session, so a guard that shows its loading state there hides the area's
 * segments from it, and Next's dev check in a Cache Components host reports them as "dropped". There core's area
 * layout renders the guard only after the server-side role check (area-access) and passes `serverChecked`: the server
 * render holds the children. Without it (the legacy ISR host, any other caller) nothing changes. Once the session has
 * loaded, the guard's own checks apply either way.
 */
import React from 'react'
// The node build: the browser one needs MessageChannel, which jsdom lacks
import { renderToString } from 'react-dom/server.node'
import { render, screen, waitFor } from '@testing-library/react'

const push = jest.fn()
let sessionState: { data: { user: { role: string } } | null; isPending: boolean } = { data: null, isPending: true }

jest.mock('@/core/lib/auth-client', () => ({ useSession: () => sessionState }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, back: jest.fn() }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { SuperAdminGuard } from '@/core/components/app/guards/SuperAdminGuard'
import { DeveloperGuard } from '@/core/components/app/guards/DeveloperGuard'

const AREA = <p data-cy="area-content">area content</p>

beforeEach(() => {
  push.mockClear()
  sessionState = { data: null, isPending: true }
})

describe.each([
  ['SuperAdminGuard', SuperAdminGuard, 'superadmin', 'member'],
  ['DeveloperGuard', DeveloperGuard, 'developer', 'superadmin'],
] as const)('%s', (_name, Guard, allowed, refused) => {
  it('server render without serverChecked: the loading state, not the children (unchanged)', () => {
    expect(renderToString(<Guard>{AREA}</Guard>)).not.toContain('area content')
  })

  it('server render with serverChecked: the children', () => {
    expect(renderToString(<Guard serverChecked>{AREA}</Guard>)).toContain('area content')
  })

  it('with serverChecked, a loaded session without the role is still refused and sent away', async () => {
    sessionState = { data: { user: { role: refused } }, isPending: false }
    render(<Guard serverChecked>{AREA}</Guard>)
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard?error=access_denied'))
    expect(screen.queryByText('area content')).toBeNull()
  })

  it('with serverChecked, no session once loaded renders no children', async () => {
    sessionState = { data: null, isPending: false }
    render(<Guard serverChecked>{AREA}</Guard>)
    await waitFor(() => expect(screen.getByText('Session not found. Please sign in again.')).toBeTruthy())
    expect(screen.queryByText('area content')).toBeNull()
  })

  it('a loaded session with the role sees the children', async () => {
    sessionState = { data: { user: { role: allowed } }, isPending: false }
    render(<Guard>{AREA}</Guard>)
    await waitFor(() => expect(screen.getByText('area content')).toBeTruthy())
    expect(push).not.toHaveBeenCalled()
  })
})
