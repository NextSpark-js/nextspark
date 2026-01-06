/**
 * Default Theme - Flows Configuration
 *
 * Defines user journeys/flows that span multiple features.
 * Each flow key becomes a tag: @flow-{key}
 *
 * Flows are enriched at build-time with:
 * - Feature metadata (from features.config.ts)
 * - Test coverage (from tags-registry + test files)
 */

import { defineFlows } from '@nextsparkjs/core/lib/config/features-types'

export default defineFlows({
  // ===========================================================================
  // ACQUISITION FLOWS
  // User acquisition and onboarding journeys
  // ===========================================================================

  onboarding: {
    name: 'User Onboarding',
    description: 'Complete journey from signup to first team creation',
    category: 'acquisition',
    icon: 'rocket',
    criticalPath: true,

    steps: [
      {
        feature: 'auth',
        action: 'signup',
        description: 'User creates account with email/password or OAuth',
      },
      {
        feature: 'auth',
        action: 'verify-email',
        description: 'User verifies email address',
      },
      {
        feature: 'teams',
        action: 'create-team',
        description: 'User creates their first team/workspace',
      },
      {
        feature: 'teams',
        action: 'invite-members',
        description: 'User invites team members',
        optional: true,
      },
    ],

    features: ['auth', 'teams'],
  },

  // ===========================================================================
  // NAVIGATION FLOWS
  // Context switching and navigation journeys
  // ===========================================================================

  'team-switch': {
    name: 'Team Switching',
    description: 'Context switch between different teams/workspaces',
    category: 'navigation',
    icon: 'repeat',
    criticalPath: true,

    steps: [
      {
        feature: 'teams',
        action: 'open-switcher',
        description: 'User opens the team switcher dropdown',
      },
      {
        feature: 'teams',
        action: 'select-team',
        description: 'User selects a different team',
      },
      {
        feature: 'teams',
        action: 'load-context',
        description: 'System loads new team context and redirects',
      },
    ],

    features: ['teams'],
  },

  // ===========================================================================
  // BILLING FLOWS
  // Subscription and payment journeys
  // ===========================================================================

  'upgrade-plan': {
    name: 'Plan Upgrade',
    description: 'Upgrade subscription to a higher tier plan',
    category: 'settings',
    icon: 'trending-up',
    criticalPath: true,

    steps: [
      {
        feature: 'plans',
        action: 'view-plans',
        description: 'User views available plans',
      },
      {
        feature: 'plans',
        action: 'compare-plans',
        description: 'User compares features between plans',
      },
      {
        feature: 'plans',
        action: 'select-plan',
        description: 'User selects a new plan',
      },
      {
        feature: 'billing',
        action: 'enter-payment',
        description: 'User enters or confirms payment method',
      },
      {
        feature: 'billing',
        action: 'confirm-upgrade',
        description: 'User confirms the upgrade',
      },
    ],

    features: ['plans', 'billing'],
  },
})
