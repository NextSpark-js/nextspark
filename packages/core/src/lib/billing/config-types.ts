/**
 * Billing Configuration Types
 *
 * Interface that themes must implement in billing.config.ts
 * This allows themes to define their own plans, features, and limits
 * while core provides the infrastructure.
 */

import type { PlanType, PlanVisibility, PaymentProvider } from './types'

// Extension types for lib/billing/{stripe,polar,lemonsqueezy}-webhook-extensions.ts; the webhook modules themselves are internal.
export type { StripeWebhookExtensions } from './stripe-webhook'
export type { PolarWebhookExtensions } from './polar-webhook'
export type { LemonSqueezyWebhookExtensions } from './lemonsqueezy-webhook'

// ===========================================
// FEATURE & LIMIT DEFINITIONS
// ===========================================

export interface FeatureDefinition {
  /** i18n key for feature name */
  name: string
  /** i18n key for feature description (optional) */
  description?: string
}

export interface LimitDefinition {
  /** i18n key for limit name */
  name: string
  /** Unit type for display purposes */
  unit: 'count' | 'bytes' | 'calls'
  /** Reset period for usage tracking */
  resetPeriod: 'never' | 'daily' | 'monthly' | 'yearly'
}

// ===========================================
// PLAN DEFINITION
// ===========================================

export interface PlanDefinition {
  slug: string
  /** i18n key for plan name */
  name: string
  /** i18n key for plan description (optional) */
  description?: string
  type: PlanType
  visibility?: PlanVisibility
  price?: {
    monthly: number  // in cents
    yearly: number   // in cents
  }
  trialDays?: number
  /** Array of feature slugs, or ['*'] for all features */
  features: string[]
  /** Map of limitSlug -> value (-1 means unlimited) */
  limits: Record<string, number>
  /** Price IDs for the configured payment provider (monthly and yearly): Stripe price ids, Polar product ids, Lemon Squeezy variant ids */
  providerPriceIds?: {
    monthly?: string | null
    yearly?: string | null
  }
}

// ===========================================
// ACTION MAPPINGS
// ===========================================

export interface ActionMappings {
  /**
   * Maps action names to required RBAC permissions (optional)
   * e.g., { 'team.members.invite': 'team.members.invite' }
   */
  permissions?: Record<string, string>
  /**
   * Maps action names to required features
   * e.g., { 'analytics.view_advanced': 'advanced_analytics' }
   */
  features: Record<string, string>
  /**
   * Maps action names to consumed limits
   * e.g., { 'projects.create': 'projects', 'api.call': 'api_calls' }
   */
  limits: Record<string, string>
}

// ===========================================
// MAIN BILLING CONFIG
// ===========================================

export interface BillingConfig {
  /** Payment provider: stripe, polar, lemonsqueezy */
  provider: PaymentProvider

  /** Default currency (ISO 4217) */
  currency: string

  /** Default plan slug for new teams */
  defaultPlan: string

  /** Feature definitions */
  features: Record<string, FeatureDefinition>

  /** Limit definitions */
  limits: Record<string, LimitDefinition>

  /** Plan definitions */
  plans: PlanDefinition[]

  /** Action to feature/limit mappings */
  actionMappings: ActionMappings

  /**
   * Days a processed webhook event is kept in billing_webhook_events, so a redelivery is still a duplicate
   * (default 30; a value below 3 is raised to 3, one that is not a finite number uses the default). Keep it longer
   * than every gateway redelivers an event: Stripe retries for 3 days and resends by hand for up to 30.
   */
  webhookEventRetentionDays?: number
}
