/**
 * @jest-environment node
 *
 * Both root layouts mount the Toaster with the "notifications" label of the messages they hold, so a screen reader
 * announces it in the app's language and not Sonner's English default (#396).
 */
import React from 'react'

const mockToaster = jest.fn()
const catalog = { common: { notifications: { title: 'Avisos' } } }

jest.mock('@nextsparkjs/core/providers/theme-provider', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/lib/theme/get-default-theme-mode', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/theme/get-default-theme-mode'),
  getThemeSettings: async () => ({ defaultMode: 'light', allowUserToggle: true, forcedThemeRoutes: undefined }),
}))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ APP_CONFIG_MERGED: { security: {} } }))
jest.mock('next/headers', () => ({ headers: async () => new Headers() }))
jest.mock('geist/font/sans', () => ({ GeistSans: { variable: 'geist-sans' } }))
jest.mock('geist/font/mono', () => ({ GeistMono: { variable: 'geist-mono' } }))
jest.mock('next-intl', () => ({ NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('next-intl/server', () => ({ getMessages: async () => catalog }))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({ selectMessages: () => ({}), OPTIONAL_ROOT_NAMESPACES: [] }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({
  getBillingResourceHints: async () => ({ preconnect: [], dnsPrefetch: [] }),
}))
jest.mock('@nextsparkjs/core/lib/locale', () => ({ getUserLocale: async () => 'es' }))
jest.mock('@nextsparkjs/core/lib/services/plugin.service', () => ({ PluginService: { initializeAll: async () => {} } }))
jest.mock('@nextsparkjs/core/lib/theme/ThemeProvider', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/providers/static-intl-provider', () => ({ StaticIntlProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/providers/TranslationContextManager', () => ({ TranslationContextManager: () => null }))
jest.mock('@nextsparkjs/core/components/auth/SessionCookieRefresher', () => ({ SessionCookieRefresher: () => null }))
jest.mock('@nextsparkjs/core/components/consent/LazyConsentManager', () => ({ LazyConsentManager: () => null }))
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({ CONSENT_CONFIG: { enabled: false } }))
jest.mock('@nextsparkjs/registries/root-providers', () => ({
  RootQueryProvider: null,
  RootToaster: (props: Record<string, unknown>) => {
    mockToaster(props)
    return null
  },
}), { virtual: true })
jest.mock('@nextsparkjs/registries/translation-registry', () => ({
  DEFAULT_LOCALE: 'es', DEFAULT_THEME_MODE: 'system', STATIC_MESSAGES: catalog,
}), { virtual: true })

import RootLayout from '@/core/routes/layout'
import RootLayoutPpr from '@/core/routes/layout.ppr'

describe.each([
  ['default', RootLayout],
  ['Cache Components', RootLayoutPpr],
])('the %s root layout', (_name, layout) => {
  it("mounts the Toaster with the label of the messages it holds", async () => {
    mockToaster.mockClear()
    const { renderToStaticMarkup } = jest.requireActual('react-dom/server.node') as typeof import('react-dom/server')
    renderToStaticMarkup(await layout({ children: <main /> }))
    expect(mockToaster).toHaveBeenCalledTimes(1)
    expect(mockToaster.mock.calls[0][0]).toEqual(expect.objectContaining({ containerAriaLabel: 'Avisos' }))
  })
})
