import { Suspense } from "react"
import type { Metadata } from "next"
import { PublicNavbar } from '@nextsparkjs/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@nextsparkjs/core/components/app/layouts/PublicFooter'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { getTemplateOrDefault, getMetadataOrDefault } from "@nextsparkjs/registries/template-scopes/server/(public)/layout"

// ✅ MINIMAL GENERIC METADATA (cliente puede override con template)
const defaultMetadata: Metadata = {
  title: {
    template: '%s | App',
    default: 'App',
  },
  description: 'Application',
}

export const metadata: Metadata = getMetadataOrDefault(
  'app/(public)/layout.tsx',
  defaultMetadata
)

function DefaultPublicLayout({
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

const PublicLayout = getTemplateOrDefault('app/(public)/layout.tsx', DefaultPublicLayout)

export default async function PublicLayoutWithMessages({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={selectMessages(messages, 'public')}>
      <PublicLayout>{children}</PublicLayout>
    </NextIntlClientProvider>
  )
}
