'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { cn } from '../../../lib/utils'
import { useSidebar } from '../../../contexts/sidebar-context'
import { sel } from '../../../lib/test'
import { DynamicNavigation } from '../navigation/DynamicNavigation'
import { TeamSwitcherCompact } from '../../teams/TeamSwitcherCompact'
import type { SerializableEntityConfig } from '../../../lib/entities/serialization'

interface SidebarProps {
  className?: string
  entities: SerializableEntityConfig[]
}

export function Sidebar({ className, entities }: SidebarProps) {
  const { isCollapsed } = useSidebar()
  const [statusMessage, setStatusMessage] = useState('')

  // Focus management for collapsed state
  useEffect(() => {
    if (isCollapsed) {
      setStatusMessage('Sidebar en modo contraído. Use Tab para navegar.')
    }
  }, [isCollapsed])

  return (
    <>
      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <div
        className={cn(
          "hidden lg:flex flex-col bg-background border-r border-border fixed left-0 top-0 h-screen z-50 transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
          className
        )}
        role="complementary"
        aria-label={isCollapsed ? 'Sidebar de navegación contraído' : 'Sidebar de navegación expandido'}
        data-cy={sel('dashboard.sidebar.container')}
        data-collapsed={isCollapsed}
      >
        <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <header className="p-4">
          <div
            className="flex items-center justify-between"
            role="banner"
            data-cy={sel('dashboard.sidebar.header')}
          >
            <Link
              href="/"
              className="flex items-center gap-2"
              aria-label={isCollapsed ? 'Ir a la página principal' : 'Boilerplate - Ir a la página principal'}
              data-cy={sel('dashboard.sidebar.logo')}
            >
              <div 
                className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"
                role="img"
                aria-label="Logo de Boilerplate"
              >
                <span className="text-primary-foreground font-bold text-sm" aria-hidden="true">B</span>
              </div>
              {!isCollapsed && (
                <span 
                  className="font-semibold text-lg"
                >
                  Boilerplate
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Navigation */}
        <nav
          className="flex-1 px-2 pb-4 overflow-y-auto"
          id="sidebar-navigation"
          role="navigation"
          aria-label="Navegación principal del dashboard"
          data-cy={sel('dashboard.sidebar.content')}
        >
          <div>
            {/* Main Navigation */}
            <section aria-labelledby={!isCollapsed ? "nav-heading" : undefined}>
              {!isCollapsed && (
                <h3
                  id="nav-heading"
                  className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
                >
                  Navigation
                </h3>
              )}
              <div>
                <DynamicNavigation entities={entities} />
              </div>
            </section>
          </div>
        </nav>

        {/* Team Switcher at bottom - only show when not collapsed */}
        {!isCollapsed && (
          <div className="mt-auto">
            <TeamSwitcherCompact />
          </div>
        )}
      </div>
      </div>
    </>
  )
}
