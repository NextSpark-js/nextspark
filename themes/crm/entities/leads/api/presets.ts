/**
 * API Presets for Leads Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage prospective customers before conversion',
  presets: [
    {
      id: 'list-all',
      title: 'List All Leads',
      description: 'Get all leads with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-new',
      title: 'List New Leads',
      description: 'Get leads with status "new"',
      method: 'GET',
      params: {
        status: 'new'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-qualified',
      title: 'List Qualified Leads',
      description: 'Get leads with status "qualified"',
      method: 'GET',
      params: {
        status: 'qualified'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-hot',
      title: 'List Hot Leads',
      description: 'Get leads sorted by score (highest first)',
      method: 'GET',
      params: {
        sortBy: 'score',
        sortOrder: 'desc'
      },
      tags: ['read', 'filter', 'priority']
    },
    {
      id: 'search-by-company',
      title: 'Search by Company',
      description: 'Search leads by company name',
      method: 'GET',
      params: {
        search: '{{companyName}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'filter-by-source',
      title: 'Filter by Source',
      description: 'Get leads from a specific source',
      method: 'GET',
      params: {
        source: '{{source}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'create-lead',
      title: 'Create New Lead',
      description: 'Create a lead with sample data',
      method: 'POST',
      payload: {
        companyName: 'Sample Company',
        contactName: 'John Doe',
        email: 'john@sample.com',
        status: 'new',
        source: 'web'
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-status',
      title: 'Update Lead Status',
      description: 'Update the status of a lead',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: '{{newStatus}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-lead',
      title: 'Delete Lead',
      description: 'Delete a lead record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
