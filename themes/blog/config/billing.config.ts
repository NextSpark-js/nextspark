/**
 * Billing Configuration - Blog Theme
 *
 * Defines plans, features, limits, and action mappings for the Blog theme.
 * Customized for content publishing and blogging.
 */

import type { BillingConfig } from '@nextsparkjs/core/lib/billing/config-types'

export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  // ===========================================
  // FEATURE DEFINITIONS (Blog-specific)
  // ===========================================
  features: {
    basic_analytics: {
      name: 'billing.features.basic_analytics',
      description: 'billing.features.basic_analytics_description',
    },
    custom_domain: {
      name: 'billing.features.custom_domain',
      description: 'billing.features.custom_domain_description',
    },
    advanced_seo: {
      name: 'billing.features.advanced_seo',
      description: 'billing.features.advanced_seo_description',
    },
    priority_support: {
      name: 'billing.features.priority_support',
      description: 'billing.features.priority_support_description',
    },
  },

  // ===========================================
  // LIMIT DEFINITIONS (Blog-specific)
  // ===========================================
  limits: {
    posts: {
      name: 'billing.limits.posts',
      unit: 'count',
      resetPeriod: 'never',
    },
    monthly_views: {
      name: 'billing.limits.monthly_views',
      unit: 'count',
      resetPeriod: 'monthly',
    },
    storage_gb: {
      name: 'billing.limits.storage',
      unit: 'bytes',
      resetPeriod: 'never',
    },
    authors: {
      name: 'billing.limits.authors',
      unit: 'count',
      resetPeriod: 'never',
    },
  },

  // ===========================================
  // PLAN DEFINITIONS (Blog-optimized)
  // ===========================================
  plans: [
    {
      slug: 'free',
      name: 'billing.plans.free.name',
      description: 'billing.plans.free.description',
      type: 'free',
      visibility: 'public',
      price: { monthly: 0, yearly: 0 },
      trialDays: 0,
      features: ['basic_analytics'],
      limits: {
        posts: 10,
        monthly_views: 10000,
        storage_gb: 1,
        authors: 1,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 2900, // $29.00 - Same as default theme
        yearly: 29000, // $290.00 (16% savings)
      },
      trialDays: 14,
      features: ['basic_analytics', 'custom_domain', 'advanced_seo'],
      limits: {
        posts: -1, // Unlimited posts
        monthly_views: 100000,
        storage_gb: 10,
        authors: 5,
      },
      // Configure these in Stripe Dashboard
      stripePriceIdMonthly: 'price_blog_pro_monthly',
      stripePriceIdYearly: 'price_blog_pro_yearly',
    },
    {
      slug: 'enterprise',
      name: 'billing.plans.enterprise.name',
      description: 'billing.plans.enterprise.description',
      type: 'enterprise',
      visibility: 'hidden',
      trialDays: 30,
      features: ['*'], // All features
      limits: {
        posts: -1, // Unlimited
        monthly_views: -1,
        storage_gb: -1,
        authors: -1,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
  ],

  // ===========================================
  // ACTION MAPPINGS (Blog-specific)
  // ===========================================
  actionMappings: {
    permissions: {
      'team.billing.manage': 'team.billing.manage',
    },

    features: {
      'domain.customize': 'custom_domain',
      'seo.advanced': 'advanced_seo',
      'support.priority_access': 'priority_support',
    },

    limits: {
      'posts.create': 'posts',
      'files.upload': 'storage_gb',
      'authors.invite': 'authors',
    },
  },
}
