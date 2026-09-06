/**
 * Ambient shim for 'use-intl/react'.
 *
 * use-intl@4.11.0's own type barrel re-exports through relative `.js`
 * specifiers (dist/types/react.d.ts -> ./react/index.js -> ./IntlProvider.js
 * etc.) that this project's `moduleResolution: "bundler"` setup can't
 * resolve end to end, even though every target .d.ts file genuinely exists
 * on disk — an upstream packaging issue, not a NextSpark bug (#131).
 *
 * Declares only what providers/static-intl-provider.tsx actually uses.
 */
declare module 'use-intl/react' {
  import type { ReactNode } from 'react'

  export interface IntlProviderProps {
    locale: string
    messages?: Record<string, unknown>
    children: ReactNode
    now?: Date
    timeZone?: string
    formats?: Record<string, unknown>
    onError?: (error: unknown) => void
    getMessageFallback?: (info: unknown) => string
  }

  export function IntlProvider(props: IntlProviderProps): JSX.Element
}
