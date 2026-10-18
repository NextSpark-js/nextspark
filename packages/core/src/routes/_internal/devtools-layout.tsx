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
import { requireAreaAccess } from './area-access'

export const defaultMetadata: Metadata = {
  title: "DevTools",
  description: "Development tools and documentation",
  robots: "noindex, nofollow", // Prevent search engine indexing
};

export interface DevLayoutProps {
  children: React.ReactNode;
}

/** `serverChecked`: see DeveloperGuard (only the Cache Components module passes it, after its role check). */
type GuardedProps = DevLayoutProps & { serverChecked?: boolean }

// A Next layout receives only the props Next declares (`children` and the parallel route slots): the exported layouts
// below take `DevLayoutProps` and set `serverChecked` themselves, as Next's generated types (webpack builds) require.

/**
 * Developer Area Layout
 *
 * Protected layout for developer-only sections with dedicated sidebar navigation.
 * Applies DeveloperGuard protection to all child routes.
 * Includes responsive design for mobile and desktop.
 * Uses purple/violet color scheme to differentiate from Admin Panel (red).
 */
function DevLayoutBody({ children, serverChecked }: GuardedProps) {
  const pluginNavItems = getAllPluginNavItems('devtools')
  return (
    <DashboardProviders>
      <DeveloperGuard serverChecked={serverChecked}>
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

export function DevLayout({ children }: DevLayoutProps) {
  return <DevLayoutBody>{children}</DevLayoutBody>
}

/** `DevLayout` for the Cache Components module: its role check ran first, so the guard renders while the session loads. */
export function ServerCheckedDevLayout({ children }: DevLayoutProps) {
  return <DevLayoutBody serverChecked>{children}</DevLayoutBody>
}

/**
 * Wraps a layout for this route group in the group's client messages, after the server-side role check
 * (area-access): it runs before anything is rendered or sent, so a page load without the role gets a 307. The
 * route's default is `withDevtoolsMessages(DevLayout)`; a host that resolves a project override of the
 * layout wraps that instead, so the override gets the same messages and the same check.
 */
export function withDevtoolsMessages<P extends DevLayoutProps>(ResolvedDevLayout: ComponentType<P>) {
  return async function DevLayoutWithMessages(props: P) {
    await requireAreaAccess('devtools')
    const messages = await getMessages()
    return (
      <NextIntlClientProvider messages={selectMessages(messages, 'devtools')}>
        <ResolvedDevLayout {...props} />
      </NextIntlClientProvider>
    )
  }
}

/**
 * The layout core puts around a project's devtools layout (the generated host): core's protection is
 * always the outer layer - the dashboard providers and the DeveloperGuard, and only inside them the
 * project's layout. The server-side check is the message wrapper's, outside this (and every page under
 * /devtools checks again, see area-access). Shared by the message wrappers of both rendering modes
 * (`withDevtoolsGuard` here, and in `group-layouts.cc`).
 */
export function guardDevtoolsLayout<P extends DevLayoutProps>(ProjectLayout: ComponentType<P>, serverChecked = false) {
  return function GuardedDevLayout(props: P) {
    return (
      <DashboardProviders>
        <DeveloperGuard serverChecked={serverChecked}>
          <ProjectLayout {...props} />
        </DeveloperGuard>
      </DashboardProviders>
    )
  }
}

/**
 * The composition of a project's devtools layout with core (the generated host): messages, then
 * `guardDevtoolsLayout` around the project's layout.
 */
export function withDevtoolsGuard<P extends DevLayoutProps>(ProjectLayout: ComponentType<P>) {
  return withDevtoolsMessages(guardDevtoolsLayout(ProjectLayout))
}
