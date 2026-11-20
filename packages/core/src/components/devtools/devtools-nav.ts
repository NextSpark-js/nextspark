import type { ComponentType } from 'react'
import {
  LayoutDashboard, Palette, FileText, Settings, Layers, GitBranch, LayoutGrid, Tag, Clock, Puzzle, Star, Code, Bell, Globe,
} from 'lucide-react'

/** The devtools area's root: its dashboard. Every other devtools page lives under it. */
export const DEVTOOLS_ROOT = '/devtools'

export interface DevtoolsNavItem {
  titleKey: string
  href: string
  icon: ComponentType<{ className?: string }>
  descriptionKey: string
}

/** The sections of the devtools area: the one list the sidebar, the mobile menu and the dashboard render. */
export const DEVTOOLS_NAV_ITEMS: DevtoolsNavItem[] = [
  { titleKey: 'nav.home', href: DEVTOOLS_ROOT, icon: LayoutDashboard, descriptionKey: 'nav.homeDescription' },
  { titleKey: 'nav.styleGallery', href: '/devtools/style', icon: Palette, descriptionKey: 'nav.styleGalleryDescription' },
  { titleKey: 'nav.testCases', href: '/devtools/tests', icon: FileText, descriptionKey: 'nav.testCasesDescription' },
  { titleKey: 'nav.features', href: '/devtools/features', icon: Layers, descriptionKey: 'nav.featuresDescription' },
  { titleKey: 'nav.flows', href: '/devtools/flows', icon: GitBranch, descriptionKey: 'nav.flowsDescription' },
  { titleKey: 'nav.blocks', href: '/devtools/blocks', icon: LayoutGrid, descriptionKey: 'nav.blocksDescription' },
  { titleKey: 'nav.tags', href: '/devtools/tags', icon: Tag, descriptionKey: 'nav.tagsDescription' },
  { titleKey: 'nav.config', href: '/devtools/config', icon: Settings, descriptionKey: 'nav.configDescription' },
  { titleKey: 'nav.api', href: '/devtools/api', icon: Layers, descriptionKey: 'nav.apiDescription' },
  { titleKey: 'nav.scheduledActions', href: '/devtools/scheduled-actions', icon: Clock, descriptionKey: 'nav.scheduledActionsDescription' },
]

/** The icons a plugin's devtools nav item can name; any other name shows the puzzle piece. */
const PLUGIN_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Puzzle, Settings, Star, Code, LayoutGrid, Bell, Globe, Layers, GitBranch, Tag,
}

export function pluginNavIcon(name?: string): ComponentType<{ className?: string }> {
  return PLUGIN_ICON_MAP[name ?? ''] ?? Puzzle
}

/**
 * Whether the nav item at `href` is the current page: the item itself or a page under it. The area's root is
 * matched exactly, since it is a prefix of every devtools page (#496).
 */
export function isDevtoolsNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (href === DEVTOOLS_ROOT) return path === href
  return path === href || path.startsWith(href + '/')
}
