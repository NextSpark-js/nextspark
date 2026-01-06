/**
 * CRM Dashboard Main Layout
 * Professional layout with custom sidebar and topbar for CRM theme
 */

'use client'

import { useState, createContext, useContext, ReactNode, useEffect } from 'react'
import { CRMSidebar } from '@/themes/crm/templates/shared/CRMSidebar'
import { CRMTopBar } from '@/themes/crm/templates/shared/CRMTopBar'
import { CRMMobileNav } from '@/themes/crm/templates/shared/CRMMobileNav'
import { cn } from '@nextsparkjs/core/lib/utils'

// Context for sidebar state
interface SidebarContextValue {
  expanded: boolean
  setExpanded: (value: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export function useCRMSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    return { expanded: false, setExpanded: () => {} }
  }
  return context
}

interface CRMDashboardLayoutProps {
  children: ReactNode
}

export default function CRMDashboardLayout({ children }: CRMDashboardLayoutProps) {
  const [expanded, setExpanded] = useState(false)

  // Sync CSS variable with sidebar state
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--crm-sidebar-width',
      expanded ? '16rem' : '4rem'
    )
  }, [expanded])

  // Initialize CSS variable on mount
  useEffect(() => {
    document.documentElement.style.setProperty('--crm-sidebar-width', '4rem')
    return () => {
      document.documentElement.style.removeProperty('--crm-sidebar-width')
    }
  }, [])

  return (
    <SidebarContext.Provider value={{ expanded, setExpanded }}>
      <div
        className="min-h-screen bg-background"
        onMouseMove={(e) => {
          // Expand sidebar when mouse is near left edge
          if (e.clientX < 64) {
            setExpanded(true)
          } else if (e.clientX > 280) {
            setExpanded(false)
          }
        }}
      >
        {/* Desktop: Sidebar */}
        <CRMSidebar />

        {/* Desktop: TopBar */}
        <CRMTopBar />

        {/* Mobile: Navigation */}
        <CRMMobileNav />

        {/* Main Content Area */}
        <main
          className={cn(
            'min-h-screen transition-all duration-300 ease-out',
            // Mobile: padding for bottom nav
            'pb-20',
            // Desktop: padding for topbar
            'lg:pb-0 lg:pt-16',
            // Desktop: margin for collapsed sidebar (expanded handled by CSS var)
            'lg:ml-16'
          )}
          style={{
            marginLeft: undefined, // Handled by Tailwind on desktop
          }}
        >
          {/* Inner wrapper with responsive padding */}
          <div className="lg:pt-0 pt-14">
            {children}
          </div>
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
