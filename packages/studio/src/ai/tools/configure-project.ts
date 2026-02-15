/**
 * Tool: configure_project
 *
 * Fills the complete WizardConfig with all project settings.
 * Called AFTER analyze_requirement to set up the full configuration.
 */

import { z } from 'zod'

export const configureProjectSchema = z.object({
  projectName: z.string().describe(
    'Human-readable project name (e.g., "GymCRM", "My Photography Blog")'
  ),
  projectSlug: z.string().regex(/^[a-z][a-z0-9-]*$/).describe(
    'URL-safe project slug, lowercase with hyphens only (e.g., "gym-crm", "photo-blog")'
  ),
  projectDescription: z.string().describe(
    'Brief project description (1-2 sentences)'
  ),
  projectType: z.enum(['web', 'web-mobile']).default('web').describe(
    '"web" for web-only app. "web-mobile" for web + mobile monorepo with Expo.'
  ),
  teamMode: z.enum(['multi-tenant', 'single-tenant', 'single-user']).describe(
    'Team architecture. "multi-tenant": each customer gets a workspace. "single-tenant": one organization. "single-user": personal app.'
  ),
  teamRoles: z.array(z.string()).default(['owner', 'admin', 'member', 'viewer']).describe(
    'Available roles within a team. Default: ["owner", "admin", "member", "viewer"]'
  ),
  defaultLocale: z.string().default('en').describe(
    'Default language code (e.g., "en", "es", "fr")'
  ),
  supportedLocales: z.array(z.string()).default(['en']).describe(
    'All supported language codes. Available: en, es, fr, de, it, pt'
  ),
  billingModel: z.enum(['free', 'freemium', 'paid']).describe(
    '"free": no billing. "freemium": free tier + paid plans. "paid": subscription required.'
  ),
  currency: z.string().default('usd').describe(
    'Default currency code (usd, eur, gbp, cad, aud, ars, brl, mxn)'
  ),
  features: z.object({
    analytics: z.boolean().default(true).describe('Enable analytics dashboard'),
    teams: z.boolean().default(true).describe('Enable team/organization management'),
    billing: z.boolean().default(true).describe('Enable Stripe billing integration'),
    api: z.boolean().default(true).describe('Enable external API access with API keys'),
    docs: z.boolean().default(false).describe('Enable documentation section'),
  }),
  contentFeatures: z.object({
    pages: z.boolean().default(false).describe('Enable pages with visual page builder'),
    blog: z.boolean().default(false).describe('Enable blog with posts and categories'),
  }),
  auth: z.object({
    registrationMode: z.enum(['open', 'domain-restricted', 'invitation-only']).default('open').describe(
      '"open": anyone can sign up. "domain-restricted": only specific email domains via Google OAuth. "invitation-only": only via invitation link.'
    ),
    emailPassword: z.boolean().default(true).describe('Enable email+password authentication'),
    googleOAuth: z.boolean().default(true).describe('Enable Google OAuth login'),
    emailVerification: z.boolean().default(true).describe('Require email verification after signup'),
  }),
  dashboard: z.object({
    search: z.boolean().default(true).describe('Enable global search in dashboard'),
    notifications: z.boolean().default(true).describe('Enable notification center'),
    themeToggle: z.boolean().default(true).describe('Enable dark/light mode toggle'),
    support: z.boolean().default(true).describe('Enable support widget'),
    quickCreate: z.boolean().default(true).describe('Enable quick-create button in topbar'),
    superadminAccess: z.boolean().default(true).describe('Enable superadmin panel access'),
    devtoolsAccess: z.boolean().default(true).describe('Enable devtools panel access'),
    sidebarCollapsed: z.boolean().default(false).describe('Start with sidebar collapsed'),
  }),
  dev: z.object({
    devKeyring: z.boolean().default(true).describe('Enable dev keyring for quick login in development'),
    debugMode: z.boolean().default(false).describe('Enable debug mode logging'),
  }),
  theme: z.enum(['default', 'blog', 'crm', 'productivity', 'none']).default('default').describe(
    'UI theme to use. "default" is general-purpose. Match to the project type when possible.'
  ),
  plugins: z.array(
    z.enum(['ai', 'langchain', 'social-media-publisher'])
  ).default([]).describe(
    'Optional plugins to install. "ai": AI features with Claude. "langchain": LangChain integration. "social-media-publisher": social media scheduling.'
  ),
})

export type ConfigureProjectInput = z.infer<typeof configureProjectSchema>

export const CONFIGURE_PROJECT_TOOL = {
  name: 'configure_project' as const,
  description: 'Configure a complete NextSpark project by filling all settings. This produces a WizardConfig that determines the entire project structure: authentication mode, billing, team roles, features, dashboard options, theme, and plugins. Call this AFTER analyze_requirement. Choose values that match the user\'s description and the selected preset. When in doubt, use the preset defaults.',
  schema: configureProjectSchema,
}
