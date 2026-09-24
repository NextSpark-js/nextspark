/**
 * API Presets for Theme
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/theme',
  summary: 'Access theme metadata and API routes',
  presets: [
    {
      id: 'list-themes',
      title: 'List All Themes',
      description: 'Get all registered themes with API status',
      method: 'GET',
      tags: ['read', 'list']
    }
  ]
})
