'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useCallback, useMemo } from 'react'
import { cn } from '../../../lib/utils'
import { useUserProfile } from '../../../hooks/useUserProfile'
import {
  User,
  Users,
  Lock,
  Shield,
  Bell,
  CreditCard,
  Settings,
  Key,
  Share2
} from 'lucide-react'
import { createAriaLabel, sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { getEnabledSettingsPages } from '../../../lib/config'

// Icon mapping for settings pages
const settingsIcons = {
  profile: User,
  password: Lock,
  security: Shield,
  notifications: Bell,
  'api-keys': Key,
  billing: CreditCard,
  'social-media': Share2,
  teams: Users,
  plans: CreditCard,
}

interface SettingsSidebarProps {
  className?: string
}

export function SettingsSidebar({ className }: SettingsSidebarProps) {
  const pathname = usePathname()
  const [statusMessage, setStatusMessage] = useState('')
  const { hasPassword } = useUserProfile()
  const t = useTranslations('common')
  const tSettings = useTranslations('settings')

  // Get enabled settings pages from configuration and filter based on user's auth method
  const filteredNavigation = useMemo(() => {
    const enabledPages = getEnabledSettingsPages()
    console.log('[SettingsSidebar] enabledPages:', enabledPages)

    return enabledPages.filter((page) => {
      // Hide password page for Google users (they can't change password)
      if (page.key === 'password' && !hasPassword) {
        return false
      }
      return true
    }).map((page) => ({
      name: page.key,
      href: `/dashboard/settings/${page.key}`,
      icon: settingsIcons[page.key as keyof typeof settingsIcons],
      label: tSettings(`navigation.${page.key}`),
      description: tSettings(`overview.${page.key}Description`),
      order: page.order
    }))
  }, [hasPassword])

  // Enhanced navigation handler with accessibility feedback
  const handleNavigation = useCallback((itemName: string, itemDescription: string) => {
    setStatusMessage(`Navegando a ${itemName} - ${itemDescription}`)
  }, [])

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent, href: string, itemName: string, itemDescription: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setStatusMessage(`Navegando a ${itemName} - ${itemDescription}`)
      // Navigation will be handled by the Link component
    }
  }, [])

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
              >
        {statusMessage}
      </div>

      <nav
        className={cn("space-y-2", className)}
        role="navigation"
        aria-label="Navegación de configuración"
                data-cy={sel('settings.sidebar.main')}
      >
        <div className="px-3 py-2">
          <header
            className="flex items-center gap-2 mb-4"
                        data-cy={sel('settings.sidebar.header')}
          >
            <Settings 
              className="h-5 w-5 text-muted-foreground" 
              aria-hidden="true"
            />
            <h2 
              id="settings-heading"
              className="text-lg font-semibold tracking-tight"
                          >
              {t('navigation.settings')}
            </h2>
          </header>
          <section 
            aria-labelledby="settings-heading"
                      >
            <div
              className="space-y-1"
              role="list"
                            data-cy={sel('settings.sidebar.navItems')}
            >
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    role="listitem"
                    onClick={() => handleNavigation(tSettings(`navigation.${item.name}`), tSettings(`overview.${item.name}Description`))}
                    onKeyDown={(e) => handleKeyDown(e, item.href, tSettings(`navigation.${item.name}`), tSettings(`overview.${item.name}Description`))}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={createAriaLabel(
                      '{name} - {description}{current}',
                      { 
                        name: tSettings(`navigation.${item.name}`),
                        description: tSettings(`overview.${item.name}Description`),
                        current: isActive ? ' (página actual)' : ''
                      }
                    )}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-accent-foreground group focus:outline-none focus:ring-2 focus:ring-accent",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50"
                    )}
                                        data-cy={sel('settings.sidebar.navItem', { section: item.name.toLowerCase() })}
                    data-nav-item={item.name.toLowerCase()}
                    data-active={isActive}
                  >
                    <Icon 
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-accent-foreground"
                      )}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col">
                      <span 
                        className={cn(
                          "font-medium transition-colors",
                          isActive ? "text-accent-foreground" : "text-foreground"
                        )}
                                              >
                        {tSettings(`navigation.${item.name}`)}
                      </span>
                      <span 
                        className={cn(
                          "text-xs transition-colors",
                          isActive ? "text-accent-foreground/70" : "text-muted-foreground"
                        )}
                                              >
                        {tSettings(`overview.${item.name}Description`)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </nav>
    </>
  )
}
