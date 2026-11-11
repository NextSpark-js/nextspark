'use client'

/**
 * Says which namespace an area is missing when a client component's key renders as itself (#427).
 *
 * Each area (auth, public, dashboard, superadmin, devtools) sends its client components only its own namespaces
 * (`selectMessages`), plus those a project lists in `i18n.clientNamespaces`. A project component that reads another
 * one shows `namespace.key` in the page, and next-intl's own error does not say why. This provider re-provides the
 * area's context (messages, time zone and error handler are inherited) with a message fallback that warns, once
 * per area and namespace, naming the key and the config entry to add (or, when the namespace is there, the key it lacks).
 *
 * It warns in development, and on the server in production too: a page prerendered by `next build` (the static
 * `(auth)` and `(public)` pages) prints the warning in the build output, before anything is deployed. The fallback
 * text is next-intl's default (`namespace.key`) either way.
 */
import { IntlProvider, useLocale, useMessages } from 'use-intl/react'
import { useCallback, type ReactNode } from 'react'

export type MessagesArea = 'auth' | 'public' | 'dashboard' | 'superadmin' | 'devtools'
type FallbackInfo = { error: { code: string }; key: string; namespace?: string }

const warned = new Set<string>()

/**
 * Why a key renders as itself in an area: its namespace is not among the area's messages (`namespace`), or the
 * namespace is there and the key is not (`key`: a catalog without it, or a project layout that extends the group
 * with a namespace that lacks it). Null for any other error.
 */
export function missingMessage(messages: Record<string, unknown>, { error, key, namespace }: FallbackInfo) {
  if (error.code !== 'MISSING_MESSAGE') return null
  const path = namespace ? `${namespace}.${key}` : key
  const top = path.split('.', 1)[0]
  return { path, namespace: top, missing: top in messages ? 'key' as const : 'namespace' as const }
}

/** In production the browser never warns; the server does, so `next build` prints it for the pages it prerenders. */
export function reportsHere() {
  return process.env.NODE_ENV !== 'production' || typeof window === 'undefined'
}

export function AreaMessagesCheck({ area, children }: { area: MessagesArea; children: ReactNode }) {
  const locale = useLocale()
  const messages = useMessages()
  // Stable while the area and its messages are, so the IntlProvider below keeps its memoized context
  const getMessageFallback = useCallback((info: FallbackInfo) => {
    const found = reportsHere() ? missingMessage(messages, info) : null
    const once = found && `${area}:${found.missing === 'key' ? `${locale}:${found.path}` : found.namespace}`
    if (found && once && !warned.has(once)) {
      warned.add(once)
      console.warn(found.missing === 'namespace'
        ? `[nextspark i18n] "${found.path}" renders as its key in the ${area} area: its client messages have no "${found.namespace}" namespace. ` +
          `List it in i18n.clientNamespaces.${area} (config/app.config.ts), and check that the project's messages define it.`
        : `[nextspark i18n] "${found.path}" renders as its key in the ${area} area: the "${found.namespace}" namespace is there, but this key is missing ` +
          `from it in the "${locale}" messages. Add the key to that catalog.`)
    }
    return info.namespace ? `${info.namespace}.${info.key}` : info.key
  }, [messages, area, locale])
  return <IntlProvider locale={locale} getMessageFallback={getMessageFallback}>{children}</IntlProvider>
}
