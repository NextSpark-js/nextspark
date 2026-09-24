/**
 * API Presets for Plugin
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin',
  summary: 'Access plugin metadata and API routes',
  presets: [
    {
      id: 'list-plugins',
      title: 'List All Plugins',
      description: 'Get all registered plugins with API status',
      method: 'GET',
      tags: ['read', 'list']
    }
  ]
})
