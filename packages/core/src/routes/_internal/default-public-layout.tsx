import { PublicNavbar } from '@nextsparkjs/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@nextsparkjs/core/components/app/layouts/PublicFooter'

/**
 * Core's default public layout. A module of its own: the composition module (./public-layout) and the metadata a
 * project override keeps are imported without it, so an override's route ships none of its client components.
 *
 * `children` is not behind a Suspense boundary: one makes a `notFound()` thrown by a public page (the `[slug]` of the
 * pages entity) arrive in the stream after the head went out, so an unknown URL answers 200 instead of 404 in the
 * legacy host. The Cache Components wrapper (group-layouts.cc) puts its own boundary around the page, which that
 * mode needs.
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
        {children}
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  )
}
