import { SuperAdminGuard } from "@nextsparkjs/core/components/app/guards/SuperAdminGuard";
import { DashboardProviders } from "@nextsparkjs/core/providers/DashboardProviders";
import { SuperadminSidebar } from "@nextsparkjs/core/components/superadmin/layouts/SuperadminSidebar";
import { Metadata } from "next";
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import { getPluginNavItems } from '@nextsparkjs/registries/plugin-registry'

const defaultMetadata: Metadata = {
  title: "Super Admin | Super Admin Panel",
  description: "Super administrator control panel",
  robots: "noindex, nofollow", // Prevent search engine indexing
};

export const metadata: Metadata = getMetadataOrDefault(
  'app/superadmin/layout.tsx',
  defaultMetadata
)

interface SuperadminLayoutProps {
  children: React.ReactNode;
}

/**
 * Superadmin Layout
 *
 * Protected layout for superadmin-only sections with dedicated sidebar navigation.
 * Applies SuperAdminGuard protection to all child routes.
 * Includes responsive design for mobile and desktop.
 */
function SuperadminLayout({ children }: SuperadminLayoutProps) {
  const pluginNavItems = getPluginNavItems('superadmin')
  return (
    <DashboardProviders>
    <SuperAdminGuard>
      <div className="flex h-screen bg-background" data-cy="superadmin-container">
        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block">
          <SuperadminSidebar pluginItems={pluginNavItems} />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header for Superadmin - Only visible on mobile */}
          <div className="lg:hidden bg-card border-b border-border p-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg">
                <div className="h-5 w-5 bg-red-600 rounded-sm"></div>
              </div>
              <div>
                <h1 className="text-lg font-bold text-red-600">Super Admin</h1>
                <p className="text-xs text-muted-foreground">Super Admin Area</p>
              </div>
            </div>
          </div>

          {/* Content area with scrolling */}
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6 max-w-7xl">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile sidebar overlay (future enhancement) */}
        {/* Could add a mobile drawer/overlay sidebar here if needed */}
      </div>
    </SuperAdminGuard>
    </DashboardProviders>
  );
}

export default getTemplateOrDefault('app/superadmin/layout.tsx', SuperadminLayout)