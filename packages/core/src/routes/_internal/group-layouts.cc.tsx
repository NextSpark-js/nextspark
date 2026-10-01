import type { ComponentType, ReactNode } from 'react'
import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { connection } from 'next/server'
import { StaticIntlProvider } from '@nextsparkjs/core/providers/static-intl-provider'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-client'
import { getConfiguredClientNamespaces, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import { DEFAULT_LOCALE, STATIC_MESSAGES } from '@nextsparkjs/registries/translation-registry'

/**
 * The message wrappers of the route groups for a host with `cacheComponents` on (the
 * `cacheComponents` variants in ../variants.json name this module as their `compose` module).
 *
 * `getMessages()` reads the request (the locale), and Next refuses a layout that does so outside
 * Suspense while prerendering. Two shapes, by what each group's client components need:
 * - `(auth)`, `(public)` and `devtools` use core and project messages only: the wrapper provides the build-time
 *   `STATIC_MESSAGES` of the default locale, as the PPR root layout does, and stays out of the
 *   dynamic part of the page.
 * - `dashboard` and `superadmin` also need the plugin and entity messages, and the signed-in
 *   user's locale: the wrapper loads them inside a Suspense boundary, so the page's shell is
 *   prerendered and the messages stream in with the request.
 *
 * The static wrappers also put the group's pages behind a Suspense boundary, inside the layout: a page that
 * reads `params`, `searchParams`, cookies or headers (a project's too) then streams in while the layout
 * around it (navbar, footer, sidebar) stays in the prerendered shell. Without one Next fails the build.
 *
 * ISR hosts keep the wrappers of `auth-layout`, `public-layout`, ... (they await `getMessages()`).
 *
 * The guard wrappers of the protected groups live in `superadmin-layout.cc` / `devtools-layout.cc`, not here: the
 * public and auth layouts import this module, and every client component reachable from it (the guards, the dashboard
 * providers, the sidebars) would ship to those routes.
 */
type LayoutProps = { children: ReactNode }
type Layout = ComponentType<LayoutProps>

function staticMessagesWrapper(group: 'auth' | 'public' | 'devtools') {
  return (ResolvedLayout: Layout) =>
    function LayoutWithStaticMessages({ children }: LayoutProps) {
      return (
        <StaticIntlProvider locale={DEFAULT_LOCALE} messages={selectMessages(STATIC_MESSAGES, group)}>
          <ResolvedLayout>
            <Suspense fallback={null}>{children}</Suspense>
          </ResolvedLayout>
        </StaticIntlProvider>
      )
    }
}

/** Renders nothing: declares the area's content request-time, whatever the messages of a fixed-locale app read. */
async function DynamicMarker() {
  await connection()
  return null
}

async function RequestMessages({ group, extraNamespaces, children }: LayoutProps & { group: 'dashboard' | 'superadmin'; extraNamespaces: readonly string[] }) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={selectMessages(messages, group, extraNamespaces)}>
      {children}
    </NextIntlClientProvider>
  )
}

function requestMessagesWrapper(group: 'dashboard' | 'superadmin') {
  return (ResolvedLayout: Layout) =>
    function LayoutWithRequestMessages({ children }: LayoutProps) {
      const configured = getConfiguredClientNamespaces({ entityRegistry: ENTITY_REGISTRY, appConfig: APP_CONFIG_MERGED })
      return (
        <Suspense fallback={null}>
          <Suspense>
            <DynamicMarker />
          </Suspense>
          <RequestMessages group={group} extraNamespaces={configured[group]}>
            <ResolvedLayout>{children}</ResolvedLayout>
          </RequestMessages>
        </Suspense>
      )
    }
}

export const withAuthMessages = staticMessagesWrapper('auth')
export const withPublicMessages = staticMessagesWrapper('public')
export const withDevtoolsMessages = staticMessagesWrapper('devtools')
export const withSuperadminMessages = requestMessagesWrapper('superadmin')
export const withDashboardMessages = requestMessagesWrapper('dashboard')
