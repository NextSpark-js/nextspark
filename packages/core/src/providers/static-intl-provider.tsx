'use client'

/**
 * PPR-compatible IntlProvider
 *
 * Wraps use-intl's IntlProvider directly, bypassing next-intl's server wrapper
 * (NextIntlClientProvider) which accesses headers()/cookies() for `now` and `timeZone`.
 *
 * This allows the root layout to remain fully static for PPR —
 * the static shell (html/body/fonts/content) renders instantly from CDN.
 *
 * Usage in root layout:
 * ```tsx
 * import { StaticIntlProvider } from '@nextsparkjs/core/providers/static-intl-provider'
 * import { getStaticMessages } from '@nextsparkjs/core/lib/translations/static-messages'
 *
 * const messages = getStaticMessages('es')
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html lang="es">
 *       <body>
 *         <StaticIntlProvider locale="es" messages={messages}>
 *           {children}
 *         </StaticIntlProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
import { IntlProvider } from 'use-intl/react'
import type { ReactNode } from 'react'

interface StaticIntlProviderProps {
  locale: string
  messages: Record<string, unknown>
  children: ReactNode
}

export function StaticIntlProvider({ locale, messages, children }: StaticIntlProviderProps) {
  return (
    <IntlProvider locale={locale} messages={messages as never}>
      {children}
    </IntlProvider>
  )
}
