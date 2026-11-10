import type { ComponentType, ReactNode } from 'react'
import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { connection } from 'next/server'
import { StaticIntlProvider } from '@nextsparkjs/core/providers/static-intl-provider'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-client'
import { checkRequestLocale, isLocaleFixedFor } from '@nextsparkjs/core/lib/config/locale-detection'
import { getConfiguredClientNamespaces, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import { REQUEST_LOCALE_AUTH, REQUEST_LOCALE_PUBLIC } from '@nextsparkjs/registries/request-locale'
import { DEFAULT_LOCALE, STATIC_MESSAGES } from '@nextsparkjs/registries/translation-registry'

/**
 * The message wrappers of the route groups for a host with `cacheComponents` on (the
 * `cacheComponents` variants in ../variants.json name this module as their `compose` module).
 *
 * `getMessages()` reads the request (the locale), and Next refuses a layout that does so outside
 * Suspense while prerendering. Two shapes, by what each group's client components need:
 * - `(auth)` and `(public)` use core and project messages only: the wrapper provides the build-time
 *   `STATIC_MESSAGES` of the default locale, as the PPR root layout does, and stays out of the
 *   dynamic part of the page.
 * - `dashboard` and `superadmin` also need the plugin and entity messages, and the signed-in
 *   user's locale: the wrapper loads them inside a Suspense boundary, so the page's shell is
 *   prerendered and the messages stream in with the request.
 * - `devtools` (development only) loads the request's messages like those two, with core and project messages only, so
 *   its client components speak the user's language (#414).
 *
 * `i18n.requestLocale` turns `(auth)` and `(public)` to the second shape (the registry holds the setting as a literal,
 * so a project that leaves it off keeps the static wrappers and their prerender): the group's messages are those of the
 * request's locale, and its content sits in a `<div lang>` of that locale, since `<html lang>` stays the default's. The
 * setting has no effect when the app's locale is fixed.
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

/**
 * The wrappers hand every prop to the layout they wrap: `children`, and the parallel route slots a project layout declares
 * (`@modal` -> `modal`). Only `children` is put behind a Suspense boundary here; a slot that reads request data has its own.
 */
function staticMessagesWrapper(group: 'auth' | 'public') {
  return <P extends LayoutProps>(ResolvedLayout: ComponentType<P>) =>
    function LayoutWithStaticMessages(props: P) {
      return (
        <StaticIntlProvider locale={DEFAULT_LOCALE} messages={selectMessages(STATIC_MESSAGES, group)}>
          <ResolvedLayout {...props}>
            <Suspense fallback={null}>{props.children}</Suspense>
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

async function RequestMessages({ group, extraNamespaces, markLanguage, children }: LayoutProps & { group: 'auth' | 'public' | 'devtools' | 'dashboard' | 'superadmin'; extraNamespaces: readonly string[]; markLanguage?: boolean }) {
  const messages = await getMessages()
  const provider = (
    <NextIntlClientProvider messages={selectMessages(messages, group, extraNamespaces)}>
      {children}
    </NextIntlClientProvider>
  )
  if (!markLanguage) return provider
  // `display: contents`: the element takes no part in the layout of the group's pages
  return <div lang={await getLocale()} style={{ display: 'contents' }}>{provider}</div>
}

function requestMessagesWrapper(group: 'auth' | 'public' | 'devtools' | 'dashboard' | 'superadmin') {
  return <P extends LayoutProps>(ResolvedLayout: ComponentType<P>) =>
    function LayoutWithRequestMessages(props: P) {
      const configured = getConfiguredClientNamespaces({ entityRegistry: ENTITY_REGISTRY, appConfig: APP_CONFIG_MERGED })
      const toRequest = group === 'auth' || group === 'public'
      // `devtools` has no plugin or entity namespaces: core and project messages only, as in the ISR module
      const extra = group === 'dashboard' || group === 'superadmin' ? configured[group] : []
      return (
        <Suspense fallback={null}>
          <Suspense>
            <DynamicMarker />
          </Suspense>
          <RequestMessages group={group} extraNamespaces={extra} markLanguage={toRequest}>
            <ResolvedLayout {...props} />
          </RequestMessages>
        </Suspense>
      )
    }
}

/**
 * The wrapper of `(auth)` or `(public)` once `i18n.requestLocale` has turned it on (the registry's literal): the request's
 * locale, or the default locale's static messages when the app's locale is fixed, as it would be without the setting.
 */
function requestOrStaticWrapper(group: 'auth' | 'public') {
  return isLocaleFixedFor(APP_CONFIG_MERGED.i18n) ? staticMessagesWrapper(group) : requestMessagesWrapper(group)
}

checkRequestLocale(APP_CONFIG_MERGED.i18n, { auth: REQUEST_LOCALE_AUTH, public: REQUEST_LOCALE_PUBLIC })

export const withAuthMessages = REQUEST_LOCALE_AUTH ? requestOrStaticWrapper('auth') : staticMessagesWrapper('auth')
export const withPublicMessages = REQUEST_LOCALE_PUBLIC ? requestOrStaticWrapper('public') : staticMessagesWrapper('public')
export const withDevtoolsMessages = requestMessagesWrapper('devtools')
export const withSuperadminMessages = requestMessagesWrapper('superadmin')
export const withDashboardMessages = requestMessagesWrapper('dashboard')
