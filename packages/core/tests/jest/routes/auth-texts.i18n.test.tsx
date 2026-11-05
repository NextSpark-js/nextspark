/**
 * @jest-environment jsdom
 *
 * #401: the metadata of the (auth) pages and the line of the default auth layout come from the core messages, in the
 * language the group renders in: the default locale's unless `i18n.requestLocale.auth` is on (the request's then).
 */
let mockInDefaultLocale = true
const mockGetTranslations = jest.fn()

// The mock reads the real core catalog; a request with no explicit locale is the visitor's, here Spanish
jest.mock('next-intl/server', () => {
  const real = jest.requireActual('../__mocks__/next-intl-server.js') as { getTranslations: (arg: unknown) => unknown }
  return {
    getTranslations: (arg: unknown) => {
      mockGetTranslations(arg)
      return real.getTranslations(typeof arg === 'string' ? { locale: 'es', namespace: arg } : arg)
    },
  }
})
jest.mock('@nextsparkjs/registries/request-locale', () => ({ get AUTH_IN_DEFAULT_LOCALE() { return mockInDefaultLocale } }))
jest.mock('../../../src/lib/config', () => ({ I18N_CONFIG: { defaultLocale: 'fr' } }))
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({ APP_NAME: 'App', APP_DESCRIPTION: 'Desc' }))
jest.mock('@nextsparkjs/core/components/auth/layouts/AuthWrapper', () => ({
  AuthWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@nextsparkjs/core/components/auth/forms/LoginForm', () => ({ LoginForm: () => null }))
jest.mock('@nextsparkjs/core/components/auth/forms/SignupForm', () => ({ SignupForm: () => null }))
jest.mock('@nextsparkjs/core/components/auth/pages/AuthErrorPage', () => ({ AuthErrorPage: () => null }))
jest.mock('@nextsparkjs/core/lib/services', () => ({ TeamService: {} }))
jest.mock('@nextsparkjs/core/providers/group-toaster', () => ({ GroupToaster: () => null }))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({ selectMessages: () => ({}) }))

import { render, screen } from '@testing-library/react'
import { generateMetadata as loginMetadata } from '@/core/routes/(auth)/login/page'
import { generateMetadata as signupMetadata } from '@/core/routes/(auth)/signup/page'
import { generateMetadata as errorMetadata } from '@/core/routes/(auth)/auth-error/page'
import { generateMetadata as layoutMetadata } from '@/core/routes/_internal/auth-layout'
import { DefaultAuthLayout } from '@/core/routes/_internal/default-auth-layout'
import fr from '@/core/messages/fr/index'
import es from '@/core/messages/es/index'

beforeEach(() => mockGetTranslations.mockClear())

describe('while the auth group keeps the default locale (the flag off, Cache Components)', () => {
  beforeEach(() => { mockInDefaultLocale = true })

  it('the metadata of /login is in the default locale, asked for by name so nothing reads the request', async () => {
    expect(await loginMetadata()).toEqual({ title: fr.auth.login.title, description: fr.auth.login.description })
    expect(mockGetTranslations).toHaveBeenCalledWith({ locale: 'fr', namespace: 'auth' })
  })

  it('the metadata of the other pages and of the layout is too', async () => {
    expect(await signupMetadata()).toEqual({ title: fr.auth.signup.title, description: fr.auth.signup.description })
    expect(await errorMetadata()).toEqual({ title: fr.auth.error.generic.title, description: fr.auth.error.generic.description })
    const layout = await layoutMetadata()
    expect(layout.description).toBe(fr.auth.metadata.description)
    expect(layout.title).toEqual({ default: `${fr.auth.metadata.title} | App`, template: '%s | App' })
  })

  it('the line under the form is in the default locale', async () => {
    render(await DefaultAuthLayout({ children: <p>form</p> }))
    expect(screen.getByText(fr.auth.layout.protected)).toBeTruthy()
    expect(screen.queryByText('Protected with enterprise-grade encryption')).toBeNull()
  })
})

describe("with requestLocale.auth on, or a host that reads the request anyway", () => {
  beforeEach(() => { mockInDefaultLocale = false })

  it("the metadata and the line follow the request's locale", async () => {
    expect(await loginMetadata()).toEqual({ title: es.auth.login.title, description: es.auth.login.description })
    expect(mockGetTranslations).toHaveBeenCalledWith('auth')
    render(await DefaultAuthLayout({ children: <p>form</p> }))
    expect(screen.getByText(es.auth.layout.protected)).toBeTruthy()
  })
})
