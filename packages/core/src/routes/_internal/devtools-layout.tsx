import type { ComponentType } from 'react'
import { DeveloperGuard } from "@nextsparkjs/core/components/app/guards/DeveloperGuard";
import { DashboardProviders } from "@nextsparkjs/core/providers/DashboardProviders";
import { DevtoolsSidebar } from "@nextsparkjs/core/components/devtools/DevtoolsSidebar";
import { DevtoolsMobileHeader } from "@nextsparkjs/core/components/devtools/DevtoolsMobileHeader";
import { Metadata } from "next";
import { getAllPluginNavItems } from '@nextsparkjs/core/lib/plugins/nav-items'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'

export const defaultMetadata: Metadata = {
  title: "DevTools",
  description: "Development tools and documentation",
  robots: "noindex, nofollow", // Prevent search engine indexing
};

export interface DevLayoutProps {
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
export function DevLayout({ children }: DevLayoutProps) {
  const pluginNavItems = getAllPluginNavItems('devtools')
  return (
    <DashboardProviders>
      <DeveloperGuard>
        <div className="flex h-screen bg-background">
        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block">
          <DevtoolsSidebar pluginItems={pluginNavItems} />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header for DevTools - Only visible on mobile */}
          <DevtoolsMobileHeader />

          {/* Content area with scrolling */}
          {/* `relative` so a full-bleed child route (the API Explorer) can fill this area
              without measuring the sidebar itself. */}
          <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <div className="container mx-auto p-6 max-w-7xl">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile sidebar overlay (future enhancement) */}
        {/* Could add a mobile drawer/overlay sidebar here if needed */}
        </div>
      </DeveloperGuard>
    </DashboardProviders>
  );
}

/**
 * Wraps a layout for this route group in the group's client messages. The route's
 * default is `withDevtoolsMessages(DevLayout)`; a host that resolves a project override of the
 * layout wraps that instead, so the override gets the same messages.
 */
export function withDevtoolsMessages(ResolvedDevLayout: ComponentType<DevLayoutProps>) {
  return async function DevLayoutWithMessages({ children }: DevLayoutProps) {
    const messages = await getMessages()
    return (
      <NextIntlClientProvider messages={selectMessages(messages, 'devtools')}>
        <ResolvedDevLayout>{children}</ResolvedDevLayout>
      </NextIntlClientProvider>
    )
  }
}

/**
 * The composition of a project's devtools layout with core (the generated host): core's protection is
 * always the outer layer - messages, then the dashboard providers and the DeveloperGuard, and only inside
 * them the project's layout.
 */
export function withDevtoolsGuard(ProjectLayout: ComponentType<DevLayoutProps>) {
  return withDevtoolsMessages(function GuardedDevLayout({ children }: DevLayoutProps) {
    return (
      <DashboardProviders>
        <DeveloperGuard>
          <ProjectLayout>{children}</ProjectLayout>
        </DeveloperGuard>
      </DashboardProviders>
    )
  })
}
