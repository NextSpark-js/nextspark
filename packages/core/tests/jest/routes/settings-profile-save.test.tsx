/**
 * /dashboard/settings/profile: an account that never chose a country or a timezone (every account a sign-up creates)
 * saves a name change. The form required both, so Update Profile sent nothing and only showed
 * "Please select a country" and "Please select a timezone" (#433).
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const saved: unknown[] = []
// one stable object: a new one per render would make the form reset loop
const profile = { firstName: '', lastName: '', country: null, timezone: null, language: 'en', email: 'new@example.com', createdAt: '2026-01-01' }
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: async (data: unknown) => { saved.push(data) }, isPending: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))
jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({ useAuth: () => ({ signOut: jest.fn() }) }))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile, isLoading: false, error: null }),
}))
jest.mock('@nextsparkjs/core/lib/locale-client', () => ({ setUserLocaleClient: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({
  I18N_CONFIG: { defaultLocale: 'en', supportedLocales: ['en', 'es'] },
}))

import ProfilePage from '../../../src/routes/dashboard/settings/profile/page'

test('a name change saves without a country or a timezone', async () => {
  const user = userEvent.setup()
  render(<ProfilePage />)
  await user.type(screen.getByLabelText('profile.form.firstName'), 'Ana')
  await user.type(screen.getByLabelText('profile.form.lastName'), 'Pérez')
  await user.click(screen.getByRole('button', { name: 'profile.form.updateButton' }))
  await waitFor(() => expect(saved).toEqual([{ firstName: 'Ana', lastName: 'Pérez', country: '', timezone: '', language: 'en' }]))
})
