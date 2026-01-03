'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { useTranslations } from 'next-intl'

interface DocsLayoutProps {
  children: React.ReactNode
}

export function DocsLayout({ children }: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const t = useTranslations('docs')

  // Extract sidebar and main content from children array
  const childrenArray = Array.isArray(children) ? children : [children]
  const sidebar = childrenArray[0]
  const mainContent = childrenArray[1] || childrenArray[0]

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="sticky top-0 z-40 lg:hidden border-b bg-background">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? t('sidebar.close') : t('sidebar.open')}
            aria-expanded={sidebarOpen}
            data-cy="docs-mobile-menu-toggle"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Layout container */}
      <div className="flex">
        {/* Sidebar - Mobile overlay, Desktop fixed */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 border-r bg-background transition-transform lg:sticky lg:top-0 lg:block lg:h-screen lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-label={t('sidebar.label')}
          data-cy="docs-sidebar"
        >
          <div className="h-full overflow-y-auto">
            {sidebar}
          </div>
        </aside>

        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
            data-cy="docs-sidebar-backdrop"
          />
        )}

        {/* Main content */}
        <div className="flex-1 lg:ml-0">
          {mainContent}
        </div>
      </div>
    </div>
  )
}
