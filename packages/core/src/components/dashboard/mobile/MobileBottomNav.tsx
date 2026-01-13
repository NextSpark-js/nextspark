'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { MobileMoreSheet } from './MobileMoreSheet'
import { QuickCreateSheet } from './QuickCreateSheet'
import { MOBILE_NAV_CONFIG } from '../../../lib/config/config-sync'
import { getIcon } from '../../../lib/config/icon-map'
import type { MobileNavItem } from '../../../lib/config/types'
import type { LucideIcon } from 'lucide-react'

// Type for processed navigation items
interface ProcessedNavItem {
  id: string
  name: string
  href: string
  icon: LucideIcon
  isActive: boolean
  isCentral: boolean
  onClick?: () => void
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const t = useTranslations()
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false)
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)

  // Get enabled items from config and map them to navigation items
  const navItems: ProcessedNavItem[] = MOBILE_NAV_CONFIG.items
    .filter((item: MobileNavItem) => item.enabled)
    .map((configItem: MobileNavItem) => {
      // Get icon component using type-safe icon map
      const IconComponent = getIcon(configItem.icon)

      // Determine if this item is active
      let isActive = false
      if (configItem.href) {
        isActive = configItem.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(configItem.href)
      }

      // Build onClick handler based on action
      let onClick: (() => void) | undefined
      if (configItem.action === 'quickCreate') {
        onClick = () => setIsQuickCreateOpen(true)
      } else if (configItem.action === 'moreSheet') {
        onClick = () => setIsMoreSheetOpen(true)
      }

      return {
        id: configItem.id,
        name: t(configItem.labelKey),
        href: configItem.href || '#',
        icon: IconComponent,
        isActive,
        isCentral: configItem.isCentral || false,
        onClick
      }
    })

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border safe-area-bottom"
        role="navigation"
        aria-label="Navegación móvil principal"
        data-cy={sel('dashboard.mobile.bottomNav.container')}
      >
        <div className="flex items-end justify-around px-2 pb-2 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.isActive

            // Botón central destacado (Quick Create)
            if (item.isCentral) {
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 relative",
                    "transition-all duration-200"
                  )}
                  aria-label={item.name}
                  aria-current={isActive ? 'page' : undefined}
                  data-cy={sel('dashboard.mobile.bottomNav.item', { id: item.id })}
                >
                  {/* Central button - larger and elevated */}
                  <div className="absolute -top-6 flex items-center justify-center">
                    <div className="bg-primary rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow">
                      <Icon className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-foreground mt-8">
                    {item.name}
                  </span>
                </button>
              )
            }

            // Botones regulares
            const content = (
              <>
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.name}
                </span>
              </>
            )

            // Si tiene onClick, renderizar como button
            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0 flex-1",
                    "transition-all duration-200 hover:bg-accent/50 rounded-lg"
                  )}
                  aria-label={item.name}
                  data-cy={sel('dashboard.mobile.bottomNav.item', { id: item.id })}
                >
                  {content}
                </button>
              )
            }

            // Link regular
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0 flex-1",
                  "transition-all duration-200 hover:bg-accent/50 rounded-lg"
                )}
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
                data-cy={sel('dashboard.mobile.bottomNav.item', { id: item.id })}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* More Sheet */}
      <MobileMoreSheet
        isOpen={isMoreSheetOpen}
        onOpenChange={setIsMoreSheetOpen}
      />

      {/* Quick Create Sheet */}
      <QuickCreateSheet
        isOpen={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
      />
    </>
  )
}
