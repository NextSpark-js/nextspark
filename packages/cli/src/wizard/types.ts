/**
 * NextSpark Wizard Types
 *
 * Shared type definitions for the wizard prompts and generators.
 */

/**
 * Team mode options for the project
 */
export type TeamMode = 'multi-tenant' | 'single-tenant' | 'single-user'

/**
 * Billing model options
 */
export type BillingModel = 'free' | 'freemium' | 'paid'

/**
 * CLI execution modes
 */
export type WizardMode = 'interactive' | 'quick' | 'expert'

/**
 * Available presets
 */
export type PresetName = 'saas' | 'blog' | 'crm'

/**
 * Available feature flags
 */
export interface FeatureFlags {
  analytics: boolean
  teams: boolean
  billing: boolean
  api: boolean
  docs: boolean
}

/**
 * Authentication configuration (Step 7)
 * Note: Only email/password and Google OAuth are currently supported
 */
export interface AuthConfig {
  emailPassword: boolean
  googleOAuth: boolean
  emailVerification: boolean
}

/**
 * Dashboard configuration (Step 8)
 */
export interface DashboardConfig {
  search: boolean
  notifications: boolean
  themeToggle: boolean
  support: boolean
  quickCreate: boolean
  superadminAccess: boolean
  devtoolsAccess: boolean
  sidebarCollapsed: boolean
}

/**
 * Content features configuration (Step 6)
 * Optional content types: Pages with Page Builder and Blog
 */
export interface ContentFeaturesConfig {
  pages: boolean  // Enable pages with page builder
  blog: boolean   // Enable blog with posts
}

/**
 * Development tools configuration (Step 9)
 */
export interface DevConfig {
  devKeyring: boolean
  debugMode: boolean
}

/**
 * Theme selection options for CLI
 */
export type ThemeOption = 'default' | 'blog' | 'crm' | 'productivity' | 'none'

/**
 * Plugin selection options for CLI
 */
export type PluginOption = 'ai' | 'langchain' | 'social-media-publisher'

/**
 * CLI options parsed from command line arguments
 */
export interface CLIOptions {
  mode: WizardMode
  preset?: PresetName
  // Non-interactive options
  theme?: ThemeOption
  plugins?: PluginOption[]
  yes?: boolean // Skip confirmations for automation
}

/**
 * Complete wizard configuration collected from all prompts
 */
export interface WizardConfig {
  // Step 1: Project Info
  projectName: string
  projectSlug: string
  projectDescription: string

  // Step 2: Team Configuration
  teamMode: TeamMode
  teamRoles: string[]

  // Step 3: Internationalization
  defaultLocale: string
  supportedLocales: string[]

  // Step 4: Billing Configuration
  billingModel: BillingModel
  currency: string

  // Step 5: Features
  features: FeatureFlags

  // Step 6: Content Features
  contentFeatures: ContentFeaturesConfig

  // Step 7: Authentication
  auth: AuthConfig

  // Step 8: Dashboard
  dashboard: DashboardConfig

  // Step 9: Dev Tools
  dev: DevConfig
}

/**
 * Supported locales with their display names
 */
export const AVAILABLE_LOCALES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
}

/**
 * Default roles available in the system
 */
export const DEFAULT_ROLES = ['owner', 'admin', 'member', 'viewer']

/**
 * Currency options
 */
export const CURRENCIES = [
  { value: 'usd', label: 'USD - US Dollar' },
  { value: 'eur', label: 'EUR - Euro' },
  { value: 'gbp', label: 'GBP - British Pound' },
  { value: 'cad', label: 'CAD - Canadian Dollar' },
  { value: 'aud', label: 'AUD - Australian Dollar' },
  { value: 'ars', label: 'ARS - Argentine Peso' },
  { value: 'brl', label: 'BRL - Brazilian Real' },
  { value: 'mxn', label: 'MXN - Mexican Peso' },
]
