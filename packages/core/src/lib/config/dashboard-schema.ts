/**
 * Dashboard Configuration Zod Schema
 *
 * Validates that theme-specific dashboard.config.ts files conform to the expected structure.
 * This schema is used during build time and development to catch configuration errors early.
 */

import { z } from 'zod'

// =============================================================================
// TOPBAR SCHEMAS
// =============================================================================

const topbarSearchSchema = z.object({
  enabled: z.boolean().optional(),
  placeholder: z.string().optional(),
  maxResults: z.number().optional(),
})

const topbarNotificationsSchema = z.object({
  enabled: z.boolean().optional(),
})

const topbarThemeToggleSchema = z.object({
  enabled: z.boolean().optional(),
})

const topbarSupportLinkSchema = z.object({
  label: z.string(),
  url: z.string().optional(),
  icon: z.string(),
  external: z.boolean().optional(),
  action: z.string().optional(),
})

const topbarSupportSchema = z.object({
  enabled: z.boolean().optional(),
  type: z.enum(['dropdown', 'link', 'modal']).optional(),
  links: z.array(topbarSupportLinkSchema).optional(),
})

const topbarQuickCreateSchema = z.object({
  enabled: z.boolean().optional(),
})

const topbarUserMenuItemSchema = z.object({
  type: z.enum(['link', 'action', 'divider']),
  label: z.string().optional(),
  href: z.string().optional(),
  icon: z.string().optional(),
  action: z.string().optional(),
})

const topbarUserMenuSchema = z.object({
  enabled: z.boolean().optional(),
  showAvatar: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  showRole: z.boolean().optional(),
  items: z.array(topbarUserMenuItemSchema).optional(),
})

const topbarConfigSchema = z.object({
  search: topbarSearchSchema.optional(),
  notifications: topbarNotificationsSchema.optional(),
  themeToggle: topbarThemeToggleSchema.optional(),
  support: topbarSupportSchema.optional(),
  quickCreate: topbarQuickCreateSchema.optional(),
  userMenu: topbarUserMenuSchema.optional(),
})

// =============================================================================
// SIDEBAR SCHEMAS
// =============================================================================

const sidebarToggleSchema = z.object({
  enabled: z.boolean().optional(),
  showInTopbar: z.boolean().optional(),
  hideOnMobile: z.boolean().optional(),
})

const sidebarNavigationSchema = z.object({
  showEntityCounts: z.boolean().optional(),
  groupEntities: z.boolean().optional(),
  showRecents: z.boolean().optional(),
  maxRecents: z.number().optional(),
})

const sidebarConfigSchema = z.object({
  defaultCollapsed: z.boolean().optional(),
  rememberState: z.boolean().optional(),
  collapsedWidth: z.string().optional(),
  expandedWidth: z.string().optional(),
  toggle: sidebarToggleSchema.optional(),
  navigation: sidebarNavigationSchema.optional(),
})

// =============================================================================
// SETTINGS SCHEMAS
// =============================================================================

const settingsPageFeaturesSchema = z.record(z.string(), z.boolean())

const settingsPageSchema = z.object({
  enabled: z.boolean().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().optional(),
  features: settingsPageFeaturesSchema.optional(),
  requiredRole: z.string().optional(),
})

const settingsLayoutSchema = z.object({
  showDescription: z.boolean().optional(),
  showIcons: z.boolean().optional(),
  groupByCategory: z.boolean().optional(),
  enableSearch: z.boolean().optional(),
})

const settingsConfigSchema = z.object({
  pages: z.record(z.string(), settingsPageSchema).optional(),
  layout: settingsLayoutSchema.optional(),
})

// =============================================================================
// ENTITIES SCHEMAS
// =============================================================================

const entitiesPaginationSchema = z.object({
  defaultPageSize: z.number().optional(),
  allowedPageSizes: z.array(z.number()).optional(),
  showSizeSelector: z.boolean().optional(),
})

const entitiesSortingSchema = z.object({
  enabled: z.boolean().optional(),
  defaultSort: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
  rememberSort: z.boolean().optional(),
})

const entitiesFilteringSchema = z.object({
  enabled: z.boolean().optional(),
  quickFilters: z.boolean().optional(),
  advancedFilters: z.boolean().optional(),
  rememberFilters: z.boolean().optional(),
})

const entitiesSearchSchema = z.object({
  enabled: z.boolean().optional(),
  placeholder: z.string().optional(),
  searchableFields: z.array(z.string()).optional(),
  instantSearch: z.boolean().optional(),
  debounceMs: z.number().optional(),
})

const entitiesListViewSchema = z.object({
  pagination: entitiesPaginationSchema.optional(),
  sorting: entitiesSortingSchema.optional(),
  filtering: entitiesFilteringSchema.optional(),
  search: entitiesSearchSchema.optional(),
})

const entitiesValidationSchema = z.object({
  validateOnBlur: z.boolean().optional(),
  validateOnChange: z.boolean().optional(),
  showFieldErrors: z.boolean().optional(),
  showFormErrors: z.boolean().optional(),
})

const entitiesAutosaveSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMs: z.number().optional(),
  showIndicator: z.boolean().optional(),
})

const entitiesConfirmationSchema = z.object({
  showOnCreate: z.boolean().optional(),
  showOnUpdate: z.boolean().optional(),
  showOnDelete: z.boolean().optional(),
})

const entitiesFormViewSchema = z.object({
  validation: entitiesValidationSchema.optional(),
  autosave: entitiesAutosaveSchema.optional(),
  confirmation: entitiesConfirmationSchema.optional(),
})

