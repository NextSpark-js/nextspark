/** @jest-environment jsdom */
/**
 * The reset-password page offers "request a new reset" when the link is what failed: no token in the URL, or the
 * server's own answer for an expired or used link ("Invalid token"). A wrong-password error does not offer it.
 */
import { describe, expect, jest, test } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let token = ''
const updatePassword = jest.fn<(password: string, token: string) => Promise<{ success: boolean; error?: string }>>()

jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({ useAuthActions: () => ({ updatePassword }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(token ? `token=${token}` : '') }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))
jest.mock('@nextsparkjs/core/selectors/auth', () => ({ sel: (path: string) => path }))

import ResetPasswordPage from '@/app/(auth)/reset-password/page'

const PASSWORD = 'NewPassw0rd!xyz'

async function submit() {
  fireEvent.change(document.getElementById('password')!, { target: { value: PASSWORD } })
  fireEvent.change(document.getElementById('confirmPassword')!, { target: { value: PASSWORD } })
  fireEvent.submit(document.querySelector('form')!)
}

describe('reset-password: the link to request a new reset', () => {
  test('is offered when the URL has no token', () => {
    token = ''
    render(<ResetPasswordPage />)
    expect(screen.getByText('requestNew')).toBeTruthy()
  })

  test("is offered when the server answers 'Invalid token' (an expired or used link)", async () => {
    token = 'abc'
    updatePassword.mockResolvedValue({ success: false, error: 'Invalid token' })
    render(<ResetPasswordPage />)
    expect(screen.queryByText('requestNew')).toBeNull()
    await submit()
    await waitFor(() => expect(screen.getByText('requestNew')).toBeTruthy())
  })

  test('is not offered for an error that is not about the link', async () => {
    token = 'abc'
    updatePassword.mockResolvedValue({ success: false, error: 'Password is too common' })
    render(<ResetPasswordPage />)
    await submit()
    await waitFor(() => expect(screen.getByText('Password is too common')).toBeTruthy())
    expect(screen.queryByText('requestNew')).toBeNull()
  })
})
