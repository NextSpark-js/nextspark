/**
 * Root layout (default, non-PPR). The host's app/layout imports the project's
 * globals.css beside it; see layout.ppr.tsx for the Cache Components variant.
 */

import type { Metadata } from "next"
import { Suspense } from "react"
import { headers } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { OPTIONAL_ROOT_NAMESPACES, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'

import { getBillingResourceHints } from "@nextsparkjs/core/lib/billing/gateways/factory"
import { ThemeProvider as NextThemeProvider } from "@nextsparkjs/core/providers/theme-provider"
import { ThemeProvider as CustomThemeProvider } from "@nextsparkjs/core/lib/theme/ThemeProvider"
import { Toaster } from "@nextsparkjs/core/components/ui/sonner"
import { QueryProvider } from "@nextsparkjs/core/providers/query-provider"
import { CONSENT_CONFIG, ROOT_PROVIDERS } from "@nextsparkjs/core/lib/config/public-config-client"
import { LazyConsentManager } from "@nextsparkjs/core/components/consent/LazyConsentManager"
import { getUserLocale } from '@nextsparkjs/core/lib/locale'
import { TranslationContextManager } from "@nextsparkjs/core/providers/TranslationContextManager"
import { SessionCookieRefresher } from "@nextsparkjs/core/components/auth/SessionCookieRefresher"
import { PluginService } from '@nextsparkjs/core/lib/services/plugin.service'
import { APP_CONFIG_MERGED } from "@nextsparkjs/core/lib/config/config-client"
import { getThemeSettings } from '@nextsparkjs/core/lib/theme/get-default-theme-mode'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
})

const defaultMetadata: Metadata = {
  title: "NextSpark App",
  description: "Built with NextSpark",
}

export const metadata: Metadata = defaultMetadata

// `security.cspNonce: true` in app.config opts the root layout into reading the request's nonce: a read of
// the request headers makes every page under it render per request, so it is off unless asked for
// (the config is a build-time constant)
const cspNonceEnabled = () => APP_CONFIG_MERGED.security?.cspNonce === true

let pluginsInitialized = false

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (!pluginsInitialized) {
    await PluginService.initializeAll()
    pluginsInitialized = true
  }

  const locale = await getUserLocale()
  const messages = await getMessages({ locale })
  const { defaultMode, allowUserToggle, forcedThemeRoutes } = await getThemeSettings()
  const billingHints = await getBillingResourceHints()
  // The nonce the project's request hook forwards (config/hooks/proxy.ts sets `x-nonce`): the inline script
  // next-themes writes to apply the stored theme before paint carries it, so a nonce-only `script-src` does
  // not block it. Without the flag, or without a nonce, nothing changes.
  const nonce = cspNonceEnabled() ? ((await headers()).get('x-nonce') ?? undefined) : undefined

  const content = (
    <>
      <TranslationContextManager />
      {/* Real session-cookie renewal for installed PWAs: the render-time
          session reads above (getUserLocale/getThemeSettings) cannot
          write cookies, so the rolling refresh is triggered from the
          client through the auth Route Handler instead. */}
      <SessionCookieRefresher />
      {children}
      {ROOT_PROVIDERS && <Suspense><Toaster position="bottom-left" /></Suspense>}
      {/* Cookie consent (#272): the banner and the analytics loaders, which load their script with this nonce */}
      {CONSENT_CONFIG.enabled && <LazyConsentManager nonce={nonce} />}
    </>
  )

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {billingHints.preconnect.map((domain) => (
          <link key={`pre-${domain}`} rel="preconnect" href={domain} />
        ))}
        {[...billingHints.preconnect, ...billingHints.dnsPrefetch].map((domain) => (
          <link key={`dns-${domain}`} rel="dns-prefetch" href={domain} />
        ))}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={selectMessages(messages, 'root', CONSENT_CONFIG.enabled ? OPTIONAL_ROOT_NAMESPACES : [])}>
          <NextThemeProvider
            nonce={nonce}
            attribute="class"
            defaultTheme={defaultMode}
            // When allowUserToggle is false, force the theme and ignore localStorage/system
            forcedTheme={!allowUserToggle ? defaultMode : undefined}
            // Detect OS preference whenever the user can toggle at all. ThemeToggle
            // always offers "System" as one of its 3 choices when toggling is
            // allowed, so the provider must be able to resolve it whenever that's
            // true — gating on `defaultMode === 'system'` looks equivalent at
            // first render, but defaultMode is the user's last SAVED preference
            // for a logged-in user (see getThemeSettings), not a static "is
            // system-matching enabled" flag. That made "System" silently write a
            // literal, unmatched `class="system"` for anyone whose saved
            // preference (or the theme's own config default) wasn't already
            // 'system' — see #175.
            enableSystem={allowUserToggle}
            // Force a theme on the routes declared in theme.config.ts (forcedThemeRoutes)
            forcedThemeRoutes={forcedThemeRoutes}
            disableTransitionOnChange
          >
            <CustomThemeProvider>
              {/* TeamProvider and SubscriptionProvider are mounted by DashboardProviders in the
                  dashboard, superadmin and devtools layouts, not here: on a public page they
                  would fetch a signed-in visitor's teams and subscription and re-sync the
                  activeTeamId cookie for nothing. */}
              {/* `providers.scope: 'groups'` leaves React Query and the toaster to the route groups (GroupProviders);
                  the default mounts them here for every route. */}
              {ROOT_PROVIDERS ? <QueryProvider>{content}</QueryProvider> : content}
            </CustomThemeProvider>
          </NextThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
