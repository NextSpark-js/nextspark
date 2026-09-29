/**
 * API Presets for API Keys
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/api-keys',
  summary: 'Manage API keys for programmatic access',
  presets: [
    {
      id: 'list-all',
      title: 'List API Keys',
      description: 'Fetch all API keys for the current team',
      method: 'GET',
      tags: ['read', 'list']
    },
    {
      id: 'create-key',
      title: 'Create API Key',
      description: 'Create a new API key for the team',
      method: 'POST',
      payload: {
        name: 'My New API Key'
      },
      tags: ['write', 'create']
    }
  ]
})
