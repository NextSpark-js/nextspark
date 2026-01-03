/**
 * Type-Safe Icon Map
 *
 * This file provides a type-safe mapping of icon names to Lucide React icon components.
 * Using this map instead of dynamic imports ensures:
 * - Full TypeScript type checking
 * - IDE auto-completion
 * - Compile-time error detection
 * - No runtime errors from invalid icon names
 *
 * @example
 * ```typescript
 * import { ICON_MAP, getIcon } from './icon-map'
 *
 * // Type-safe icon access
 * const HomeIcon = ICON_MAP.Home
 * const Icon = getIcon('Home') // Returns Home icon
 * const Fallback = getIcon('InvalidName') // Returns HelpCircle
 * ```
 */

import {
  Home,
  CheckSquare,
  Plus,
  Settings,
  Menu,
  User,
  Users,
  CreditCard,
  Key,
  HelpCircle,
  Shield,
  LogOut,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronLeft,
  FileText,
  Sparkles,
  PackageSearch,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icon Map
 *
 * Maps string icon names to actual Lucide icon components.
 * Add new icons here as needed.
 */
export const ICON_MAP = {
  // Navigation icons
  Home,
  CheckSquare,
  Plus,
  Settings,
  Menu,
  Search,
  ChevronLeft,

  // User & Account icons
  User,
  Users,
  CreditCard,
  Key,
  Shield,
  LogOut,

  // UI icons
  Bell,
  Sun,
  Moon,

  // Content icons
  FileText,
  Sparkles,
  PackageSearch,

  // Fallback icon
  HelpCircle,
} as const

/**
 * Icon Name Type
 *
 * Union type of all valid icon names.
 * TypeScript will enforce that only these names can be used.
 */
export type IconName = keyof typeof ICON_MAP

/**
 * Get Icon Component
 *
 * Type-safe function to get an icon component by name.
 * Returns HelpCircle as fallback if icon name is not found.
 *
 * @param name - The icon name
 * @returns The icon component
 *
 * @example
 * ```typescript
 * const HomeIcon = getIcon('Home')
 * const FallbackIcon = getIcon('NonExistent' as IconName)
 * ```
 */
export function getIcon(name: IconName): LucideIcon {
  return ICON_MAP[name] || ICON_MAP.HelpCircle
}

/**
 * Validate Icon Name
 *
 * Checks if a string is a valid icon name.
 * Useful for runtime validation of config files.
 *
 * @param name - The name to validate
 * @returns True if the name is a valid icon name
 *
 * @example
 * ```typescript
 * if (isValidIconName('Home')) {
 *   // Safe to use
 * }
 * ```
 */
export function isValidIconName(name: string): name is IconName {
  return name in ICON_MAP
}

/**
 * Get All Icon Names
 *
 * Returns an array of all valid icon names.
 * Useful for validation or documentation.
 *
 * @returns Array of icon names
 */
export function getAllIconNames(): IconName[] {
  return Object.keys(ICON_MAP) as IconName[]
}
