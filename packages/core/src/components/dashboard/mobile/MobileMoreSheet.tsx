'use client'

import { useAuth } from '../../../hooks/useAuth'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../ui/sheet'
import { Button } from '../../ui/button'
import { Separator } from '../../ui/separator'
import Link from 'next/link'
import { Shield, LogOut } from 'lucide-react'
import { createTestId, createCyId } from '../../../lib/test'
import { TeamSwitcherCompact } from '../../teams/TeamSwitcherCompact'
import { useTranslations } from 'next-intl'
import { useIsSuperAdmin } from '../../app/guards/SuperAdminGuard'
import { useState } from 'react'
import { MOBILE_NAV_CONFIG } from '../../../lib/config/config-sync'
import { getIcon } from '../../../lib/config/icon-map'
import type { MobileNavMoreItem } from '../../../lib/config/types'
import type { LucideIcon } from 'lucide-react'

interface MobileMoreSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

// Type for processed menu items
interface ProcessedMenuItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  external: boolean
}

export function MobileMoreSheet({ isOpen, onOpenChange }: MobileMoreSheetProps) {
  const { user, signOut } = useAuth()
  // Use common namespace for hardcoded component translations
  const tCommon = useTranslations('common')
  // Use root namespace for dynamic config-based translations (supports both core and theme namespaces)
  const t = useTranslations()
  const isSuperAdmin = useIsSuperAdmin()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await signOut()
      onOpenChange(false)
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleLinkClick = () => {
    onOpenChange(false)
  }

  // Get menu items from config
  // Labels use full translation paths (e.g., 'common.mobileNav.home' or 'crm.navigation.leads')
  const menuItems: ProcessedMenuItem[] = MOBILE_NAV_CONFIG.moreSheetItems
    .filter((item: MobileNavMoreItem) => item.enabled)
    .map((configItem: MobileNavMoreItem) => {
      // Get icon component using type-safe icon map
      const IconComponent = getIcon(configItem.icon)

      return {
        id: configItem.id,
        label: t(configItem.labelKey),
        href: configItem.href,
        icon: IconComponent,
        external: configItem.external || false
      }
    })

  if (!user) return null

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[20px]"
        {...createTestId('mobile-more-sheet', 'content') && { 'data-testid': createTestId('mobile-more-sheet', 'content') }}
        {...createCyId('mobile-more-sheet', 'content') && { 'data-cy': createCyId('mobile-more-sheet', 'content') }}
      >
        <SheetHeader>
          <SheetTitle>{tCommon('mobileNav.moreOptions')}</SheetTitle>
          <SheetDescription>
            {tCommon('mobileNav.moreOptionsDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {/* Menu Items */}
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                {...createTestId('mobile-more-sheet', 'item', item.id) && { 'data-testid': createTestId('mobile-more-sheet', 'item', item.id) }}
                {...createCyId('mobile-more-sheet', `item-${item.id}`) && { 'data-cy': createCyId('mobile-more-sheet', `item-${item.id}`) }}
              >
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}

          {/* Admin Panel - Solo para superadmin */}
          {isSuperAdmin && (
            <>
              <Separator className="my-2" />
              <Link
                href="/superadmin"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                {...createTestId('mobile-more-sheet', 'superadmin') && { 'data-testid': createTestId('mobile-more-sheet', 'superadmin') }}
                {...createCyId('mobile-more-sheet', 'superadmin-link') && { 'data-cy': createCyId('mobile-more-sheet', 'superadmin-link') }}
              >
                <Shield className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium">Super Admin Panel</span>
              </Link>
            </>
          )}

          {/* Team Switcher */}
          <Separator className="my-2" />
          <div
            {...createTestId('mobile-more-sheet', 'team-switcher') && { 'data-testid': createTestId('mobile-more-sheet', 'team-switcher') }}
            {...createCyId('mobile-more-sheet', 'team-switcher') && { 'data-cy': createCyId('mobile-more-sheet', 'team-switcher') }}
          >
            <TeamSwitcherCompact className="border-0 p-0" />
          </div>

          <Separator className="my-4" />

          {/* Sign Out */}
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full justify-start gap-3 px-4 py-3 h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            {...createTestId('mobile-more-sheet', 'signout') && { 'data-testid': createTestId('mobile-more-sheet', 'signout') }}
            {...createCyId('mobile-more-sheet', 'signout-button') && { 'data-cy': createCyId('mobile-more-sheet', 'signout-button') }}
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">
              {isSigningOut ? tCommon('buttons.signingOut') : tCommon('buttons.signOut')}
            </span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
