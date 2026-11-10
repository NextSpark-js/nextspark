/**
 * /dashboard/settings/profile: the language picker offers every supported locale of the project, each named in its
 * own language, not a fixed en/es pair (#413).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const profile = { language: 'de' } // one stable object: a new one per render would make the form reset loop
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'de' }))
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))
jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({ useAuth: () => ({ signOut: jest.fn() }) }))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile, isLoading: false, error: null }),
}))
jest.mock('@nextsparkjs/core/lib/locale-client', () => ({ setUserLocaleClient: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({
  I18N_CONFIG: { defaultLocale: 'en', supportedLocales: ['en', 'es', 'de', 'pt'] },
}))
// Radix Select does not open in jsdom: list the items it would show
jest.mock('@nextsparkjs/core/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <ul data-testid="languages">{children}</ul>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <li data-value={value}>{children}</li>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}))

import ProfilePage from '../../../src/routes/dashboard/settings/profile/page'

test('lists every supported locale in its own language', () => {
  render(<ProfilePage />)
  const items = Array.from(screen.getAllByTestId('languages')[0].querySelectorAll('li')).map((li) => [li.dataset.value, li.textContent])
  expect(items).toEqual([['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['pt', 'Português']])
})
