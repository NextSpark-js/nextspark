/**
 * @jest-environment jsdom
 *
 * The login form only acts, so it does not subscribe to the session: opening
 * /login makes no session request.
 */
import { render } from '@testing-library/react'

const mockUseSession = jest.fn(() => ({ data: null, isPending: true, error: null }))
jest.mock('@/core/lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession(), signIn: { email: jest.fn(), emailOtp: jest.fn(), social: jest.fn() }, emailOtp: { sendVerificationOtp: jest.fn() } },
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('@/core/lib/test', () => ({ sel: (key: string) => key }))

import { LoginForm } from '@/core/components/auth/forms/LoginForm'

describe('LoginForm', () => {
  test('renders without reading the session', () => {
    render(<LoginForm />)

    expect(mockUseSession).not.toHaveBeenCalled()
  })
})
