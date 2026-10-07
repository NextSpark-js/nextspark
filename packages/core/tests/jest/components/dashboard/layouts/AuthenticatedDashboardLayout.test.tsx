/**
 * @jest-environment jsdom
 *
 * The dashboard's client auth gate must not hide the page while the session loads: a gate that returns a
 * skeleton instead of `children` leaves the route's own segments out of the server render, and Next.js's
 * instant-navigation check (dev, Cache Components) reports them as "dropped from rendering".
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const push = jest.fn()
const mockUseAuth = jest.fn()

jest.mock('@/core/lib/auth/load-login-page', () => ({ loadLoginPage: () => push('/login') }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
jest.mock('@/core/hooks/useEnsureUserMetadata', () => ({ useEnsureUserMetadata: jest.fn() }))
jest.mock('@/core/hooks/useAuthMethodDetector', () => ({ useAuthMethodDetector: jest.fn() }))
jest.mock('@/core/providers/DashboardProviders', () => ({ DashboardProviders: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@/core/lib/i18n/DashboardTranslationPreloader', () => ({ DashboardTranslationPreloader: () => <div data-testid="preloader" /> }))
jest.mock('@/core/utils/dev/TranslationDebugger', () => ({ TranslationDebugger: () => null }))

import { AuthenticatedDashboardLayout } from '@/core/components/dashboard/layouts/AuthenticatedDashboardLayout'

const page = <p>the page</p>

beforeEach(() => push.mockReset())

describe('AuthenticatedDashboardLayout', () => {
  test('renders the page while the session loads, without the signed-in side effects', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    render(<AuthenticatedDashboardLayout>{page}</AuthenticatedDashboardLayout>)

    expect(screen.getByText('the page')).toBeTruthy()
    expect(screen.getByTestId('dashboard-container')).toBeTruthy()
    expect(screen.queryByTestId('preloader')).toBeNull()
    expect(push).not.toHaveBeenCalled()
  })

  test('renders the page and the signed-in side effects once the user is known', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-a' }, isLoading: false })
    render(<AuthenticatedDashboardLayout>{page}</AuthenticatedDashboardLayout>)

    expect(screen.getByText('the page')).toBeTruthy()
    expect(screen.getByTestId('preloader')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  test('renders nothing and goes to the login page when there is no session', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    render(<AuthenticatedDashboardLayout>{page}</AuthenticatedDashboardLayout>)

    expect(screen.queryByText('the page')).toBeNull()
    expect(push).toHaveBeenCalledWith('/login')
  })
})
