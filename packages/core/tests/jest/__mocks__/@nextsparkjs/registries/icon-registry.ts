/**
 * Mock Icon Registry for Jest tests
 *
 * Holds the real lucide components, not stand-ins: serialization resolves an
 * icon's registry name by identity, so a config's `icon: CheckSquare` only
 * round-trips when the registry holds that same component.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Box,
  CheckSquare,
  Circle,
  FileText,
  Folder,
  Home,
  LayoutGrid,
  Newspaper,
  Search,
  Settings,
  Users
} from 'lucide-react'

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Box,
  CheckSquare,
  Circle,
  FileText,
  Folder,
  Home,
  LayoutGrid,
  Newspaper,
  Search,
  Settings,
  Users
}

export type IconName = keyof typeof ICON_REGISTRY

export const ICON_METADATA = {
  totalIcons: Object.keys(ICON_REGISTRY).length,
  generatedAt: new Date().toISOString()
}
