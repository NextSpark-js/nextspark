import type { Metadata } from "next"
import { PublicNavbar } from '@nextsparkjs/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@nextsparkjs/core/components/app/layouts/PublicFooter'
import { getTemplateOrDefault, getMetadataOrDefault } from "@nextsparkjs/core/lib/template-resolver"

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

export default getTemplateOrDefault('app/(public)/layout.tsx', PublicLayout)
