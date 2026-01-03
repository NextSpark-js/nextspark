import type { Metadata } from 'next'
import { AuthWrapper } from '@nextsparkjs/core/components/auth/layouts/AuthWrapper'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/core/lib/template-resolver'

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

function AuthLayout({ children }: { children: React.ReactNode }) {
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
            {children}
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

export default getTemplateOrDefault('app/(auth)/layout.tsx', AuthLayout)