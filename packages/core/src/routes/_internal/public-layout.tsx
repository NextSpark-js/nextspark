import type { ComponentType } from 'react'
import { Suspense } from "react"
import type { Metadata } from "next"
import { PublicNavbar } from '@nextsparkjs/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@nextsparkjs/core/components/app/layouts/PublicFooter'
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

export function DefaultPublicLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Public Navbar */}
      <PublicNavbar />

      {/* Main Content */}
      <main className="flex-1">
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  )
}

/**
 * Wraps a layout for this route group in the group's client messages. The route's
 * default is `withPublicMessages(DefaultPublicLayout)`; a host that resolves a project override of the
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
