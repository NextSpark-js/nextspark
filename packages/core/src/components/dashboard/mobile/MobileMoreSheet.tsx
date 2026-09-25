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
import { sel } from '../../../lib/test'
import { TeamSwitcherCompact } from '../../teams/TeamSwitcherCompact'
import { useTranslations } from 'next-intl'
import { useIsSuperAdmin } from '../../app/guards/SuperAdminGuard'
import { useState } from 'react'
import { MOBILE_NAV_CONFIG } from '../../../lib/config/config-client'
import { getIcon } from '../../../lib/config/icon-map'
import type { MobileNavMoreItem } from '../../../lib/config/types'
import type { LucideIcon } from 'lucide-react'
import { usePermission } from '../../../lib/permissions/hooks'
import type { Permission } from '../../../lib/permissions/types'

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
  requiresPermission?: string
}

// Component to render a single more-sheet item with permission check.
// Extracted into its own component so usePermission hook is called once per item (React rules).
function MoreSheetItemWithPermission({
  item,
  onLinkClick,
}: {
  item: ProcessedMenuItem
  onLinkClick: () => void
}) {
  // Always call the hook (React rules) - use the permission if defined, otherwise a dummy permission
  const permissionToCheck = item.requiresPermission as Permission || 'teams.read' as Permission
  const hasPermission = usePermission(permissionToCheck)

  // If permission is required and user doesn't have it, don't render this item
  if (item.requiresPermission && !hasPermission) {
    return null
  }

  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onLinkClick}
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
      target={item.external ? '_blank' : undefined}
      rel={item.external ? 'noopener noreferrer' : undefined}
      data-cy={sel('dashboard.mobile.moreSheet.item', { id: item.id })}
    >
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-medium">{item.label}</span>
    </Link>
  )
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
        external: configItem.external || false,
        requiresPermission: configItem.requiresPermission,
      }
    })

  if (!user) return null

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[20px]"
        data-cy={sel('dashboard.mobile.moreSheet.container')}
      >
        <SheetHeader>
          <SheetTitle>{tCommon('mobileNav.moreOptions')}</SheetTitle>
          <SheetDescription>
            {tCommon('mobileNav.moreOptionsDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {/* Menu Items — each rendered through a permission-aware component */}
          {menuItems.map((item) => (
            <MoreSheetItemWithPermission
              key={item.id}
              item={item}
              onLinkClick={handleLinkClick}
            />
          ))}

          {/* Admin Panel - Solo para superadmin */}
          {isSuperAdmin && (
            <>
              <Separator className="my-2" />
              <Link
                href="/superadmin"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                data-cy={sel('dashboard.mobile.moreSheet.superadminLink')}
              >
                <Shield className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium">Super Admin Panel</span>
              </Link>
            </>
          )}

          {/* Team Switcher */}
          <Separator className="my-2" />
          <div data-cy={sel('dashboard.mobile.moreSheet.teamSwitcher')}>
            <TeamSwitcherCompact className="border-0 p-0" />
          </div>

          <Separator className="my-4" />

          {/* Sign Out */}
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full justify-start gap-3 px-4 py-3 h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            data-cy={sel('dashboard.mobile.moreSheet.signoutButton')}
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
