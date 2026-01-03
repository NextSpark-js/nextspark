/**
 * Billing Configuration - Productivity Theme
 *
 * Defines plans, features, limits, and action mappings for the Productivity theme.
 * Customized for project and task management.
 */

import type { BillingConfig } from '@nextsparkjs/core/lib/billing/config-types'

export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  // ===========================================
  // FEATURE DEFINITIONS (Productivity-specific)
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
    gantt_view: {
      name: 'billing.features.gantt_view',
      description: 'billing.features.gantt_view_description',
    },
    time_tracking: {
      name: 'billing.features.time_tracking',
      description: 'billing.features.time_tracking_description',
    },
    priority_support: {
      name: 'billing.features.priority_support',
      description: 'billing.features.priority_support_description',
    },
  },

  // ===========================================
  // LIMIT DEFINITIONS (Productivity-specific)
  // ===========================================
  limits: {
    team_members: {
      name: 'billing.limits.team_members',
      unit: 'count',
      resetPeriod: 'never',
    },
    projects: {
      name: 'billing.limits.projects',
      unit: 'count',
      resetPeriod: 'never',
    },
    tasks: {
      name: 'billing.limits.tasks',
      unit: 'count',
      resetPeriod: 'never',
    },
    workspaces: {
      name: 'billing.limits.workspaces',
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
  // PLAN DEFINITIONS (Productivity-optimized)
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
        team_members: 3,
        projects: 5,
        tasks: 100,
        workspaces: 1,
        api_calls: 1000,
        storage_gb: 2,
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
        monthly: 2900,  // $29.00 - Same as default theme
        yearly: 29000,  // $290.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'gantt_view',
        'time_tracking',
      ],
      limits: {
        team_members: 15,
        projects: 100,
        tasks: -1,  // Unlimited tasks
        workspaces: 5,
        api_calls: 100000,
        storage_gb: 50,
      },
      // Configure these in Stripe Dashboard
      stripePriceIdMonthly: 'price_productivity_pro_monthly',
      stripePriceIdYearly: 'price_productivity_pro_yearly',
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
        projects: -1,
        tasks: -1,
        workspaces: -1,
        api_calls: -1,
        storage_gb: -1,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
  ],

  // ===========================================
  // ACTION MAPPINGS (Productivity-specific)
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
      'project.gantt_view': 'gantt_view',
      'task.time_tracking': 'time_tracking',
      'support.priority_access': 'priority_support',
    },

    limits: {
      'team.members.invite': 'team_members',
      'projects.create': 'projects',
      'tasks.create': 'tasks',
      'workspaces.create': 'workspaces',
      'api.call': 'api_calls',
      'files.upload': 'storage_gb',
    },
  },
}
