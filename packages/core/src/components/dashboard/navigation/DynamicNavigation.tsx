'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { cn } from '../../../lib/utils'
import { useTranslations } from 'next-intl'
import { createCyId } from '../../../lib/test'
import { Home, FileText, LucideIcon, ChevronDown } from 'lucide-react'
import * as Icons from 'lucide-react'
import type { SerializableEntityConfig } from '../../../lib/entities/serialization'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry'
import { usePermission } from '../../../lib/permissions/hooks'
import type { Permission } from '../../../lib/permissions/types'

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  descriptionKey?: string
}

interface CustomSidebarSection {
  id: string
  labelKey: string
  icon: string
  order: number
  requiresPermission?: string
  items: {
    id: string
    labelKey: string
    href: string
    icon: string
  }[]
}

interface DynamicNavigationProps {
  className?: string
  isMobile?: boolean
  onItemClick?: () => void
  entities: SerializableEntityConfig[]
}

// Get active theme from environment
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
const themeConfig = THEME_REGISTRY[activeTheme as keyof typeof THEME_REGISTRY]
const customSidebarSections: CustomSidebarSection[] = themeConfig?.appConfig?.customSidebarSections || []

// Core navigation items that are always present (static)
const coreItems: NavigationItem[] = [
  {
    name: 'dashboard',
    href: '/dashboard',
    icon: Home,
    descriptionKey: 'dashboard'
  },
  {
    name: 'pages',
    href: '/dashboard/pages',
    icon: FileText,
    descriptionKey: 'pages'
  },
]

// Static label mappings for LMS navigation (fallback when translations unavailable)
const labelMappings: Record<string, string> = {
  'navigation.learn': 'Learn',
  'navigation.teach': 'Teach',
  'navigation.myCourses': 'My Courses',
  'navigation.catalog': 'Catalog',
  'navigation.courses': 'Courses',
  'navigation.lessons': 'Lessons',
  'navigation.analytics': 'Analytics',
}

// Component to render section with permission check
function SectionWithPermission({
  section,
  pathname,
  isMobile,
  onItemClick,
  t
}: {
  section: CustomSidebarSection
  pathname: string
  isMobile: boolean
  onItemClick?: () => void
  t: (key: string) => string
}) {
  // Always call the hook (React rules) - use the permission if defined, otherwise a dummy permission
  const permissionToCheck = section.requiresPermission as Permission || 'teams.read' as Permission
  const hasPermission = usePermission(permissionToCheck)

  // If permission is required and user doesn't have it, don't render
  // If no permission required, always render (hasPermission check skipped)
  if (section.requiresPermission && !hasPermission) {
    return null
  }

  const SectionIcon = (Icons[section.icon as keyof typeof Icons] || Icons.Folder) as LucideIcon

  // Helper to strip 'common.' prefix from labelKey since we're using useTranslations('common')
  const normalizeKey = (key: string) => key.startsWith('common.') ? key.slice(7) : key

  // Get section label using translation with fallback to static mapping
  const normalizedSectionKey = normalizeKey(section.labelKey)
  const sectionLabel = t(normalizedSectionKey) || labelMappings[section.labelKey] || section.id

  return (
    <div className="mb-4" data-cy={createCyId('nav', `section-${section.id}`)}>
      <div
        className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"
        data-cy={createCyId('nav', `section-label-${section.id}`)}
      >
        <SectionIcon className="h-3 w-3" />
        <span>{sectionLabel}</span>
      </div>
      <div className="space-y-1">
        {section.items.map((item) => {
          const ItemIcon = (Icons[item.icon as keyof typeof Icons] || Icons.Circle) as LucideIcon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          // Get item label using translation with fallback to static mapping
          const normalizedItemKey = normalizeKey(item.labelKey)
          const itemLabel = t(normalizedItemKey) || labelMappings[item.labelKey] || item.id

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                isMobile && "w-full"
              )}
              aria-current={isActive ? 'page' : undefined}
              data-cy={createCyId('nav', `section-item-${section.id}-${item.id}`)}
            >
              <ItemIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{itemLabel}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function DynamicNavigation({
  className,
  isMobile = false,
  onItemClick,
  entities
}: DynamicNavigationProps) {
  const pathname = usePathname()
  const t = useTranslations('navigation')

  // Check if theme has custom sidebar sections
  const hasCustomSections = customSidebarSections.length > 0

  // Fallback: Use entities if no custom sections defined
  const enabledEntities = useMemo(() =>
    entities.filter(entity => entity?.enabled && entity?.ui?.dashboard?.showInMenu),
    [entities]
  )

  const entityItems: NavigationItem[] = useMemo(() =>
    enabledEntities.map(entity => {
      const icon = (Icons[entity.iconName as keyof typeof Icons] || Icons.Box) as LucideIcon
      return {
        name: entity.names?.plural || entity.slug,
        href: `/dashboard/${entity.slug}`,
        icon,
      }
    }),
    [enabledEntities]
  )

  // Sort custom sections by order
  const sortedSections = useMemo(() =>
    [...customSidebarSections].sort((a, b) => a.order - b.order),
    []
  )

  // If theme has custom sections, use those; otherwise fallback to entity-based navigation
  if (hasCustomSections) {
    return (
      <nav className={cn("space-y-1", className)} data-cy={createCyId('nav', 'main')}>
        {/* Dashboard link always visible */}
        <Link
          href="/dashboard"
          onClick={onItemClick}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-4",
            pathname === '/dashboard'
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            isMobile && "w-full"
          )}
          aria-current={pathname === '/dashboard' ? 'page' : undefined}
          data-cy={createCyId('nav', 'link-dashboard')}
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('navigation.dashboard')}</span>
        </Link>

        {/* Custom sections with permission checking */}
        {sortedSections.map((section) => (
          <SectionWithPermission
            key={section.id}
            section={section}
            pathname={pathname}
            isMobile={isMobile}
            onItemClick={onItemClick}
            t={t}
          />
        ))}
      </nav>
    )
  }

  // Fallback: Original entity-based navigation
  const navigationItems = [...coreItems, ...entityItems]

  return (
    <nav className={cn("space-y-1", className)} data-cy={createCyId('nav', 'main')}>
      {navigationItems.map((item) => (
        <NavigationLink
          key={item.name}
          item={item}
          pathname={pathname}
          t={t}
          isMobile={isMobile}
          onItemClick={onItemClick}
        />
      ))}
    </nav>
  )
}

interface NavigationLinkProps {
  item: NavigationItem
  pathname: string
  t: (key: string, options?: { defaultValue?: string }) => string
  isMobile?: boolean
  onItemClick?: () => void
}

function NavigationLink({
  item,
  pathname,
  t,
  isMobile = false,
  onItemClick
}: NavigationLinkProps) {
  const Icon = item.icon
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

  // Get translation with fallback to name
  const label = item.descriptionKey
    ? t(item.descriptionKey, { defaultValue: item.name })
    : item.name

  // Generate data-cy id based on the item name (slug-ified)
  const cySlug = item.name.toLowerCase().replace(/\s+/g, '-')

  return (
    <Link
      href={item.href}
      onClick={onItemClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
        isMobile && "w-full"
      )}
      aria-current={isActive ? 'page' : undefined}
      data-cy={createCyId('nav', `link-entity-${cySlug}`)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

export default DynamicNavigation