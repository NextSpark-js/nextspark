/**
 * @jest-environment jsdom
 *
 * PublicNavbar — an anonymous visitor's navbar does not subscribe to the
 * session, so the page makes no session request.
 */
import { render, screen, act } from '@testing-library/react'

const mockUseAuth = jest.fn()
jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))
jest.mock('@/core/components/app/misc/ThemeToggle', () => ({ ThemeToggle: () => null }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (key: string) => key }))

import { PublicNavbar } from '@/core/components/app/layouts/PublicNavbar'

async function renderNavbar() {
  render(<PublicNavbar />)
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  document.cookie = 'nextspark.signed_in=; Max-Age=0; Path=/'
  mockUseAuth.mockReset().mockReturnValue({ user: null, isLoading: false })
})

describe('PublicNavbar', () => {
  test('without a session hint, shows sign-in and sign-up without asking for the session', async () => {
    await renderNavbar()

    expect(screen.getByText('auth.signIn')).toBeTruthy()
    expect(screen.getByText('auth.createAccount')).toBeTruthy()
    expect(mockUseAuth).not.toHaveBeenCalled()
  })

  test('with a session hint, asks for the session and links a signed-in user to the dashboard', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, isLoading: false })

    await renderNavbar()

    expect(mockUseAuth).toHaveBeenCalled()
    expect(screen.getByText('auth.goToDashboard')).toBeTruthy()
  })

  test('with a stale hint and no session, falls back to sign-in and sign-up', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'

    await renderNavbar()

    expect(screen.getByText('auth.signIn')).toBeTruthy()
  })
})
