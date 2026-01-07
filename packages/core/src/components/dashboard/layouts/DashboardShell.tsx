'use client'

import { Sidebar } from './Sidebar'
import { TopNavbar } from './TopNavbar'
import { MobileTopBar } from '../mobile/MobileTopBar'
import { MobileBottomNav } from '../mobile/MobileBottomNav'
import { SidebarProvider, useSidebar } from '../../../contexts/sidebar-context'
import { cn } from '../../../lib/utils'
import { deserializeEntityConfig, type SerializableEntityConfig } from '../../../lib/entities/serialization'
import { setServerEntities } from '../../../lib/entities/registry.client'

interface DashboardShellProps {
  children: React.ReactNode
  entities: SerializableEntityConfig[]
}

// Module-level flag to track hydration (survives re-renders)
let clientHydrated = false

function DashboardShellContent({ children, entities }: DashboardShellProps) {
  const { isCollapsed } = useSidebar()

  // CRITICAL: Hydrate synchronously during render, BEFORE children mount
  // This ensures hooks in child components (like useEntityConfig) see populated registry
  // Using useEffect would be too late - it runs AFTER first render
  if (!clientHydrated && entities.length > 0) {
    const deserializedEntities = entities.map(deserializeEntityConfig)
    setServerEntities(deserializedEntities)
    clientHydrated = true
  }

  return (
    <div className="min-h-screen">
      {/* Desktop only - Sidebar */}
      <Sidebar className="hidden lg:flex" entities={entities} />

      {/* Desktop only - TopNavbar */}
      <TopNavbar className="hidden lg:flex" entities={entities} />

      {/* Mobile only - TopBar */}
      <MobileTopBar />

      {/* Mobile only - BottomNav */}
      <MobileBottomNav />

      <div
        className={cn(
          "transition-all duration-300 min-h-screen",
          // Mobile: padding for top bar and bottom nav
          "pt-14 pb-20",
          // Desktop: padding for top navbar and margin for sidebar
          "lg:pt-16 lg:pb-0 lg:ml-64",
          // Desktop collapsed sidebar
          isCollapsed && "lg:ml-16"
        )}
      >
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}

export function DashboardShell({ children, entities }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <DashboardShellContent entities={entities}>
        {children}
      </DashboardShellContent>
    </SidebarProvider>
  )
}