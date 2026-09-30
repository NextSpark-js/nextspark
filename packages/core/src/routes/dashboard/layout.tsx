import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { AuthenticatedDashboardLayout } from '@nextsparkjs/core/components/dashboard/layouts/AuthenticatedDashboardLayout'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-client'
import { getConfiguredClientNamespaces, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'

/**
 * The data boundary belongs in this server layout. Keeping the client
 * authentication shell in core lets a project's dashboard layout (templates/dashboard/layout.tsx)
 * use the same narrowly scoped catalog.
 */
export default async function CoreDashboardLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  const configuredNamespaces = getConfiguredClientNamespaces({
    entityRegistry: ENTITY_REGISTRY,
    appConfig: APP_CONFIG_MERGED,
  })

  return (
    <NextIntlClientProvider messages={selectMessages(messages, 'dashboard', configuredNamespaces.dashboard)}>
      <AuthenticatedDashboardLayout>{children}</AuthenticatedDashboardLayout>
    </NextIntlClientProvider>
  )
}
