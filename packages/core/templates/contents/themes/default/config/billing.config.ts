/**
 * Billing Configuration - Default Theme
 *
 * Defines plans, features, limits, and action mappings for the default theme.
 * This configuration is used by BILLING_REGISTRY with pre-computed matrices
 * for O(1) runtime lookups.
 *
 * The three-layer model:
 * RESULT = Permission (RBAC) AND Feature (Plan) AND Quota (Limits)
 */

import type { BillingConfig } from '@nextsparkjs/core/lib/billing/config-types'

export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  // ===========================================
  // FEATURE DEFINITIONS
  // ===========================================
  features: {
    // Analytics features
    basic_analytics: {
      name: 'billing.features.basic_analytics',
      description: 'billing.features.basic_analytics_description',
    },
    advanced_analytics: {
      name: 'billing.features.advanced_analytics',
      description: 'billing.features.advanced_analytics_description',
    },
    realtime_analytics: {
      name: 'billing.features.realtime_analytics',
      description: 'billing.features.realtime_analytics_description',
    },

    // API features
    api_access: {
      name: 'billing.features.api_access',
      description: 'billing.features.api_access_description',
    },
    webhooks: {
      name: 'billing.features.webhooks',
      description: 'billing.features.webhooks_description',
    },

    // Customization features
    custom_branding: {
      name: 'billing.features.custom_branding',
      description: 'billing.features.custom_branding_description',
    },
    white_label: {
      name: 'billing.features.white_label',
      description: 'billing.features.white_label_description',
    },

    // Security features
    sso: {
      name: 'billing.features.sso',
      description: 'billing.features.sso_description',
    },
    audit_logs: {
      name: 'billing.features.audit_logs',
      description: 'billing.features.audit_logs_description',
    },

    // Support features
    priority_support: {
      name: 'billing.features.priority_support',
      description: 'billing.features.priority_support_description',
    },
    dedicated_support: {
      name: 'billing.features.dedicated_support',
      description: 'billing.features.dedicated_support_description',
    },

    // Collaboration features
    guest_access: {
      name: 'billing.features.guest_access',
      description: 'billing.features.guest_access_description',
    },

    // Domain-specific features (tasks & customers)
    task_automation: {
      name: 'billing.features.task_automation',
      description: 'billing.features.task_automation_description',
    },
    customer_import: {
      name: 'billing.features.customer_import',
      description: 'billing.features.customer_import_description',
    },
    recurring_tasks: {
      name: 'billing.features.recurring_tasks',
      description: 'billing.features.recurring_tasks_description',
    },
  },

  // ===========================================
  // LIMIT DEFINITIONS
  // ===========================================
  // Note: Limits correspond to actual entities in the theme (tasks, customers)
  // and system resources (team_members, storage, api_calls)
  limits: {
    team_members: {
      name: 'billing.limits.team_members',
      unit: 'count',
      resetPeriod: 'never',
    },
    tasks: {
      name: 'billing.limits.tasks',
      unit: 'count',
      resetPeriod: 'never',
    },
    customers: {
      name: 'billing.limits.customers',
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
    file_uploads: {
      name: 'billing.limits.file_uploads',
      unit: 'count',
      resetPeriod: 'monthly',
    },
    webhooks_count: {
      name: 'billing.limits.webhooks_count',
      unit: 'count',
      resetPeriod: 'never',
    },
  },

  // ===========================================
  // PLAN DEFINITIONS
  // ===========================================
  plans: [
    // Free Plan - Basic access for small teams
    {
      slug: 'free',
      name: 'billing.plans.free.name',
      description: 'billing.plans.free.description',
      type: 'free',
      visibility: 'public',
      price: { monthly: 0, yearly: 0 },
      trialDays: 0,
      features: [
        'basic_analytics',
      ],
      limits: {
        team_members: 3,
        tasks: 50,
        customers: 25,
        api_calls: 1000,
        storage_gb: 1,
        file_uploads: 100,
        webhooks_count: 0,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },

    // Starter Plan - For growing teams
    {
      slug: 'starter',
      name: 'billing.plans.starter.name',
      description: 'billing.plans.starter.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 1500,  // $15.00
        yearly: 14400,  // $144.00 (20% savings)
      },
      trialDays: 7,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'guest_access',
      ],
      limits: {
        team_members: 5,
        tasks: 200,
        customers: 100,
        api_calls: 10000,
        storage_gb: 10,
        file_uploads: 500,
        webhooks_count: 3,
      },
      stripePriceIdMonthly: 'price_starter_monthly',
      stripePriceIdYearly: 'price_starter_yearly',
    },

    // Pro Plan - For professional teams
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 2900,  // $29.00
        yearly: 29000,  // $290.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'realtime_analytics',
        'api_access',
        'webhooks',
        'custom_branding',
        'guest_access',
        'priority_support',
        'task_automation',
      ],
      limits: {
        team_members: 15,
        tasks: 1000,
        customers: 500,
        api_calls: 100000,
        storage_gb: 50,
        file_uploads: 2000,
        webhooks_count: 10,
      },
      stripePriceIdMonthly: 'price_pro_monthly',
      stripePriceIdYearly: 'price_pro_yearly',
    },

    // Business Plan - For larger organizations
    {
      slug: 'business',
      name: 'billing.plans.business.name',
      description: 'billing.plans.business.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 7900,  // $79.00
        yearly: 79000,  // $790.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'realtime_analytics',
        'api_access',
        'webhooks',
        'custom_branding',
        'sso',
        'audit_logs',
        'guest_access',
        'priority_support',
        'task_automation',
        'customer_import',
        'recurring_tasks',
      ],
      limits: {
        team_members: 50,
        tasks: 5000,
        customers: 2000,
        api_calls: 500000,
        storage_gb: 200,
        file_uploads: 10000,
        webhooks_count: 50,
      },
      stripePriceIdMonthly: 'price_business_monthly',
      stripePriceIdYearly: 'price_business_yearly',
    },

    // Enterprise Plan - Custom unlimited plan
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
        tasks: -1,
        customers: -1,
        api_calls: -1,
        storage_gb: -1,
        file_uploads: -1,
        webhooks_count: -1,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
  ],

  // ===========================================
  // ACTION MAPPINGS
  // ===========================================
  // Maps user actions to RBAC permissions, plan features, and limits.
  // This is the "three-layer model": RESULT = Permission AND Feature AND Quota
  actionMappings: {
    // RBAC permissions (optional - integrates with existing permission system)
    permissions: {
      'team.members.invite': 'team.members.invite',
      'team.settings.edit': 'team.settings.edit',
      'team.billing.manage': 'team.billing.manage',
    },

    // Feature requirements per action
    features: {
      // Analytics features
      'analytics.view_advanced': 'advanced_analytics',
      'analytics.view_realtime': 'realtime_analytics',
      // API features
      'api.generate_key': 'api_access',
      'webhooks.create': 'webhooks',
      // Branding features
      'branding.customize': 'custom_branding',
      'branding.white_label': 'white_label',
      // Security features
      'auth.configure_sso': 'sso',
      'security.view_audit_logs': 'audit_logs',
      // Support features
      'support.priority_access': 'priority_support',
      'support.dedicated_channel': 'dedicated_support',
      // Collaboration features
      'team.invite_guest': 'guest_access',
      // Domain-specific features (tasks & customers)
      'tasks.automate': 'task_automation',
      'tasks.create_recurring': 'recurring_tasks',
      'customers.bulk_import': 'customer_import',
    },

    // Limit consumption per action (maps to actual entities)
    limits: {
      'team.members.invite': 'team_members',
      'tasks.create': 'tasks',
      'customers.create': 'customers',
      'api.call': 'api_calls',
      'files.upload': 'storage_gb',
      'files.upload_count': 'file_uploads',
      'webhooks.create': 'webhooks_count',
    },
  },
}
