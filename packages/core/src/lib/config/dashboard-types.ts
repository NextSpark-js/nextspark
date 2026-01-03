/**
 * Dashboard Configuration Types
 * 
 * Types and interfaces specific to dashboard configuration.
 * These define the structure for dashboard-specific settings.
 */

// =============================================================================
// DASHBOARD CONFIGURATION INTERFACES
// =============================================================================

export interface TopbarConfig {
  search: {
    enabled: boolean
    placeholder: string
    maxResults: number
  }
  notifications: {
    enabled: boolean
    maxVisible: number
    autoRefresh: boolean
    refreshInterval: number
    showBadge: boolean
    playSound: boolean
  }
  themeToggle: {
    enabled: boolean
  }
  support: {
    enabled: boolean
    type: 'dropdown' | 'link' | 'modal'
    links: readonly SupportLinkConfig[]
  }
  quickCreate: {
    enabled: boolean
  }
  userMenu: {
    enabled: boolean
    showAvatar: boolean
    showEmail: boolean
    showRole: boolean
    items: readonly UserMenuItemConfig[]
  }
}

export interface SupportLinkConfig {
  label: string
  url?: string
  icon: string
  external?: boolean
  action?: string
}

export interface UserMenuItemConfig {
  type: 'link' | 'action' | 'divider'
  label?: string
  href?: string
  action?: string
  icon?: string
}

export interface SidebarConfig {
  defaultCollapsed: boolean
  rememberState: boolean
  collapsedWidth: string
  expandedWidth: string
  toggle: {
    enabled: boolean
    showInTopbar: boolean
    hideOnMobile: boolean
  }
  navigation: {
    showEntityCounts: boolean
    groupEntities: boolean
    showRecents: boolean
    maxRecents: number
  }
}

export interface SettingsPageConfig {
  enabled: boolean
  label: string
  description: string
  icon: string
  order: number
  features: Record<string, boolean>
  requiredRole?: string
}

export interface SettingsConfig {
  pages: Record<string, SettingsPageConfig>
  layout: {
    showDescription: boolean
    showIcons: boolean
    groupByCategory: boolean
    enableSearch: boolean
  }
}

export interface EntityListViewConfig {
  pagination: {
    defaultPageSize: number
    allowedPageSizes: readonly number[]
    showSizeSelector: boolean
  }
  sorting: {
    enabled: boolean
    defaultSort: { field: string; direction: 'asc' | 'desc' }
    rememberSort: boolean
  }
  filtering: {
    enabled: boolean
    quickFilters: boolean
    advancedFilters: boolean
    rememberFilters: boolean
  }
  search: {
    enabled: boolean
    placeholder: string
    searchableFields: readonly string[]
    instantSearch: boolean
    debounceMs: number
  }
}

export interface EntityFormViewConfig {
  validation: {
    validateOnBlur: boolean
    validateOnChange: boolean
    showFieldErrors: boolean
    showFormErrors: boolean
  }
  autosave: {
    enabled: boolean
    intervalMs: number
    showIndicator: boolean
  }
  confirmation: {
    showOnCreate: boolean
    showOnUpdate: boolean
    showOnDelete: boolean
  }
}

export interface EntityCustomizationConfig {
  listView?: Partial<EntityListViewConfig>
  formView?: Partial<EntityFormViewConfig>
}

export interface EntitiesConfig {
  defaultListView: EntityListViewConfig
  defaultFormView: EntityFormViewConfig
  customizations: Record<string, EntityCustomizationConfig>
}

export interface HomepageWidgetConfig {
  enabled: boolean
  [key: string]: unknown
}

export interface HomepageConfig {
  widgets: {
    welcome: HomepageWidgetConfig & {
      showUserName: boolean
      showLastLogin: boolean
      showQuickActions: boolean
    }
    stats: HomepageWidgetConfig & {
      entities: readonly string[]
      timeframe: 'today' | '7days' | '30days' | '90days'
      showTrends: boolean
    }
    recentActivity: HomepageWidgetConfig & {
      maxItems: number
      entities: readonly string[]
      showTimestamps: boolean
    }
    quickActions: HomepageWidgetConfig & {
      actions: readonly QuickActionConfig[]
    }
  }
  layout: {
    columns: number
    gutter: 'small' | 'medium' | 'large'
    responsive: boolean
  }
}

export interface QuickActionConfig {
  entity: string
  action: string
  label: string
}

export interface PerformanceConfig {
  cache: {
    entityConfigs: {
      enabled: boolean
      duration: number
    }
    entityData: {
      enabled: boolean
      duration: number
    }
  }
  loading: {
    showSkeletons: boolean
    showProgressBars: boolean
    minimumLoadingTime: number
  }
  errors: {
    showErrorBoundaries: boolean
    logErrors: boolean
    enableRetry: boolean
    maxRetries: number
  }
}

export interface AccessibilityConfig {
  keyboard: {
    enabled: boolean
    showShortcuts: boolean
    customShortcuts: Record<string, string>
  }
  screenReader: {
    announceNavigation: boolean
    announceActions: boolean
    announceErrors: boolean
  }
  visual: {
    showFocusOutlines: boolean
    highContrastMode: boolean
    reducedMotion: boolean
  }
}

export interface DashboardConfig {
  topbar: TopbarConfig
  sidebar: SidebarConfig
  settings: SettingsConfig
  entities: EntitiesConfig
  homepage: HomepageConfig
  performance: PerformanceConfig
  accessibility: AccessibilityConfig
}

// =============================================================================
// CONVENIENCE TYPES
// =============================================================================

export type SettingsPageKey = keyof SettingsConfig['pages']
export type TopbarFeature = keyof TopbarConfig
export type EntityName = string
export type SupportAction = 'showKeyboardShortcuts' | 'openChat' | 'openTicket'
export type UserMenuAction = 'signOut' | 'switchAccount' | 'showProfile'
