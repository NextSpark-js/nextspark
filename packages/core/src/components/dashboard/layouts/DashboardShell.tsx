'use client'

import { Sidebar } from './Sidebar'
import { TopNavbar } from './TopNavbar'
import { MobileTopBar } from '../mobile/MobileTopBar'
import { MobileBottomNav } from '../mobile/MobileBottomNav'
import { SidebarProvider, useSidebar } from '../../../contexts/sidebar-context'
import { cn } from '../../../lib/utils'
import type { SerializableEntityConfig } from '../../../lib/entities/serialization'

interface DashboardShellProps {
  children: React.ReactNode
  entities: SerializableEntityConfig[]
}

function DashboardShellContent({ children, entities }: DashboardShellProps) {
  const { isCollapsed } = useSidebar()

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