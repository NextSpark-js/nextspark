import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AuthWrapper } from '@nextsparkjs/core/components/auth/layouts/AuthWrapper'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/registries/template-scopes/server/(auth)/layout'

const defaultMetadata: Metadata = {
  title: {
    default: 'Authentication | Boilerplate',
    template: '%s | Boilerplate',
  },
  description: 'Sign in or create an account to access our platform',
  robots: {
    index: false,
    follow: false,
  },
}

export const metadata: Metadata = getMetadataOrDefault(
  'app/(auth)/layout.tsx',
  defaultMetadata
)

function DefaultAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Boilerplate
            </h1>
            <p className="text-sm text-muted-foreground">
              Modern Full-Stack Application
            </p>
          </div>

          <AuthWrapper>
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </AuthWrapper>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Protected with enterprise-grade encryption
          </p>
        </div>
      </div>
    </div>
  )
}

const AuthLayout = getTemplateOrDefault('app/(auth)/layout.tsx', DefaultAuthLayout)

export default async function AuthLayoutWithMessages({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={selectMessages(messages, 'auth')}>
      <AuthLayout>{children}</AuthLayout>
    </NextIntlClientProvider>
  )
}
