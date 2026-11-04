/**
 * @jest-environment node
 *
 * Both root layouts give the theme provider the same props from the theme settings: with `allowUserToggle: false`
 * the default mode is forced and the system preference is not tracked. The Cache Components layout passed
 * `enableSystem` and no `forcedTheme` whatever the settings said (#371).
 */
import React from 'react'

let mockSettings = { defaultMode: 'light', allowUserToggle: false, forcedThemeRoutes: undefined as undefined }
const mockThemeProvider = jest.fn()

jest.mock('@nextsparkjs/core/providers/theme-provider', () => ({
  ThemeProvider: (props: Record<string, unknown>) => {
    mockThemeProvider(props)
    return null
  },
}))
jest.mock('@nextsparkjs/core/lib/theme/get-default-theme-mode', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/theme/get-default-theme-mode'),
  getThemeSettings: async () => mockSettings,
}))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ APP_CONFIG_MERGED: { security: {} } }))
jest.mock('next/headers', () => ({ headers: async () => new Headers() }))
jest.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist-sans' }),
  Geist_Mono: () => ({ variable: 'geist-mono' }),
}))
jest.mock('next-intl', () => ({ NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('next-intl/server', () => ({ getMessages: async () => ({}) }))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({ selectMessages: () => ({}), OPTIONAL_ROOT_NAMESPACES: [] }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({
  getBillingResourceHints: async () => ({ preconnect: [], dnsPrefetch: [] }),
}))
jest.mock('@nextsparkjs/core/lib/locale', () => ({ getUserLocale: async () => 'en' }))
jest.mock('@nextsparkjs/core/lib/services/plugin.service', () => ({ PluginService: { initializeAll: async () => {} } }))
jest.mock('@nextsparkjs/core/lib/theme/ThemeProvider', () => ({ ThemeProvider: () => null }))
jest.mock('@nextsparkjs/core/providers/static-intl-provider', () => ({ StaticIntlProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/providers/TranslationContextManager', () => ({ TranslationContextManager: () => null }))
jest.mock('@nextsparkjs/core/components/auth/SessionCookieRefresher', () => ({ SessionCookieRefresher: () => null }))
jest.mock('@nextsparkjs/core/components/consent/LazyConsentManager', () => ({ LazyConsentManager: () => null }))
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({ CONSENT_CONFIG: { enabled: false } }))
jest.mock('@nextsparkjs/registries/root-providers', () => ({ RootQueryProvider: null, RootToaster: null }), { virtual: true })
jest.mock('@nextsparkjs/registries/translation-registry', () => ({
  DEFAULT_LOCALE: 'en', DEFAULT_THEME_MODE: 'system', STATIC_MESSAGES: {},
}), { virtual: true })

import RootLayout from '@/core/routes/layout'
import RootLayoutPpr from '@/core/routes/layout.ppr'

/** Renders the tree down to the theme provider and returns the props it got */
async function themePropsOf(layout: typeof RootLayout): Promise<Record<string, unknown>> {
  mockThemeProvider.mockClear()
  const { renderToStaticMarkup } = jest.requireActual('react-dom/server.node') as typeof import('react-dom/server')
  renderToStaticMarkup(await layout({ children: <main /> }))
  expect(mockThemeProvider).toHaveBeenCalledTimes(1)
  return mockThemeProvider.mock.calls[0][0]
}

describe.each([
  ['default', RootLayout],
  ['Cache Components', RootLayoutPpr],
])('the %s root layout', (_name, layout) => {
  it('forces the default mode and does not track the system preference with allowUserToggle: false', async () => {
    mockSettings = { defaultMode: 'light', allowUserToggle: false, forcedThemeRoutes: undefined }
    expect(await themePropsOf(layout)).toEqual(expect.objectContaining({ defaultTheme: 'light', forcedTheme: 'light', enableSystem: false }))
  })

  it('forces "system" and tracks the system preference with allowUserToggle: false and defaultMode system', async () => {
    mockSettings = { defaultMode: 'system', allowUserToggle: false, forcedThemeRoutes: undefined }
    expect(await themePropsOf(layout)).toEqual(expect.objectContaining({ defaultTheme: 'system', forcedTheme: 'system', enableSystem: true }))
  })

  it('lets the visitor choose, System included, with allowUserToggle: true', async () => {
    mockSettings = { defaultMode: 'light', allowUserToggle: true, forcedThemeRoutes: undefined }
    const props = await themePropsOf(layout)
    expect(props).toEqual(expect.objectContaining({ defaultTheme: 'light', enableSystem: true }))
    expect(props.forcedTheme).toBeUndefined()
  })
})
