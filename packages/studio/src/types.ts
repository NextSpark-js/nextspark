/**
 * NextSpark Studio Types
 *
 * Core type definitions for the AI-powered app builder.
 */

// ============================================================
// Project Configuration (mirrors CLI WizardConfig)
// ============================================================

export type ProjectType = 'web' | 'web-mobile'
export type TeamMode = 'multi-tenant' | 'single-tenant' | 'single-user'
export type BillingModel = 'free' | 'freemium' | 'paid'
export type PresetName = 'saas' | 'blog' | 'crm'
export type ThemeOption = 'default' | 'blog' | 'crm' | 'productivity' | 'none'
export type PluginOption = 'ai' | 'langchain' | 'social-media-publisher'
export type RegistrationMode = 'open' | 'domain-restricted' | 'invitation-only'

export interface WizardConfig {
  projectName: string
  projectSlug: string
  projectDescription: string
  projectType: ProjectType
  teamMode: TeamMode
  teamRoles: string[]
  defaultLocale: string
  supportedLocales: string[]
  billingModel: BillingModel
  currency: string
  features: {
    analytics: boolean
    teams: boolean
    billing: boolean
    api: boolean
    docs: boolean
  }
  contentFeatures: {
    pages: boolean
    blog: boolean
  }
  auth: {
    registrationMode: RegistrationMode
    emailPassword: boolean
    googleOAuth: boolean
    emailVerification: boolean
  }
  dashboard: {
    search: boolean
    notifications: boolean
    themeToggle: boolean
    support: boolean
    quickCreate: boolean
    superadminAccess: boolean
    devtoolsAccess: boolean
    sidebarCollapsed: boolean
  }
  dev: {
    devKeyring: boolean
    debugMode: boolean
  }
}

// ============================================================
// Entity Definition (mirrors core EntityConfig simplified)
// ============================================================

export type EntityFieldType =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime'
  | 'email' | 'url' | 'phone' | 'select' | 'multiselect' | 'tags'
  | 'image' | 'file' | 'rating' | 'currency' | 'richtext' | 'markdown'
  | 'json' | 'country' | 'address' | 'relation'

export type EntityAccessMode = 'private' | 'shared' | 'public' | 'team'

export interface EntityFieldDefinition {
  name: string
  type: EntityFieldType
  required: boolean
  description?: string
  options?: Array<{ value: string; label: string }>
  relation?: {
    entity: string
    titleField?: string
  }
}

export interface EntityDefinition {
  slug: string
  names: { singular: string; plural: string }
  description: string
  accessMode: EntityAccessMode
  fields: EntityFieldDefinition[]
  features?: {
    searchable?: boolean
    sortable?: boolean
    filterable?: boolean
    bulkOperations?: boolean
    importExport?: boolean
    pageBuilder?: boolean
  }
}

// ============================================================
// Studio Session & Events
// ============================================================

export interface StudioAnalysis {
  preset: PresetName
  confidence: number
  reasoning: string
  detectedFeatures: string[]
  detectedEntities: Array<{
    name: string
    description: string
    estimatedFields: number
  }>
  suggestedTeamMode: TeamMode
  suggestedBilling: BillingModel
}

export interface StudioResult {
  analysis?: StudioAnalysis
  wizardConfig?: WizardConfig
  entities?: EntityDefinition[]
  theme?: ThemeOption
  plugins?: PluginOption[]
}

export type StudioEventType =
  | 'text'
  | 'tool_start'
  | 'tool_result'
  | 'config_ready'
  | 'entities_ready'
  | 'generation_start'
  | 'generation_complete'
  | 'phase'
  | 'generate_log'
  | 'project_ready'
  | 'error'

export interface StudioEvent {
  type: StudioEventType
  content?: string
  toolName?: string
  data?: unknown
  slug?: string
  phase?: string
}

export type StudioEventHandler = (event: StudioEvent) => void
