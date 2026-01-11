/**
 * API Presets for Companies Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage company/organization records',
  presets: [
    {
      id: 'list-all',
      title: 'List All Companies',
      description: 'Get all companies with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-customers',
      title: 'List Customers',
      description: 'Get customer companies',
      method: 'GET',
      params: {
        type: 'customer'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-prospects',
      title: 'List Prospects',
      description: 'Get prospect companies',
      method: 'GET',
      params: {
        type: 'prospect'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-hot',
      title: 'List Hot Companies',
      description: 'Get companies with hot rating',
      method: 'GET',
      params: {
        rating: 'hot'
      },
      tags: ['read', 'filter', 'priority']
    },
    {
      id: 'filter-by-industry',
      title: 'Filter by Industry',
      description: 'Get companies in a specific industry',
      method: 'GET',
      params: {
        industry: '{{industry}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-by-name',
      title: 'Search by Name',
      description: 'Search companies by name',
      method: 'GET',
      params: {
        search: '{{name}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-company',
      title: 'Create New Company',
      description: 'Create a company with sample data',
      method: 'POST',
      payload: {
        name: 'Sample Corp',
        email: 'info@samplecorp.com',
        industry: 'Technology',
        type: 'prospect'
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-rating',
      title: 'Update Rating',
      description: 'Update the sales rating of a company',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        rating: '{{rating}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-company',
      title: 'Delete Company',
      description: 'Delete a company record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
