import { PublicNavbar } from '@nextsparkjs/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@nextsparkjs/core/components/app/layouts/PublicFooter'

function PublicLayout({ 
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

export default PublicLayout