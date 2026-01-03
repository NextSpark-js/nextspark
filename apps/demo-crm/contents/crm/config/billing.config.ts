/**
 * Billing Configuration - CRM Theme
 *
 * Defines plans, features, limits, and action mappings for the CRM theme.
 * Customized for sales and customer relationship management.
 */

import type { BillingConfig } from '@nextsparkjs/core/lib/billing/config-types'

export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  // ===========================================
  // FEATURE DEFINITIONS (CRM-specific)
  // ===========================================
  features: {
    basic_analytics: {
      name: 'billing.features.basic_analytics',
      description: 'billing.features.basic_analytics_description',
    },
    advanced_analytics: {
      name: 'billing.features.advanced_analytics',
      description: 'billing.features.advanced_analytics_description',
    },
    api_access: {
      name: 'billing.features.api_access',
      description: 'billing.features.api_access_description',
    },
    custom_branding: {
      name: 'billing.features.custom_branding',
      description: 'billing.features.custom_branding_description',
    },
    pipeline_automation: {
      name: 'billing.features.pipeline_automation',
      description: 'billing.features.pipeline_automation_description',
    },
    email_templates: {
      name: 'billing.features.email_templates',
      description: 'billing.features.email_templates_description',
    },
    priority_support: {
      name: 'billing.features.priority_support',
      description: 'billing.features.priority_support_description',
    },
  },

  // ===========================================
  // LIMIT DEFINITIONS (CRM-specific)
  // ===========================================
  limits: {
    team_members: {
      name: 'billing.limits.team_members',
      unit: 'count',
      resetPeriod: 'never',
    },
    contacts: {
      name: 'billing.limits.contacts',
      unit: 'count',
      resetPeriod: 'never',
    },
    deals: {
      name: 'billing.limits.deals',
      unit: 'count',
      resetPeriod: 'never',
    },
    pipelines: {
      name: 'billing.limits.pipelines',
      unit: 'count',
      resetPeriod: 'never',
    },
    api_calls: {
      name: 'billing.limits.api_calls',
      unit: 'calls',
      resetPeriod: 'monthly',
    },
    storage_gb: {
      name: 'billing.limits.storage',
      unit: 'bytes',
      resetPeriod: 'never',
    },
  },

  // ===========================================
  // PLAN DEFINITIONS (CRM-optimized)
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
        team_members: 2,
        contacts: 100,
        deals: 25,
        pipelines: 1,
        api_calls: 1000,
        storage_gb: 1,
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
        monthly: 4900,  // $49.00 - CRM typically higher priced
        yearly: 49000,  // $490.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'email_templates',
        'pipeline_automation',
      ],
      limits: {
        team_members: 10,
        contacts: 10000,
        deals: 1000,
        pipelines: 5,
        api_calls: 100000,
        storage_gb: 25,
      },
      // Configure these in Stripe Dashboard
      stripePriceIdMonthly: 'price_crm_pro_monthly',
      stripePriceIdYearly: 'price_crm_pro_yearly',
    },
    {
      slug: 'enterprise',
      name: 'billing.plans.enterprise.name',
      description: 'billing.plans.enterprise.description',
      type: 'enterprise',
      visibility: 'hidden',
      trialDays: 30,
      features: ['*'],  // All features
      limits: {
        team_members: -1,  // Unlimited
        contacts: -1,
        deals: -1,
        pipelines: -1,
        api_calls: -1,
        storage_gb: -1,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
  ],

  // ===========================================
  // ACTION MAPPINGS (CRM-specific)
  // ===========================================
  actionMappings: {
    permissions: {
      'team.members.invite': 'team.members.invite',
      'team.settings.edit': 'team.settings.edit',
      'team.billing.manage': 'team.billing.manage',
    },

    features: {
      'analytics.view_advanced': 'advanced_analytics',
      'api.generate_key': 'api_access',
      'pipeline.automate': 'pipeline_automation',
      'email.use_templates': 'email_templates',
      'support.priority_access': 'priority_support',
    },

    limits: {
      'team.members.invite': 'team_members',
      'contacts.create': 'contacts',
      'deals.create': 'deals',
      'pipelines.create': 'pipelines',
      'api.call': 'api_calls',
      'files.upload': 'storage_gb',
    },
  },
}
