import { Suspense } from 'react'
import { AuthWrapper } from '@nextsparkjs/core/components/auth/layouts/AuthWrapper'

/**
 * Core's default auth layout. A module of its own: the composition module (./auth-layout) and the metadata a
 * project override keeps are imported without it, so an override's route ships none of its client components.
 */
export function DefaultAuthLayout({ children }: { children: React.ReactNode }) {
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
