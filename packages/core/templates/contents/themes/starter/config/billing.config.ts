/**
 * Starter Theme - Billing Configuration
 *
 * This is a free-only billing configuration for the starter theme.
 * No paid plans are defined - all features are available for free.
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
  // All features are available in the free plan for the starter theme
  features: {
    basic_analytics: {
      name: 'billing.features.basic_analytics',
      description: 'billing.features.basic_analytics_description',
    },
    api_access: {
      name: 'billing.features.api_access',
      description: 'billing.features.api_access_description',
    },
  },

  // ===========================================
  // LIMIT DEFINITIONS
  // ===========================================
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
  // PLAN DEFINITIONS
  // ===========================================
  // Free-only: No paid plans for the starter theme
  plans: [],

  // ===========================================
  // ACTION MAPPINGS
  // ===========================================
  // Maps user actions to RBAC permissions, plan features, and limits.
  // Three-layer model: RESULT = Permission AND Feature AND Quota
  actionMappings: {
    // RBAC permissions (integrates with permissions.config.ts)
    permissions: {
      'team.members.invite': 'team.members.invite',
      'team.settings.edit': 'team.settings.edit',
      'team.billing.manage': 'team.billing.manage',
    },

    // Feature requirements per action
    features: {
      'analytics.view': 'basic_analytics',
      'api.generate_key': 'api_access',
    },

    // Limit consumption per action
    limits: {
      'team.members.invite': 'team_members',
      'tasks.create': 'tasks',
      'api.call': 'api_calls',
    },
  },
}

export default billingConfig
