/**
 * API Presets for Customers Entity
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 * The endpoint is automatically derived from the entity name: /api/v1/customers
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  // endpoint is optional - derived from entity folder name
  summary: 'Manage customer records in the system',
  presets: [
    {
      id: 'list-all',
      title: 'List All Customers',
      description: 'Fetch all customers with default pagination',
      method: 'GET',
      params: {
        limit: 10,
        offset: 0
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-by-status',
      title: 'List Active Customers',
      description: 'Fetch only customers with active status',
      method: 'GET',
      params: {
        status: 'active',
        limit: 20
      },
      tags: ['read', 'filter']
    },
    {
      id: 'create-test',
      title: 'Create Test Customer',
      description: 'Create a new customer with sample data for testing',
      method: 'POST',
      payload: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '+1234567890',
        status: 'active'
      },
      sessionConfig: {
        crossTeam: false
      },
      tags: ['write', 'create']
    },
    {
      id: 'create-bypass',
      title: 'Create (Bypass Mode)',
      description: 'Create customer using admin bypass for cross-team access',
      method: 'POST',
      payload: {
        name: 'Cross-Team Customer',
        email: 'crossteam@example.com',
        status: 'pending'
      },
      sessionConfig: {
        crossTeam: true,
        teamId: '{{FIRST_TEAM_ID}}'
      },
      tags: ['write', 'admin', 'bypass']
    },
    {
      id: 'search-name',
      title: 'Search by Name',
      description: 'Search customers by name using partial match',
      method: 'GET',
      params: {
        search: 'John',
        searchField: 'name'
      },
      tags: ['read', 'search']
    }
  ]
})
