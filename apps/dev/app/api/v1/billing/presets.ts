/**
 * API Presets for Billing
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/billing',
  summary: 'Manage subscriptions, plans, and billing operations',
  presets: [
    // Plans
    {
      id: 'list-plans',
      title: 'List Plans',
      description: 'Fetch all available subscription plans',
      method: 'GET',
      tags: ['read', 'plans']
    },

    // Checkout
    {
      id: 'checkout-pro-monthly',
      title: 'Checkout Pro (Monthly)',
      description: 'Create checkout session for Pro plan monthly',
      method: 'POST',
      payload: {
        planSlug: 'pro',
        billingPeriod: 'monthly'
      },
      tags: ['write', 'checkout']
    },
    {
      id: 'checkout-pro-yearly',
      title: 'Checkout Pro (Yearly)',
      description: 'Create checkout session for Pro plan yearly (save 20%)',
      method: 'POST',
      payload: {
        planSlug: 'pro',
        billingPeriod: 'yearly'
      },
      tags: ['write', 'checkout']
    },
    {
      id: 'checkout-enterprise',
      title: 'Checkout Enterprise',
      description: 'Create checkout session for Enterprise plan',
      method: 'POST',
      payload: {
        planSlug: 'enterprise',
        billingPeriod: 'yearly'
      },
      tags: ['write', 'checkout']
    },

    // Portal
    {
      id: 'open-portal',
      title: 'Open Customer Portal',
      description: 'Get URL for Stripe customer portal',
      method: 'GET',
      tags: ['read', 'portal']
    },

    // Change Plan
    {
      id: 'upgrade-to-pro',
      title: 'Upgrade to Pro',
      description: 'Change current subscription to Pro plan',
      method: 'POST',
      payload: {
        planSlug: 'pro',
        billingPeriod: 'monthly'
      },
      tags: ['write', 'change-plan']
    },

    // Cancel
    {
      id: 'cancel-subscription',
      title: 'Cancel Subscription',
      description: 'Cancel current subscription at end of billing period',
      method: 'POST',
      payload: {},
      tags: ['write', 'cancel']
    },

    // Check Action
    {
      id: 'check-invite-member',
      title: 'Check: Can Invite Member',
      description: 'Check if team can invite more members (quota check)',
      method: 'POST',
      payload: {
        action: 'team.invite_member'
      },
      tags: ['read', 'check-action']
    },
    {
      id: 'check-create-project',
      title: 'Check: Can Create Project',
      description: 'Check if team can create more projects',
      method: 'POST',
      payload: {
        action: 'projects.create'
      },
      tags: ['read', 'check-action']
    },
    {
      id: 'check-api-access',
      title: 'Check: API Access',
      description: 'Check if plan includes API access feature',
      method: 'POST',
      payload: {
        action: 'api.access'
      },
      tags: ['read', 'check-action']
    }
  ]
})
