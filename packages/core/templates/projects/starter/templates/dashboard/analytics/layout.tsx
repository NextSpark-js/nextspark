import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'

// TasksChart and RecentActivity are client components that read the `analytics`
// namespace, which the dashboard group does not carry to the browser by default.
export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={selectMessages(messages, 'dashboard', ['analytics'])}>
      {children}
    </NextIntlClientProvider>
  )
}
