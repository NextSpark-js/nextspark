import type { ComponentType } from 'react'
import type { Metadata } from "next"
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { getConfiguredClientNamespaces, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-client'
import { AreaMessagesCheck } from '@nextsparkjs/core/providers/area-messages-check'
import { APP_NAME } from '@nextsparkjs/core/lib/config/public-config-client'
import { resolveAppUrl } from '@nextsparkjs/core/lib/utils/base-url'

// ✅ MINIMAL GENERIC METADATA (cliente puede override con template)
export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${APP_NAME}`,
    default: APP_NAME,
  },
  description: 'Application',
  // The base a relative URL in the metadata resolves against (an og:image path); the canonical and og:url of the public
  // pages are absolute already (pageMetadata)
  metadataBase: new URL(resolveAppUrl()),
  openGraph: { type: 'website', siteName: APP_NAME },
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
export function withPublicMessages<P extends { children: React.ReactNode }>(PublicLayout: ComponentType<P>) {
  return async function PublicLayoutWithMessages(props: P) {
    const messages = await getMessages()
    // the namespaces the project lists for the area in i18n.clientNamespaces (#427)
    const configuredNamespaces = getConfiguredClientNamespaces({ appConfig: APP_CONFIG_MERGED })
    return (
      <NextIntlClientProvider messages={selectMessages(messages, 'public', configuredNamespaces.public)}>
        <AreaMessagesCheck area="public">
          <PublicLayout {...props} />
        </AreaMessagesCheck>
      </NextIntlClientProvider>
    )
  }
}
