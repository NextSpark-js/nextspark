import type { ComponentType } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { getConfiguredClientNamespaces, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-client'
import { AreaMessagesCheck } from '@nextsparkjs/core/providers/area-messages-check'
import { APP_NAME } from '@nextsparkjs/core/lib/config/public-config-client'
import { GroupToaster } from '@nextsparkjs/core/providers/group-toaster'
import { getAuthTranslations } from '@nextsparkjs/core/lib/i18n/auth-translations'

/**
 * The metadata of the group's pages that declare none, and the one a project's override of this layout keeps when it
 * declares none (the generated host forwards it from this module, the composition module of the ISR host, so the
 * override's route does not import DefaultAuthLayout). The texts follow the language the group renders in.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthTranslations('auth.metadata')
  return {
    title: {
      default: `${t('title')} | ${APP_NAME}`,
      template: `%s | ${APP_NAME}`,
    },
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  }
}

/**
 * Wraps a layout for this route group in the group's client messages. The route's
 * default is `withAuthMessages(DefaultAuthLayout)` (./default-auth-layout); a host that resolves a project override of the
 * layout wraps that instead, so the override gets the same messages.
 */
export function withAuthMessages<P extends { children: React.ReactNode }>(AuthLayout: ComponentType<P>) {
  return async function AuthLayoutWithMessages(props: P) {
    const messages = await getMessages()
    // the namespaces the project lists for the area in i18n.clientNamespaces (#427)
    const configuredNamespaces = getConfiguredClientNamespaces({ appConfig: APP_CONFIG_MERGED })
    return (
      <NextIntlClientProvider messages={selectMessages(messages, 'auth', configuredNamespaces.auth)}>
        <AreaMessagesCheck area="auth">
          <GroupToaster>
            <AuthLayout {...props} />
          </GroupToaster>
        </AreaMessagesCheck>
      </NextIntlClientProvider>
    )
  }
}
