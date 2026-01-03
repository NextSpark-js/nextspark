'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { cn } from '../../../lib/utils'
import { useSidebar } from '../../../contexts/sidebar-context'
import { createTestId, createCyId } from '../../../lib/test'
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
        {...createTestId('sidebar', 'status', 'message') && { 'data-testid': createTestId('sidebar', 'status', 'message') }}
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
        {...createTestId('sidebar', 'container') && { 'data-testid': createTestId('sidebar', 'container') }}
        {...createCyId('sidebar', 'main') && { 'data-cy': createCyId('sidebar', 'main') }}
        data-collapsed={isCollapsed}
      >
        <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <header className="p-4">
          <div 
            className="flex items-center justify-between"
            role="banner"
            {...createTestId('sidebar', 'header') && { 'data-testid': createTestId('sidebar', 'header') }}
            {...createCyId('sidebar', 'header-section') && { 'data-cy': createCyId('sidebar', 'header-section') }}
          >
            <Link 
              href="/" 
              className="flex items-center gap-2"
              aria-label={isCollapsed ? 'Ir a la página principal' : 'Boilerplate - Ir a la página principal'}
              {...createTestId('sidebar', 'logo', 'link') && { 'data-testid': createTestId('sidebar', 'logo', 'link') }}
              {...createCyId('sidebar', 'logo') && { 'data-cy': createCyId('sidebar', 'logo') }}
            >
              <div 
                className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"
                role="img"
                aria-label="Logo de Boilerplate"
                {...createTestId('sidebar', 'logo', 'icon') && { 'data-testid': createTestId('sidebar', 'logo', 'icon') }}
              >
                <span className="text-primary-foreground font-bold text-sm" aria-hidden="true">B</span>
              </div>
              {!isCollapsed && (
                <span 
                  className="font-semibold text-lg"
                  {...createTestId('sidebar', 'brand', 'text') && { 'data-testid': createTestId('sidebar', 'brand', 'text') }}
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
          {...createTestId('sidebar', 'navigation') && { 'data-testid': createTestId('sidebar', 'navigation') }}
          {...createCyId('sidebar', 'nav') && { 'data-cy': createCyId('sidebar', 'nav') }}
        >
          <div>
            {/* Main Navigation */}
            <section aria-labelledby={!isCollapsed ? "nav-heading" : undefined}>
              {!isCollapsed && (
                <h3
                  id="nav-heading"
                  className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
                  {...createTestId('sidebar', 'nav', 'heading') && { 'data-testid': createTestId('sidebar', 'nav', 'heading') }}
                >
                  Navigation
                </h3>
              )}
              <div
                {...createTestId('sidebar', 'nav', 'items') && { 'data-testid': createTestId('sidebar', 'nav', 'items') }}
                {...createCyId('sidebar', 'nav-items') && { 'data-cy': createCyId('sidebar', 'nav-items') }}
              >
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
