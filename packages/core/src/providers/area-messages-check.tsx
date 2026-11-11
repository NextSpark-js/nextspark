'use client'

/**
 * Says which namespace an area is missing when a client component's key renders as itself (#427).
 *
 * Each area (auth, public, dashboard, superadmin, devtools) sends its client components only its own namespaces
 * (`selectMessages`), plus those a project lists in `i18n.clientNamespaces`. A project component that reads another
 * one shows `namespace.key` in the page, and next-intl's own error does not say why. This provider re-provides the
 * area's context (messages, time zone and error handler are inherited) with a message fallback that warns, once
 * per area and namespace, naming the key and the config entry to add.
 *
 * It warns in development, and on the server in production too: a page prerendered by `next build` (the static
 * `(auth)` and `(public)` pages) prints the warning in the build output, before anything is deployed. The fallback
 * text is next-intl's default (`namespace.key`) either way.
 */
import { IntlProvider, useLocale, useMessages } from 'use-intl/react'
import type { ReactNode } from 'react'

export type MessagesArea = 'auth' | 'public' | 'dashboard' | 'superadmin' | 'devtools'
type FallbackInfo = { error: { code: string }; key: string; namespace?: string }

const warned = new Set<string>()

/**
 * The namespace that a key rendering as itself is missing from the area's messages, with the key's full path; null
 * when the key has another cause (a key missing in a namespace the area has is next-intl's own error).
 */
export function missingNamespace(messages: Record<string, unknown>, { error, key, namespace }: FallbackInfo) {
  if (error.code !== 'MISSING_MESSAGE') return null
  const path = namespace ? `${namespace}.${key}` : key
  const top = path.split('.', 1)[0]
  return top in messages ? null : { path, namespace: top }
}

function reportsHere() {
  return process.env.NODE_ENV !== 'production' || typeof window === 'undefined'
}

export function AreaMessagesCheck({ area, children }: { area: MessagesArea; children: ReactNode }) {
  const locale = useLocale()
  const messages = useMessages()
  const getMessageFallback = (info: FallbackInfo) => {
    const missing = reportsHere() ? missingNamespace(messages, info) : null
    if (missing && !warned.has(`${area}:${missing.namespace}`)) {
      warned.add(`${area}:${missing.namespace}`)
      console.warn(
        `[nextspark i18n] "${missing.path}" renders as its key in the ${area} area: its client messages have no "${missing.namespace}" namespace. ` +
        `List it in i18n.clientNamespaces.${area} (config/app.config.ts), and check that the project's messages define it.`,
      )
    }
    return info.namespace ? `${info.namespace}.${info.key}` : info.key
  }
  return <IntlProvider locale={locale} getMessageFallback={getMessageFallback}>{children}</IntlProvider>
}
