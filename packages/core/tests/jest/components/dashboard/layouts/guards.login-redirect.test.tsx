/**
 * @jest-environment jsdom
 *
 * The three client gates of the dashboard leave for /login with a full page load when there is no session. A client
 * navigation leaves the dashboard mounted, hidden, with its "signed out" render (Cache Components), and it sends the
 * user back to /login after the next sign-in; this is also how another tab's sign-out or an expired session ends.
 */
import React from 'react'
import { render } from '@testing-library/react'

const mockUseAuth = jest.fn()
const mockAssign = jest.fn()
const mockRouterPush = jest.fn()
let mockBasePath = ''

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush }) }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
jest.mock('@/core/lib/base-path', () => ({ withBasePath: (path: string) => `${mockBasePath}${path}` }))
jest.mock('@/core/hooks/useEnsureUserMetadata', () => ({ useEnsureUserMetadata: jest.fn() }))
jest.mock('@/core/hooks/useAuthMethodDetector', () => ({ useAuthMethodDetector: jest.fn() }))
jest.mock('@/core/providers/DashboardProviders', () => ({ DashboardProviders: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@/core/lib/i18n/DashboardTranslationPreloader', () => ({ DashboardTranslationPreloader: () => null }))
jest.mock('@/core/utils/dev/TranslationDebugger', () => ({ TranslationDebugger: () => null }))

import { AuthenticatedDashboardLayout } from '@/core/components/dashboard/layouts/AuthenticatedDashboardLayout'
import { DashboardAuthLayout } from '@/core/components/dashboard/layouts/DashboardAuthLayout'
import { AuthGuard } from '@/core/components/dashboard/layouts/AuthGuard'

beforeEach(() => {
  mockAssign.mockReset()
  mockRouterPush.mockReset()
  mockBasePath = ''
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign: mockAssign } })
})

describe.each([
  ['AuthenticatedDashboardLayout', AuthenticatedDashboardLayout],
  ['DashboardAuthLayout', DashboardAuthLayout],
  ['AuthGuard', AuthGuard],
])('%s', (_name, Guard) => {
  test('loads the login page, base path included, when there is no session', () => {
    mockBasePath = '/app'
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    render(<Guard>{<p>the page</p>}</Guard>)

    expect(mockAssign).toHaveBeenCalledWith('/app/login')
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  test('does nothing for a signed-in user or while the session loads', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false })
    render(<Guard>{<p>the page</p>}</Guard>)
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    render(<Guard>{<p>the page</p>}</Guard>)

    expect(mockAssign).not.toHaveBeenCalled()
  })
})
