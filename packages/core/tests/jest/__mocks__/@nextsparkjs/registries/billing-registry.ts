/**
 * Mock Billing Registry for Jest tests
 * This matches the expected structure used by billing tests
 */

export interface FeatureDefinition {
  slug: string
  name: string
  description: string
  type: 'boolean' | 'limit'
}

export interface LimitDefinition {
  slug: string
  name: string
  unit: string
  description: string
}

export interface PlanDefinition {
  slug: string
  name: string
  description: string
  price: number
  interval: 'month' | 'year'
  type: 'free' | 'paid' | 'custom'
  visibility: 'public' | 'hidden' | 'invite_only'
  features: string[]
  limits: Record<string, number>
  stripeProductId?: string
  stripePriceId?: string
}

export interface BillingConfig {
  provider: 'stripe' | 'custom'
  currency: string
  defaultPlan: string
  features: Record<string, FeatureDefinition>
  limits: Record<string, LimitDefinition>
  plans: PlanDefinition[]
  actionMappings: {
    permissions: Record<string, string>
    features: Record<string, string>
    limits: Record<string, string>
  }
}

export const BILLING_REGISTRY: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',
  features: {
    api_access: {
      slug: 'api_access',
      name: 'API Access',
      description: 'Access to API',
      type: 'boolean'
    },
    advanced_analytics: {
      slug: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Advanced analytics features',
      type: 'boolean'
    },
    priority_support: {
      slug: 'priority_support',
      name: 'Priority Support',
      description: '24/7 priority support',
      type: 'boolean'
    },
    custom_integrations: {
      slug: 'custom_integrations',
      name: 'Custom Integrations',
      description: 'Custom API integrations',
      type: 'boolean'
    },
  },
  limits: {
    api_calls: {
      slug: 'api_calls',
      name: 'API Calls',
      unit: 'calls/month',
      description: 'Number of API calls per month'
    },
    storage: {
      slug: 'storage',
      name: 'Storage',
      unit: 'GB',
      description: 'Storage space in GB'
    },
    team_members: {
      slug: 'team_members',
      name: 'Team Members',
      unit: 'users',
      description: 'Number of team members'
    },
  },
  plans: [
    {
      slug: 'free',
      name: 'Free',
      description: 'Free plan for getting started',
      price: 0,
      interval: 'month',
      type: 'free',
      visibility: 'public',
      features: ['api_access'],
      limits: { api_calls: 1000, storage: 1, team_members: 1 },
    },
    {
      slug: 'starter',
      name: 'Starter',
      description: 'Starter plan for small teams',
      price: 19,
      interval: 'month',
      type: 'paid',
      visibility: 'public',
      features: ['api_access'],
      limits: { api_calls: 5000, storage: 5, team_members: 3 },
      stripeProductId: 'prod_starter',
      stripePriceId: 'price_starter',
    },
    {
      slug: 'pro',
      name: 'Pro',
      description: 'Pro plan for growing businesses',
      price: 49,
      interval: 'month',
      type: 'paid',
      visibility: 'public',
      features: ['api_access', 'advanced_analytics', 'priority_support'],
      limits: { api_calls: 50000, storage: 50, team_members: 10 },
      stripeProductId: 'prod_pro',
      stripePriceId: 'price_pro',
    },
    {
      slug: 'business',
      name: 'Business',
      description: 'Business plan for enterprises',
      price: 199,
      interval: 'month',
      type: 'paid',
      visibility: 'public',
      features: ['api_access', 'advanced_analytics', 'priority_support', 'custom_integrations'],
      limits: { api_calls: 500000, storage: 500, team_members: 50 },
      stripeProductId: 'prod_business',
      stripePriceId: 'price_business',
    },
  ],
  actionMappings: {
    permissions: {},
    features: {},
    limits: {},
  },
}

export const BILLING_MATRIX = {
  features: {
    api_access: { free: true, starter: true, pro: true, business: true },
    advanced_analytics: { free: false, starter: false, pro: true, business: true },
    priority_support: { free: false, starter: false, pro: true, business: true },
    custom_integrations: { free: false, starter: false, pro: false, business: true },
  },
  limits: {
    api_calls: { free: 1000, starter: 5000, pro: 50000, business: 500000 },
    storage: { free: 1, starter: 5, pro: 50, business: 500 },
    team_members: { free: 1, starter: 3, pro: 10, business: 50 },
  },
} as const

export const PUBLIC_PLANS: readonly PlanDefinition[] = BILLING_REGISTRY.plans.filter(
  p => p.visibility === 'public' || p.visibility === undefined
)

export const BILLING_METADATA = {
  totalPlans: BILLING_REGISTRY.plans.length,
  publicPlans: PUBLIC_PLANS.length,
  totalFeatures: Object.keys(BILLING_REGISTRY.features).length,
  totalLimits: Object.keys(BILLING_REGISTRY.limits).length,
  theme: 'default',
} as const
