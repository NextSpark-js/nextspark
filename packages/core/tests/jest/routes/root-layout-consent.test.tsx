/**
 * @jest-environment node
 *
 * The root layout renders the cookie consent banner and loaders (#272) only when `consent.enabled` is on,
 * hands them the request nonce, and adds the `consent` messages only then.
 */
import { TextEncoder } from 'node:util'

// The Node build of react-dom/server needs no browser globals beyond this one
Object.assign(globalThis, { TextEncoder })
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server.node') as typeof import('react-dom/server')

let mockNonce: string | null = null
let mockCspNonce = true
const mockHeaders = jest.fn(async () => new Headers(mockNonce ? { 'x-nonce': mockNonce } : {}))

jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({
  get APP_CONFIG_MERGED() {
    return { security: { cspNonce: mockCspNonce } }
  },
}))

jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))
jest.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist-sans' }),
  Geist_Mono: () => ({ variable: 'geist-mono' }),
}))
jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('next-intl/server', () => ({ getMessages: async () => ({}) }))
const mockSelectMessages = jest.fn((..._args: unknown[]) => ({}))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({
  OPTIONAL_ROOT_NAMESPACES: ['consent'],
  selectMessages: (...args: unknown[]) => mockSelectMessages(...args),
}))
let mockConsentEnabled = true
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({
  get CONSENT_CONFIG() {
    return { enabled: mockConsentEnabled }
  },
}))
jest.mock('@nextsparkjs/core/components/consent/LazyConsentManager', () => ({
  LazyConsentManager: ({ nonce }: { nonce?: string }) => <aside data-consent="banner" data-nonce={nonce ?? ''} />,
}))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({
  getBillingResourceHints: async () => ({ preconnect: [], dnsPrefetch: [] }),
}))
jest.mock('@nextsparkjs/core/lib/locale', () => ({ getUserLocale: async () => 'en' }))
jest.mock('@nextsparkjs/core/lib/theme/get-default-theme-mode', () => ({
  getThemeSettings: async () => ({ defaultMode: 'light', allowUserToggle: true, forcedThemeRoutes: undefined }),
}))
jest.mock('@nextsparkjs/core/lib/services/plugin.service', () => ({
  PluginService: { initializeAll: async () => {} },
}))
jest.mock('@nextsparkjs/core/lib/theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@nextsparkjs/core/components/ui/sonner', () => ({ Toaster: () => null }))
jest.mock('@nextsparkjs/core/providers/query-provider', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@nextsparkjs/core/providers/TranslationContextManager', () => ({ TranslationContextManager: () => null }))
jest.mock('@nextsparkjs/core/components/auth/SessionCookieRefresher', () => ({ SessionCookieRefresher: () => null }))
jest.mock('next/navigation', () => ({ usePathname: () => '/' }))

import RootLayout from '@/core/routes/layout'

async function render(): Promise<string> {
  return renderToStaticMarkup(await RootLayout({ children: <main>page</main> }))
}

beforeEach(() => {
  mockConsentEnabled = true
  mockCspNonce = true
  mockNonce = 'abc123'
  mockSelectMessages.mockClear()
})

describe('root layout and cookie consent', () => {
  it('renders the consent manager with the request nonce when consent is enabled', async () => {
    expect(await render()).toContain('<aside data-consent="banner" data-nonce="abc123"></aside>')
  })

  it('renders it without a nonce when the nonce policy is off', async () => {
    mockCspNonce = false
    expect(await render()).toContain('data-nonce=""')
  })

  it('adds the consent messages to the root group only when consent is enabled', async () => {
    await render()
    expect(mockSelectMessages).toHaveBeenCalledWith({}, 'root', ['consent'])
    mockSelectMessages.mockClear()
    mockConsentEnabled = false
    await render()
    expect(mockSelectMessages).toHaveBeenCalledWith({}, 'root', [])
  })

  it('renders nothing of it when consent is off, the default', async () => {
    mockConsentEnabled = false
    expect(await render()).not.toContain('data-consent')
  })
})
