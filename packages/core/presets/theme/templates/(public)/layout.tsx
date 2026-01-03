import { PublicNavbar } from '@/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@/core/components/app/layouts/PublicFooter'

/**
 * Public Layout Template
 *
 * This layout wraps all public-facing pages (landing, pricing, support, etc.)
 * It includes the public navigation bar and footer.
 *
 * Customize this layout to match your theme's public pages design.
 */
function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Public Navbar */}
      <PublicNavbar />

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  )
}

export default PublicLayout