const entitiesCustomizationSchema = z.object({
  listView: z.any().optional(),
  formView: z.any().optional(),
})

const entitiesConfigSchema = z.object({
  defaultListView: entitiesListViewSchema.optional(),
  defaultFormView: entitiesFormViewSchema.optional(),
  customizations: z.record(z.string(), entitiesCustomizationSchema).optional(),
})

// =============================================================================
// HOMEPAGE SCHEMAS
// =============================================================================

const homepageWelcomeSchema = z.object({
  enabled: z.boolean().optional(),
  showUserName: z.boolean().optional(),
  showLastLogin: z.boolean().optional(),
  showQuickActions: z.boolean().optional(),
})

const homepageStatsSchema = z.object({
  enabled: z.boolean().optional(),
  entities: z.array(z.string()).optional(),
  timeframe: z.enum(['today', '7days', '30days', '90days']).optional(),
  showTrends: z.boolean().optional(),
})

const homepageRecentActivitySchema = z.object({
  enabled: z.boolean().optional(),
  maxItems: z.number().optional(),
  entities: z.array(z.string()).optional(),
  showTimestamps: z.boolean().optional(),
})

const homepageQuickActionSchema = z.object({
  entity: z.string(),
  action: z.string(),
  label: z.string(),
})

const homepageQuickActionsSchema = z.object({
  enabled: z.boolean().optional(),
  actions: z.array(homepageQuickActionSchema).optional(),
})

const homepageWidgetsSchema = z.object({
  welcome: homepageWelcomeSchema.optional(),
  stats: homepageStatsSchema.optional(),
  recentActivity: homepageRecentActivitySchema.optional(),
  quickActions: homepageQuickActionsSchema.optional(),
})

const homepageLayoutSchema = z.object({
  columns: z.number().optional(),
  gutter: z.enum(['small', 'medium', 'large']).optional(),
  responsive: z.boolean().optional(),
})

const homepageConfigSchema = z.object({
  widgets: homepageWidgetsSchema.optional(),
  layout: homepageLayoutSchema.optional(),
})

// =============================================================================
// PERFORMANCE SCHEMAS
// =============================================================================

const performanceCacheItemSchema = z.object({
  enabled: z.boolean().optional(),
  duration: z.number().optional(),
})

const performanceCacheSchema = z.object({
  entityConfigs: performanceCacheItemSchema.optional(),
  entityData: performanceCacheItemSchema.optional(),
})

const performanceLoadingSchema = z.object({
  showSkeletons: z.boolean().optional(),
  showProgressBars: z.boolean().optional(),
  minimumLoadingTime: z.number().optional(),
})

const performanceErrorsSchema = z.object({
  showErrorBoundaries: z.boolean().optional(),
  logErrors: z.boolean().optional(),
  enableRetry: z.boolean().optional(),
  maxRetries: z.number().optional(),
})

const performanceConfigSchema = z.object({
  cache: performanceCacheSchema.optional(),
  loading: performanceLoadingSchema.optional(),
  errors: performanceErrorsSchema.optional(),
})

// =============================================================================
// ACCESSIBILITY SCHEMAS
// =============================================================================

const accessibilityKeyboardSchema = z.object({
  enabled: z.boolean().optional(),
  showShortcuts: z.boolean().optional(),
  customShortcuts: z.record(z.string(), z.string()).optional(),
})

const accessibilityScreenReaderSchema = z.object({
  announceNavigation: z.boolean().optional(),
  announceActions: z.boolean().optional(),
  announceErrors: z.boolean().optional(),
})

const accessibilityVisualSchema = z.object({
  showFocusOutlines: z.boolean().optional(),
  highContrastMode: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
})

const accessibilityConfigSchema = z.object({
  keyboard: accessibilityKeyboardSchema.optional(),
  screenReader: accessibilityScreenReaderSchema.optional(),
  visual: accessibilityVisualSchema.optional(),
})

// =============================================================================
// MAIN DASHBOARD CONFIG SCHEMA
// =============================================================================

/**
 * Schema for theme-specific dashboard configuration
 * All properties are optional since themes only need to override what they want to change
 */
export const dashboardConfigSchema = z.object({
  topbar: topbarConfigSchema.optional(),
  sidebar: sidebarConfigSchema.optional(),
  settings: settingsConfigSchema.optional(),
  entities: entitiesConfigSchema.optional(),
  homepage: homepageConfigSchema.optional(),
  performance: performanceConfigSchema.optional(),
  accessibility: accessibilityConfigSchema.optional(),

  // Helper functions (optional, will be added by merge system if not present)
  isSettingsPageEnabled: z.function().optional(),
  getEnabledSettingsPages: z.function().optional(),
  isTopbarFeatureEnabled: z.function().optional(),
})

/**
 * Type inference from schema
 */
export type DashboardConfigInput = z.input<typeof dashboardConfigSchema>
export type DashboardConfigOutput = z.output<typeof dashboardConfigSchema>

/**
 * Validate a dashboard configuration object
 *
 * @param config - The configuration object to validate
 * @returns Validated configuration
 * @throws ZodError if validation fails
 */
export function validateDashboardConfig(config: unknown): DashboardConfigOutput {
  return dashboardConfigSchema.parse(config)
}

/**
 * Safely validate a dashboard configuration object
 *
 * @param config - The configuration object to validate
 * @returns Success result with validated config or error result with issues
 */
export function safeValidateDashboardConfig(config: unknown) {
  return dashboardConfigSchema.safeParse(config)
}