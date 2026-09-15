/**
 * setUserLocale — the locale cookie is written readable whatever the config
 * says: client code keeps rewriting it (a language switch, a sign-in, the
 * account's language), and a script cannot replace a cookie written HttpOnly.
 */
import { describe, test, expect, jest } from '@jest/globals'

const mockSet = jest.fn()
jest.mock('next/headers', () => ({
  cookies: async () => ({ set: mockSet }),
  headers: async () => ({ get: () => null }),
}))

jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))

jest.mock('@/core/lib/config', () => ({
  I18N_CONFIG: {
    supportedLocales: ['en', 'es'],
    defaultLocale: 'en',
    cookie: { name: 'locale', maxAge: 1000, httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
  },
}))

import { setUserLocale } from '@/core/lib/locale'

describe('setUserLocale', () => {
  test('writes a cookie scripts can replace, even with httpOnly in the config', async () => {
    await setUserLocale('es')

    expect(mockSet).toHaveBeenCalledWith('locale', 'es', expect.objectContaining({ httpOnly: false, sameSite: 'lax', path: '/' }))
  })
})
