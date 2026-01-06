/**
 * NextSpark Wizard Presets
 *
 * Pre-configured project templates for common use cases.
 * Presets pre-fill all configuration values but still allow customization.
 */

import type {
  WizardConfig,
  PresetName,
  TeamMode,
  BillingModel,
  FeatureFlags,
  ContentFeaturesConfig,
  AuthConfig,
  DashboardConfig,
  DevConfig,
} from './types.js'

/**
 * Partial preset configuration (projectName, projectSlug, projectDescription
 * are always prompted even with presets)
 */
export interface PresetConfig {
  teamMode: TeamMode
  teamRoles: string[]
  defaultLocale: string
  supportedLocales: string[]
  billingModel: BillingModel
  currency: string
  features: FeatureFlags
  contentFeatures: ContentFeaturesConfig
  auth: AuthConfig
  dashboard: DashboardConfig
  dev: DevConfig
}

/**
 * SaaS Preset
 *
 * Multi-tenant SaaS application with freemium billing,
 * team management, and authentication options.
 */
const SAAS_PRESET: PresetConfig = {
  teamMode: 'multi-tenant',
  teamRoles: ['owner', 'admin', 'member', 'viewer'],
  defaultLocale: 'en',
  supportedLocales: ['en'],
  billingModel: 'freemium',
  currency: 'usd',
  features: {
    analytics: true,
    teams: true,
    billing: true,
    api: true,
    docs: false,
  },
  contentFeatures: {
    pages: false,
    blog: false,
  },
  auth: {
    emailPassword: true,
    googleOAuth: true,
    emailVerification: true,
  },
  dashboard: {
    search: true,
    notifications: true,
    themeToggle: true,
    support: true,
    quickCreate: true,
    superadminAccess: true,
    devtoolsAccess: true,
    sidebarCollapsed: false,
  },
  dev: {
    devKeyring: true,
    debugMode: false,
  },
}

/**
 * Blog Preset
 *
 * Single-user blog or content site with no billing,
 * minimal authentication, and simple dashboard.
 */
const BLOG_PRESET: PresetConfig = {
  teamMode: 'single-user',
  teamRoles: ['owner'],
  defaultLocale: 'en',
  supportedLocales: ['en'],
  billingModel: 'free',
  currency: 'usd',
  features: {
    analytics: true,
    teams: false,
    billing: false,
    api: false,
    docs: true,
  },
  contentFeatures: {
    pages: false,
    blog: true,
  },
  auth: {
    emailPassword: true,
    googleOAuth: false,
    emailVerification: false,
  },
  dashboard: {
    search: false,
    notifications: false,
    themeToggle: true,
    support: true,
    quickCreate: false,
    superadminAccess: true,
    devtoolsAccess: true,
    sidebarCollapsed: false,
  },
  dev: {
    devKeyring: true,
    debugMode: false,
  },
}

/**
 * CRM Preset
 *
 * Single-tenant CRM or internal tool with paid subscription,
 * team roles, and full dashboard features.
 */
const CRM_PRESET: PresetConfig = {
  teamMode: 'single-tenant',
  teamRoles: ['owner', 'admin', 'member'],
  defaultLocale: 'en',
  supportedLocales: ['en'],
  billingModel: 'paid',
  currency: 'usd',
  features: {
    analytics: true,
    teams: true,
    billing: true,
    api: true,
    docs: false,
  },
  contentFeatures: {
    pages: true,
    blog: false,
  },
  auth: {
    emailPassword: true,
    googleOAuth: true,
    emailVerification: true,
  },
  dashboard: {
    search: true,
    notifications: true,
    themeToggle: true,
    support: true,
    quickCreate: true,
    superadminAccess: true,
    devtoolsAccess: true,
    sidebarCollapsed: false,
  },
  dev: {
    devKeyring: true,
    debugMode: false,
  },
}

/**
 * All available presets
 */
export const PRESETS: Record<PresetName, PresetConfig> = {
  saas: SAAS_PRESET,
  blog: BLOG_PRESET,
  crm: CRM_PRESET,
}

/**
 * Preset descriptions for display
 */
export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  saas: 'Multi-tenant SaaS with freemium billing and team management',
  blog: 'Single-user blog or content site with minimal features',
  crm: 'Single-tenant CRM or internal tool with paid subscription',
}

/**
 * Get a preset configuration by name
 */
export function getPreset(name: PresetName): PresetConfig {
  const preset = PRESETS[name]
  if (!preset) {
    throw new Error(`Unknown preset: ${name}. Available presets: ${Object.keys(PRESETS).join(', ')}`)
  }
  return preset
}

/**
 * Check if a preset name is valid
 */
export function isValidPreset(name: string): name is PresetName {
  return name in PRESETS
}

/**
 * Get all available preset names
 */
export function getAvailablePresets(): PresetName[] {
  return Object.keys(PRESETS) as PresetName[]
}

/**
 * Apply preset to partial config
 * (merges project info with preset defaults)
 */
export function applyPreset(
  projectInfo: Pick<WizardConfig, 'projectName' | 'projectSlug' | 'projectDescription'>,
  presetName: PresetName
): WizardConfig {
  const preset = getPreset(presetName)
  return {
    ...projectInfo,
    ...preset,
  }
}

/**
 * Get default configuration (used when no preset is specified)
 * This provides sensible defaults for all fields.
 */
export function getDefaultConfig(): PresetConfig {
  return {
    teamMode: 'multi-tenant',
    teamRoles: ['owner', 'admin', 'member', 'viewer'],
    defaultLocale: 'en',
    supportedLocales: ['en'],
    billingModel: 'freemium',
    currency: 'usd',
    features: {
      analytics: true,
      teams: true,
      billing: true,
      api: true,
      docs: false,
    },
    contentFeatures: {
      pages: false,
      blog: false,
    },
    auth: {
      emailPassword: true,
      googleOAuth: false,
      emailVerification: true,
    },
    dashboard: {
      search: true,
      notifications: true,
      themeToggle: true,
      support: true,
      quickCreate: true,
      superadminAccess: true,
      devtoolsAccess: true,
      sidebarCollapsed: false,
    },
    dev: {
      devKeyring: true,
      debugMode: false,
    },
  }
}
