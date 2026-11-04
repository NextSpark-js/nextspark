/**
 * @jest-environment jsdom
 *
 * The client copies the account's language to the locale cookie only when
 * i18n.detectionStrategy lets the account pick the locale (#379).
 */
import { renderHook, act } from '@testing-library/react'

let mockI18n: Record<string, unknown> = {}
const mockRefresh = jest.fn()
const mockSignInEmail = jest.fn()

jest.mock('@/core/lib/config/i18n-config-client', () => {
  const detection = jest.requireActual('@/core/lib/config/locale-detection')
  return {
    get I18N_CONFIG() { return mockI18n },
    copiesAccountLocale: () => detection.usesAccountLocale(mockI18n),
  }
})
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }) }))
jest.mock('@nextsparkjs/core/providers/theme-provider', () => ({ useTheme: () => ({ setTheme: jest.fn(), forcedTheme: 'light' }) }))
jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: true, error: null }),
    signIn: { email: (...a: unknown[]) => mockSignInEmail(...a), emailOtp: jest.fn() },
    signOut: jest.fn(),
  },
}))
jest.mock('@/core/hooks/useLastAuthMethod', () => ({ useLastAuthMethod: () => ({ saveAuthMethod: jest.fn() }) }))

import { useAuth } from '@/core/hooks/useAuth'
import { useAccountPreferencesSync } from '@/core/hooks/useAccountPreferencesSync'

const BASE = {
  supportedLocales: ['en', 'es'],
  defaultLocale: 'en',
  cookie: { name: 'locale', maxAge: 365 * 24 * 60 * 60 * 1000, secure: false, sameSite: 'lax', path: '/' },
}

beforeEach(() => {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
  mockRefresh.mockReset()
  mockSignInEmail.mockReset().mockResolvedValue({ data: { user: { id: 'u1', language: 'es' } }, error: null })
  mockI18n = BASE
})

const CASES: Array<[string, Record<string, unknown>, boolean]> = [
  ['unset', BASE, true],
  ['with user_database', { ...BASE, detectionStrategy: ['user_database', 'default'] }, true],
  ['without user_database', { ...BASE, detectionStrategy: ['cookie', 'header', 'default'] }, false],
  ['fixed locale (default only)', { ...BASE, detectionStrategy: ['default'] }, false],
]

describe.each(CASES)('detectionStrategy %s', (_label, config, copies) => {
  test(`useAuth sign-in ${copies ? 'writes' : 'does not write'} the account language to the cookie`, async () => {
    mockI18n = config
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signIn({ email: 'a@example.com', password: 'secret-1234' })
    })
    expect(document.cookie.includes('locale=es')).toBe(copies)
  })

  test(`useAccountPreferencesSync ${copies ? 'writes' : 'does not write'} the cookie`, () => {
    mockI18n = config
    const { result } = renderHook(() => useAccountPreferencesSync())
    act(() => {
      result.current({ data: { user: { id: 'u1', language: 'es' } }, error: null } as never)
    })
    expect(document.cookie.includes('locale=es')).toBe(copies)
    if (!copies) expect(mockRefresh).not.toHaveBeenCalled()
  })
})
