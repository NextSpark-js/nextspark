import type { ComponentType } from 'react'
import type { Metadata } from "next"
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'

// ✅ MINIMAL GENERIC METADATA (cliente puede override con template)
export const defaultMetadata: Metadata = {
  title: {
    template: '%s | App',
    default: 'App',
  },
  description: 'Application',
}

/**
 * The metadata a project's override of this layout keeps when it declares none (the generated host forwards it from
 * this module, the composition module of the ISR host, so the override's route does not import DefaultPublicLayout).
 */
export const metadata: Metadata = defaultMetadata

/**
 * Wraps a layout for this route group in the group's client messages. The route's
 * default is `withPublicMessages(DefaultPublicLayout)` (./default-public-layout); a host that resolves a project override of the
 * layout wraps that instead, so the override gets the same messages.
 */
export function withPublicMessages(PublicLayout: ComponentType<{ children: React.ReactNode }>) {
  return async function PublicLayoutWithMessages({ children }: { children: React.ReactNode }) {
    const messages = await getMessages()
    return (
      <NextIntlClientProvider messages={selectMessages(messages, 'public')}>
        <PublicLayout>{children}</PublicLayout>
      </NextIntlClientProvider>
    )
  }
}
