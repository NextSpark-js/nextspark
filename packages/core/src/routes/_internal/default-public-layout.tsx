import { Suspense } from 'react'
import { PublicNavbar } from '@nextsparkjs/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@nextsparkjs/core/components/app/layouts/PublicFooter'

/**
 * Core's default public layout. A module of its own: the composition module (./public-layout) and the metadata a
 * project override keeps are imported without it, so an override's route ships none of its client components.
 */
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
