/**
 * The dashboard index and /dashboard/settings/profile paint their heading before the profile loads (#558): the h1 and
 * the static description are the largest text of the page, and they used to wait behind a spinner for /api/user/profile.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const mockProfile: { user: unknown; profile: unknown; isLoading: boolean; error: unknown } = { user: null, profile: null, isLoading: true, error: null }
const mockAuth: { user: { firstName?: string; email: string } | null } = { user: null }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => (values ? `${key}:${values.name}` : key),
  useLocale: () => 'en',
}))
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({ useUserProfile: () => mockProfile }))
jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({ useAuth: () => ({ user: mockAuth.user, signOut: jest.fn() }) }))
jest.mock('@nextsparkjs/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({ DASHBOARD_HOME_CONFIG: undefined }))
jest.mock('@nextsparkjs/core/lib/locale-client', () => ({ setUserLocaleClient: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ I18N_CONFIG: { defaultLocale: 'en', supportedLocales: ['en', 'es'] } }))

import DashboardIndex from '../../../src/routes/dashboard/(main)/page'
import ProfilePage from '../../../src/routes/dashboard/settings/profile/page'

beforeEach(() => {
  mockProfile.user = null
  mockProfile.profile = null
  mockProfile.isLoading = true
  mockAuth.user = null
})

test('the dashboard heading is there while the profile loads, with the spinner behind it', () => {
  const { container } = render(<DashboardIndex />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('title')
  expect(container.querySelector('.animate-spin')).not.toBeNull()
  expect(screen.queryByText('stats.accountStatus')).toBeNull()
})

test('the dashboard greeting uses the session user until the profile arrives', () => {
  mockAuth.user = { firstName: 'Dev', email: 'dev@example.com' }
  render(<DashboardIndex />)
  expect(screen.getByText('welcome:Dev')).not.toBeNull()
})

test('the profile heading and description are there while the profile loads', () => {
  const { container } = render(<ProfilePage />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('profile.title')
  expect(screen.getByText('profile.description')).not.toBeNull()
  expect(container.querySelector('[role="status"]')).not.toBeNull()
  expect(screen.queryByLabelText('profile.form.firstName')).toBeNull()
})
