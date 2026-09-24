/**
 * API Presets for DevTools
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/devtools',
  summary: 'Development and debugging utilities',
  presets: [
    // Documentation
    {
      id: 'get-teams-docs',
      title: 'Get Teams Docs',
      description: 'Fetch Teams API documentation',
      method: 'GET',
      path: '/docs',
      queryParams: {
        path: 'packages/core/templates/app/api/v1/teams/docs.md'
      },
      tags: ['read', 'docs']
    },
    {
      id: 'get-billing-docs',
      title: 'Get Billing Docs',
      description: 'Fetch Billing API documentation',
      method: 'GET',
      path: '/docs',
      queryParams: {
        path: 'packages/core/templates/app/api/v1/billing/docs.md'
      },
      tags: ['read', 'docs']
    },

    // Features
    {
      id: 'list-features',
      title: 'List Features',
      description: 'Get feature registry with test coverage',
      method: 'GET',
      path: '/features',
      tags: ['read', 'testing']
    },

    // Blocks
    {
      id: 'list-devtools-blocks',
      title: 'List Blocks Metadata',
      description: 'Get block registry metadata',
      method: 'GET',
      path: '/blocks',
      tags: ['read', 'blocks']
    },

    // Test Flows
    {
      id: 'list-flows',
      title: 'List Test Flows',
      description: 'Get available test flows',
      method: 'GET',
      path: '/flows',
      tags: ['read', 'testing']
    },

    // Scheduled Actions
    {
      id: 'list-scheduled-actions',
      title: 'List Scheduled Actions',
      description: 'Get all scheduled actions',
      method: 'GET',
      path: '/scheduled-actions',
      queryParams: {
        page: '1',
        limit: '20'
      },
      tags: ['read', 'scheduled-actions']
    },
    {
      id: 'list-pending-actions',
      title: 'List Pending Actions',
      description: 'Filter scheduled actions by pending status',
      method: 'GET',
      path: '/scheduled-actions',
      queryParams: {
        status: 'pending'
      },
      tags: ['read', 'scheduled-actions', 'filter']
    },
    {
      id: 'list-failed-actions',
      title: 'List Failed Actions',
      description: 'Filter scheduled actions by failed status',
      method: 'GET',
      path: '/scheduled-actions',
      queryParams: {
        status: 'failed'
      },
      tags: ['read', 'scheduled-actions', 'filter']
    },

    // Testing
    {
      id: 'get-testing-info',
      title: 'Get Testing Info',
      description: 'Get testing configuration and utilities',
      method: 'GET',
      path: '/testing',
      tags: ['read', 'testing']
    }
  ]
})
