import type { ComponentType } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { APP_NAME } from '@nextsparkjs/core/lib/config/public-config-client'

export const defaultMetadata: Metadata = {
  title: {
    default: `Authentication | ${APP_NAME}`,
    template: `%s | ${APP_NAME}`,
  },
  description: 'Sign in or create an account to access our platform',
  robots: {
    index: false,
    follow: false,
  },
}

/**
 * The metadata a project's override of this layout keeps when it declares none (the generated host forwards it from
 * this module, the composition module of the ISR host, so the override's route does not import DefaultAuthLayout).
 */
export const metadata: Metadata = defaultMetadata

/**
 * Wraps a layout for this route group in the group's client messages. The route's
 * default is `withAuthMessages(DefaultAuthLayout)` (./default-auth-layout); a host that resolves a project override of the
 * layout wraps that instead, so the override gets the same messages.
 */
export function withAuthMessages(AuthLayout: ComponentType<{ children: React.ReactNode }>) {
  return async function AuthLayoutWithMessages({ children }: { children: React.ReactNode }) {
    const messages = await getMessages()
    return (
      <NextIntlClientProvider messages={selectMessages(messages, 'auth')}>
        <AuthLayout>{children}</AuthLayout>
      </NextIntlClientProvider>
    )
  }
}
