import {
  Heading,
  LayoutGrid,
  Megaphone,
  BarChart3,
  Component,
  type LucideIcon,
} from 'lucide-react'

/**
 * Category configuration with semantic colors and icons
 * Following the UX design guidelines from the mock
 */
export const CATEGORY_CONFIG = {
  hero: {
    icon: Heading,
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-200',
  },
  content: {
    icon: LayoutGrid,
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
  },
  cta: {
    icon: Megaphone,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
  },
  stats: {
    icon: BarChart3,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  default: {
    icon: Component,
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
} as const

export type CategoryKey = keyof typeof CATEGORY_CONFIG

export interface CategoryConfig {
  icon: LucideIcon
  bgColor: string
  textColor: string
  borderColor: string
}

/**
 * Get category configuration for a given category
 * Falls back to 'default' if category is not found
 */
export function getCategoryConfig(category: string): CategoryConfig {
  return (
    CATEGORY_CONFIG[category as CategoryKey] || CATEGORY_CONFIG.default
  )
}

/**
 * Get the icon component for a given category
 */
export function getCategoryIcon(category: string): LucideIcon {
  return getCategoryConfig(category).icon
}

/**
 * Get the color classes for a given category
 */
export function getCategoryColors(category: string): {
  bg: string
  text: string
  border: string
} {
  const config = getCategoryConfig(category)
  return {
    bg: config.bgColor,
    text: config.textColor,
    border: config.borderColor,
  }
}
