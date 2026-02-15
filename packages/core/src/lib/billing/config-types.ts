/**
 * Billing Configuration Types
 *
 * Interface that themes must implement in billing.config.ts
 * This allows themes to define their own plans, features, and limits
 * while core provides the infrastructure.
 */

import type { PlanType, PlanVisibility, PaymentProvider } from './types'

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
  /** Stripe price IDs (P2: Stripe Integration) */
  stripePriceIdMonthly?: string | null
  stripePriceIdYearly?: string | null

  /** Generic price IDs for any payment provider (checked first, falls back to stripe-specific) */
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
  /** Payment provider: stripe, paddle, lemonsqueezy */
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
}
