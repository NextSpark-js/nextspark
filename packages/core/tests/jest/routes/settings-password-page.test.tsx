/**
 * /dashboard/settings/password: the page never redirects to /login itself (AuthenticatedDashboardLayout does,
 * and useAuth reports user: null while the session loads); a user without a password goes to the profile
 * from an effect, never while rendering (router.push in render reads `location` during prerender).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const push = jest.fn()
const useAuth = jest.fn()
const useUserProfile = jest.fn()

const router = { push } // one stable object, like next's router
jest.mock('next/navigation', () => ({ useRouter: () => router }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({ useAuth: () => useAuth() }))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({ useUserProfile: () => useUserProfile() }))

import UpdatePasswordPage from '../../../src/routes/dashboard/settings/password/page'

const user = { id: 'u1', email: 'a@b.c' }

beforeEach(() => {
  push.mockClear()
  useAuth.mockReturnValue({ changePassword: jest.fn(), user })
  useUserProfile.mockReturnValue({ hasPassword: true, isLoading: false })
})

test('session loading: spinner, no redirect', () => {
  useAuth.mockReturnValue({ changePassword: jest.fn(), user: null })
  useUserProfile.mockReturnValue({ hasPassword: false, isLoading: true })
  const { container } = render(<UpdatePasswordPage />)
  expect(container.querySelector('.animate-spin')).not.toBeNull()
  expect(push).not.toHaveBeenCalled()
})

test('no session: renders nothing and does not redirect (the layout sends to /login)', () => {
  useAuth.mockReturnValue({ changePassword: jest.fn(), user: null })
  const { container } = render(<UpdatePasswordPage />)
  expect(container).toBeEmptyDOMElement()
  expect(push).not.toHaveBeenCalled()
})

test('account without a password: no form, redirects to the profile', () => {
  useUserProfile.mockReturnValue({ hasPassword: false, isLoading: false })
  const { container } = render(<UpdatePasswordPage />)
  expect(container.querySelector('form')).toBeNull()
  expect(push).toHaveBeenCalledTimes(1)
  expect(push).toHaveBeenCalledWith('/dashboard/settings/profile')
})

test('profile loading: spinner, no redirect', () => {
  useUserProfile.mockReturnValue({ hasPassword: false, isLoading: true })
  const { container } = render(<UpdatePasswordPage />)
  expect(container.querySelector('.animate-spin')).not.toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(push).not.toHaveBeenCalled()
})

test('account with a password: the form, no redirect', () => {
  const { container } = render(<UpdatePasswordPage />)
  expect(container.querySelector('form')).not.toBeNull()
  expect(push).not.toHaveBeenCalled()
})
