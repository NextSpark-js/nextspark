/**
 * @jest-environment node
 *
 * The root layout hands the request nonce to next-themes, so the inline script it
 * writes to apply the stored theme is allowed by a nonce-only `script-src`.
 * The nonce is the one the project's request hook forwards as `x-nonce`.
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
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({ selectMessages: () => ({}) }))
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

// next-themes writes the nonce only where there is no `window`, as on the server (the node environment has none)
async function render(): Promise<string> {
  const tree = await RootLayout({ children: <main>page</main> })
  return renderToStaticMarkup(tree)
}

// next-themes' bootstrap is the only inline script the layout writes
const themeScript = (html: string) => html.match(/<script[^>]*>/)?.[0]

beforeEach(() => {
  mockHeaders.mockClear()
  mockCspNonce = true
})

describe('root layout and the CSP nonce', () => {
  it('with security.cspNonce, puts the x-nonce header on the next-themes bootstrap script', async () => {
    mockNonce = 'abc123'
    expect(themeScript(await render())).toContain('nonce="abc123"')
  })

  it('with security.cspNonce and a request without a nonce, writes the script without one', async () => {
    mockNonce = null
    const script = themeScript(await render())
    expect(script).toBeDefined()
    expect(script).not.toContain('nonce')
  })

  it('without security.cspNonce, reads no request header and writes no nonce, whatever the request carries', async () => {
    mockCspNonce = false
    mockNonce = 'abc123'
    const script = themeScript(await render())
    expect(script).toBeDefined()
    expect(script).not.toContain('nonce')
    expect(mockHeaders).not.toHaveBeenCalled()
  })
})
