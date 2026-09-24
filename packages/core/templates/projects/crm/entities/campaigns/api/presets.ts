/**
 * API Presets for Campaigns Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage marketing campaigns with budget and ROI tracking',
  presets: [
    {
      id: 'list-all',
      title: 'List All Campaigns',
      description: 'Get all campaigns with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-active',
      title: 'List Active Campaigns',
      description: 'Get all active campaigns',
      method: 'GET',
      params: {
        status: 'active'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-planned',
      title: 'List Planned Campaigns',
      description: 'Get all planned campaigns',
      method: 'GET',
      params: {
        status: 'planned'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-completed',
      title: 'List Completed Campaigns',
      description: 'Get all completed campaigns',
      method: 'GET',
      params: {
        status: 'completed'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-type',
      title: 'List by Type',
      description: 'Get campaigns of a specific type',
      method: 'GET',
      params: {
        type: '{{type}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-email',
      title: 'List Email Campaigns',
      description: 'Get all email campaigns',
      method: 'GET',
      params: {
        type: 'email'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-by-name',
      title: 'Search by Name',
      description: 'Search campaigns by name',
      method: 'GET',
      params: {
        search: '{{name}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-campaign',
      title: 'Create Campaign',
      description: 'Create a new campaign',
      method: 'POST',
      payload: {
        name: 'New Campaign',
        type: 'email',
        status: 'planned',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        budget: 5000
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-metrics',
      title: 'Update Metrics',
      description: 'Update campaign performance metrics',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        actualLeads: '{{leads}}',
        actualRevenue: '{{revenue}}',
        actualCost: '{{cost}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'activate',
      title: 'Activate Campaign',
      description: 'Set campaign status to active',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: 'active'
      },
      tags: ['write', 'update']
    },
    {
      id: 'complete',
      title: 'Complete Campaign',
      description: 'Mark campaign as completed',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: 'completed'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-campaign',
      title: 'Delete Campaign',
      description: 'Delete a campaign record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
