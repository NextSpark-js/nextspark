import { DeveloperGuard } from "@nextsparkjs/core/components/app/guards/DeveloperGuard";
import { DevtoolsSidebar, DevtoolsMobileHeader } from "@nextsparkjs/core/components/devtools";
import { Metadata } from "next";
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/core/lib/template-resolver'

const defaultMetadata: Metadata = {
  title: "DevTools",
  description: "Development tools and documentation",
  robots: "noindex, nofollow", // Prevent search engine indexing
};

export const metadata: Metadata = getMetadataOrDefault(
  'app/devtools/layout.tsx',
  defaultMetadata
)

interface DevLayoutProps {
  children: React.ReactNode;
}

/**
 * Developer Area Layout
 *
 * Protected layout for developer-only sections with dedicated sidebar navigation.
 * Applies DeveloperGuard protection to all child routes.
 * Includes responsive design for mobile and desktop.
 * Uses purple/violet color scheme to differentiate from Admin Panel (red).
 */
function DevLayout({ children }: DevLayoutProps) {
  return (
    <DeveloperGuard>
      <div className="flex h-screen bg-background">
        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block">
          <DevtoolsSidebar />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header for DevTools - Only visible on mobile */}
          <DevtoolsMobileHeader />

          {/* Content area with scrolling */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="container mx-auto p-6 max-w-7xl">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile sidebar overlay (future enhancement) */}
        {/* Could add a mobile drawer/overlay sidebar here if needed */}
      </div>
    </DeveloperGuard>
  );
}

export default getTemplateOrDefault('app/devtools/layout.tsx', DevLayout)
