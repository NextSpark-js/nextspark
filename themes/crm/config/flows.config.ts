/**
 * CRM Theme - Flows Configuration
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
    description: 'Complete journey from signup to first lead creation',
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
        feature: 'users',
        action: 'setup-profile',
        description: 'User configures their profile',
      },
      {
        feature: 'teams',
        action: 'configure-team',
        description: 'Admin configures team settings',
        optional: true,
      },
    ],

    features: ['auth', 'users', 'teams'],
  },

  'invite-member': {
    name: 'Invite Team Member',
    description: 'Invite a new member to the CRM organization',
    category: 'acquisition',
    icon: 'user-plus',
    criticalPath: false,

    steps: [
      {
        feature: 'teams',
        action: 'open-invite',
        description: 'Admin opens invite dialog',
      },
      {
        feature: 'teams',
        action: 'enter-email',
        description: 'Admin enters new member email and role',
      },
      {
        feature: 'teams',
        action: 'send-invite',
        description: 'System sends invitation email',
      },
    ],

    features: ['teams'],
  },

  // ===========================================================================
  // LEAD MANAGEMENT FLOWS
  // Lead capture and conversion journeys
  // ===========================================================================

  'lead-to-customer': {
    name: 'Lead to Customer',
    description: 'Complete sales cycle from lead capture to closed deal',
    category: 'sales',
    icon: 'trending-up',
    criticalPath: true,

    steps: [
      {
        feature: 'leads',
        action: 'create-lead',
        description: 'Sales rep captures new lead',
      },
      {
        feature: 'leads',
        action: 'qualify-lead',
        description: 'Sales rep qualifies the lead',
      },
      {
        feature: 'lead-conversion',
        action: 'convert',
        description: 'Sales rep converts lead to contact/company',
      },
      {
        feature: 'opportunities',
        action: 'create-opportunity',
        description: 'Sales rep creates opportunity',
      },
      {
        feature: 'pipeline-kanban',
        action: 'move-stages',
        description: 'Sales rep moves opportunity through pipeline stages',
      },
      {
        feature: 'opportunities',
        action: 'close-won',
        description: 'Sales rep closes the deal',
      },
    ],

    features: ['leads', 'lead-conversion', 'contacts', 'companies', 'opportunities', 'pipeline-kanban'],
  },

  'create-lead': {
    name: 'Create Lead',
    description: 'Capture a new sales lead',
    category: 'leads',
    icon: 'user-plus',
    criticalPath: true,

    steps: [
      {
        feature: 'leads',
        action: 'open-form',
        description: 'User opens lead creation form',
      },
      {
        feature: 'leads',
        action: 'enter-details',
        description: 'User enters lead details (name, email, source)',
      },
      {
        feature: 'leads',
        action: 'assign-owner',
        description: 'User assigns lead owner',
        optional: true,
      },
      {
        feature: 'leads',
        action: 'save',
        description: 'User saves the new lead',
      },
    ],

    features: ['leads'],
  },

  'convert-lead': {
    name: 'Convert Lead',
    description: 'Convert qualified lead to contact and company',
    category: 'leads',
    icon: 'user-check',
    criticalPath: true,

    steps: [
      {
        feature: 'leads',
        action: 'select-lead',
        description: 'User selects a qualified lead',
      },
      {
        feature: 'lead-conversion',
        action: 'initiate-conversion',
        description: 'User initiates lead conversion',
      },
      {
        feature: 'lead-conversion',
        action: 'create-contact',
        description: 'System creates contact from lead data',
      },
      {
        feature: 'lead-conversion',
        action: 'create-company',
        description: 'System creates company (optional)',
        optional: true,
      },
      {
        feature: 'lead-conversion',
        action: 'confirm',
        description: 'User confirms conversion',
      },
    ],

    features: ['leads', 'lead-conversion', 'contacts', 'companies'],
  },

  // ===========================================================================
  // OPPORTUNITY MANAGEMENT FLOWS
  // Deal and pipeline management
  // ===========================================================================

  'manage-opportunity': {
    name: 'Manage Opportunity',
    description: 'Create and manage a sales opportunity through the pipeline',
    category: 'sales',
    icon: 'briefcase',
    criticalPath: true,

    steps: [
      {
        feature: 'opportunities',
        action: 'create',
        description: 'Sales rep creates new opportunity',
      },
      {
        feature: 'opportunities',
        action: 'link-contact',
        description: 'Sales rep links opportunity to contact/company',
      },
      {
        feature: 'products',
        action: 'add-products',
        description: 'Sales rep adds products to opportunity',
        optional: true,
      },
      {
        feature: 'pipeline-kanban',
        action: 'track-progress',
        description: 'Sales rep tracks opportunity through pipeline',
      },
    ],

    features: ['opportunities', 'contacts', 'companies', 'products', 'pipeline-kanban'],
  },

  'pipeline-management': {
    name: 'Pipeline Management',
    description: 'Visual pipeline management using kanban board',
    category: 'sales',
    icon: 'layout',
    criticalPath: true,

    steps: [
      {
        feature: 'pipeline-kanban',
        action: 'view-board',
        description: 'User views pipeline kanban board',
      },
      {
        feature: 'pipeline-kanban',
        action: 'drag-opportunity',
        description: 'User drags opportunity to new stage',
      },
      {
        feature: 'opportunities',
        action: 'update-details',
        description: 'User updates opportunity details',
        optional: true,
      },
    ],

    features: ['pipeline-kanban', 'opportunities', 'pipelines'],
  },

  // ===========================================================================
  // ACTIVITY MANAGEMENT FLOWS
  // Task and activity tracking
  // ===========================================================================

  'schedule-activity': {
    name: 'Schedule Activity',
    description: 'Schedule a call, meeting, or task',
    category: 'activities',
    icon: 'calendar',
    criticalPath: false,

    steps: [
      {
        feature: 'activities',
        action: 'create',
        description: 'User creates new activity',
      },
      {
        feature: 'activities',
        action: 'set-type',
        description: 'User selects activity type (call, meeting, task)',
      },
      {
        feature: 'activities',
        action: 'link-record',
        description: 'User links activity to lead/contact/opportunity',
      },
      {
        feature: 'activities',
        action: 'set-datetime',
        description: 'User sets date and time',
      },
      {
        feature: 'activities',
        action: 'save',
        description: 'User saves the activity',
      },
    ],

    features: ['activities'],
  },

  'complete-activity': {
    name: 'Complete Activity',
    description: 'Mark an activity as completed and log outcome',
    category: 'activities',
    icon: 'check-circle',
    criticalPath: false,

    steps: [
      {
        feature: 'activities',
        action: 'select-activity',
        description: 'User selects an activity',
      },
      {
        feature: 'activities',
        action: 'log-outcome',
        description: 'User logs the outcome/notes',
      },
      {
        feature: 'activities',
        action: 'mark-complete',
        description: 'User marks activity as completed',
      },
      {
        feature: 'activities',
        action: 'schedule-followup',
        description: 'User schedules follow-up activity',
        optional: true,
      },
    ],

    features: ['activities'],
  },

  // ===========================================================================
  // CONTACT MANAGEMENT FLOWS
  // Contact and company management
  // ===========================================================================

  'create-contact': {
    name: 'Create Contact',
    description: 'Add a new contact to the CRM',
    category: 'contacts',
    icon: 'user-plus',
    criticalPath: true,

    steps: [
      {
        feature: 'contacts',
        action: 'open-form',
        description: 'User opens contact creation form',
      },
      {
        feature: 'contacts',
        action: 'enter-details',
        description: 'User enters contact information',
      },
      {
        feature: 'companies',
        action: 'link-company',
        description: 'User links contact to company',
        optional: true,
      },
      {
        feature: 'contacts',
        action: 'save',
        description: 'User saves the new contact',
      },
    ],

    features: ['contacts', 'companies'],
  },

  // ===========================================================================
  // REPORTING FLOWS
  // Analytics and reporting
  // ===========================================================================

  'view-sales-report': {
    name: 'View Sales Report',
    description: 'Access and analyze sales performance data',
    category: 'reports',
    icon: 'bar-chart',
    criticalPath: false,

    steps: [
      {
        feature: 'sales-reports',
        action: 'navigate',
        description: 'User navigates to sales reports',
      },
      {
        feature: 'sales-reports',
        action: 'select-period',
        description: 'User selects reporting period',
      },
      {
        feature: 'sales-reports',
        action: 'view-data',
        description: 'User views report data and charts',
      },
      {
        feature: 'sales-reports',
        action: 'export',
        description: 'User exports report to PDF/Excel',
        optional: true,
      },
    ],

    features: ['sales-reports'],
  },

  // ===========================================================================
  // DATA MANAGEMENT FLOWS
  // Import/export operations
  // ===========================================================================

  'bulk-import-data': {
    name: 'Bulk Import Data',
    description: 'Import records from CSV/Excel file',
    category: 'settings',
    icon: 'upload',
    criticalPath: false,

    steps: [
      {
        feature: 'bulk-import',
        action: 'select-entity',
        description: 'User selects entity type to import',
      },
      {
        feature: 'bulk-import',
        action: 'upload-file',
        description: 'User uploads CSV/Excel file',
      },
      {
        feature: 'bulk-import',
        action: 'map-fields',
        description: 'User maps file columns to entity fields',
      },
      {
        feature: 'bulk-import',
        action: 'review-preview',
        description: 'User reviews import preview',
      },
      {
        feature: 'bulk-import',
        action: 'execute-import',
        description: 'User executes the import',
      },
    ],

    features: ['bulk-import'],
  },

  // ===========================================================================
  // BILLING FLOWS
  // Subscription and payment journeys
  // ===========================================================================

  'upgrade-plan': {
    name: 'Upgrade Plan',
    description: 'Upgrade subscription to a higher tier plan',
    category: 'settings',
    icon: 'trending-up',
    criticalPath: false,

    steps: [
      {
        feature: 'plans',
        action: 'view-plans',
        description: 'Admin views available plans',
      },
      {
        feature: 'plans',
        action: 'compare-plans',
        description: 'Admin compares features between plans',
      },
      {
        feature: 'plans',
        action: 'select-plan',
        description: 'Admin selects a new plan',
      },
      {
        feature: 'billing',
        action: 'enter-payment',
        description: 'Admin enters or confirms payment method',
      },
      {
        feature: 'billing',
        action: 'confirm-upgrade',
        description: 'Admin confirms the upgrade',
      },
    ],

    features: ['plans', 'billing'],
  },
})
