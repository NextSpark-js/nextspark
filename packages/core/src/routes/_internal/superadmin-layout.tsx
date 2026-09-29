import type { ComponentType } from 'react'
import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-client'
import { getConfiguredClientNamespaces, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { SuperAdminGuard } from "@nextsparkjs/core/components/app/guards/SuperAdminGuard";
import { DashboardProviders } from "@nextsparkjs/core/providers/DashboardProviders";
import { SuperadminSidebar } from "@nextsparkjs/core/components/superadmin/layouts/SuperadminSidebar";
import { Loader2 } from 'lucide-react'
import { Metadata } from "next";
import { getPluginNavItems } from '@nextsparkjs/registries/plugin-registry'

export const defaultMetadata: Metadata = {
  title: "Super Admin | Super Admin Panel",
  description: "Super administrator control panel",
  robots: "noindex, nofollow", // Prevent search engine indexing
};

export interface SuperadminLayoutProps {
  children: React.ReactNode;
}

/**
 * Wrapped in Suspense so PPR doesn't fail during prerender.
 */
function SuperadminContent({ children }: SuperadminLayoutProps) {
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
          </div>
      </SuperAdminGuard>
    </DashboardProviders>
  )
}

/**
 * Superadmin Layout
 *
 * Protected layout for superadmin-only sections with dedicated sidebar navigation.
 * Owns the narrowly scoped client catalog for superadmin routes.
 */
export function SuperadminLayout({ children }: SuperadminLayoutProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SuperadminContent>{children}</SuperadminContent>
    </Suspense>
  )
}

/**
 * Wraps a layout for this route group in the group's client messages. The route's
 * default is `withSuperadminMessages(SuperadminLayout)`; a host that resolves a project override of the
 * layout wraps that instead, so the override gets the same messages.
 */
export function withSuperadminMessages(ResolvedSuperadminLayout: ComponentType<SuperadminLayoutProps>) {
  return async function SuperadminLayoutWithMessages({ children }: SuperadminLayoutProps) {
    const messages = await getMessages()
    const configuredNamespaces = getConfiguredClientNamespaces({ appConfig: APP_CONFIG_MERGED })
    return (
      <NextIntlClientProvider messages={selectMessages(messages, 'superadmin', configuredNamespaces.superadmin)}>
        <ResolvedSuperadminLayout>{children}</ResolvedSuperadminLayout>
      </NextIntlClientProvider>
    )
  }
}
