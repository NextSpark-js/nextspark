/**
 * NextSpark Wizard Presets
 *
 * Pre-configured project templates for common use cases.
 * Presets pre-fill all configuration values but still allow customization.
 */

import type {
  WizardConfig,
  PresetName,
  ProjectType,
  TeamMode,
  BillingModel,
  FeatureFlags,
  ContentFeaturesConfig,
  AuthConfig,
  DashboardConfig,
  DevConfig,
} from './types.js'
import { AVAILABLE_LOCALES } from './types.js'

/**
 * Partial preset configuration (projectName, projectSlug, projectDescription
 * are always prompted even with presets)
 */
export interface PresetConfig {
  projectType: ProjectType
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
 * Multi-tenant SaaS application with no billing (freemium and paid are
 * chosen explicitly), team management, and authentication options.
 */
const SAAS_PRESET: PresetConfig = {
  projectType: 'web',
  teamMode: 'multi-tenant',
  teamRoles: ['owner', 'admin', 'member', 'viewer'],
  defaultLocale: 'en',
  supportedLocales: ['en'],
  billingModel: 'free',
  currency: 'usd',
  features: {
    analytics: true,
    teams: true,
    billing: false,
    api: true,
    docs: false,
  },
  contentFeatures: {
    pages: false,
    blog: false,
  },
  auth: {
    registrationMode: 'open',
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
  projectType: 'web',
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
    registrationMode: 'invitation-only',
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
  projectType: 'web',
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
    registrationMode: 'invitation-only',
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
 * The preset `--yes` runs with when none is named.
 *
 * `--yes` promises defaults rather than prompts, so it needs a concrete set of
 * them: without one the wizard opens Step 1 and, with no TTY to answer it,
 * aborts after the dependency install has already run.
 */
export const DEFAULT_PRESET: PresetName = 'saas'

/**
 * Preset descriptions for display
 */
export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  saas: 'Multi-tenant SaaS with team management and no billing',
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

/** The languages of a project: what the i18n prompt returns. */
export type LocaleSelection = Pick<WizardConfig, 'defaultLocale' | 'supportedLocales'>

/**
 * The languages `--locales` (and `--default-locale`) select, as the i18n prompt would return them: the supported
 * locales in the catalog's order whatever the order given, each once, and the default one the prompt offers first
 * (`en` when selected, else the first). An unknown locale, an empty list, or a default that is not in the list throws.
 */
export function parseLocales(locales: string, defaultLocale?: string): LocaleSelection {
  const valid = Object.keys(AVAILABLE_LOCALES)
  const requested = locales.split(',').map(l => l.trim().toLowerCase()).filter(Boolean)
  if (requested.length === 0) {
    throw new Error(`--locales needs at least one language. Valid locales: ${valid.join(', ')}.`)
  }
  const unknown = requested.filter(l => !valid.includes(l))
  if (unknown.length > 0) {
    throw new Error(`Unknown locale${unknown.length > 1 ? 's' : ''} "${unknown.join('", "')}" in --locales. Valid locales: ${valid.join(', ')}.`)
  }
  const supportedLocales = valid.filter(l => requested.includes(l))
  const chosen = defaultLocale?.trim().toLowerCase()
  if (chosen !== undefined && !supportedLocales.includes(chosen)) {
    throw new Error(`--default-locale "${defaultLocale}" is not one of the selected locales (${supportedLocales.join(', ')}).`)
  }
  return {
    supportedLocales,
    defaultLocale: chosen ?? (supportedLocales.includes('en') ? 'en' : supportedLocales[0]),
  }
}

/**
 * Apply preset to partial config
 * (merges project info with preset defaults)
 * Optional typeOverride allows CLI to specify project type
 * Optional locales replaces the preset's languages (--locales)
 */
export function applyPreset(
  projectInfo: Pick<WizardConfig, 'projectName' | 'projectSlug' | 'projectDescription'>,
  presetName: PresetName,
  typeOverride?: ProjectType,
  locales?: LocaleSelection
): WizardConfig {
  const preset = getPreset(presetName)
  return {
    ...projectInfo,
    ...preset,
    // Apply type override if provided
    ...(typeOverride && { projectType: typeOverride }),
    ...locales,
  }
}

/**
 * Get default configuration (used when no preset is specified)
 * This provides sensible defaults for all fields.
 */
export function getDefaultConfig(): PresetConfig {
  return {
    projectType: 'web',
    teamMode: 'multi-tenant',
    teamRoles: ['owner', 'admin', 'member', 'viewer'],
    defaultLocale: 'en',
    supportedLocales: ['en'],
    billingModel: 'free',
    currency: 'usd',
    features: {
      analytics: true,
      teams: true,
      billing: false,
      api: true,
      docs: false,
    },
    contentFeatures: {
      pages: false,
      blog: false,
    },
    auth: {
      registrationMode: 'open',
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
